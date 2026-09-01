# CriticalFit Security Audit Report
**Date:** 2026-08-11  
**Auditor:** Claude Sonnet 4.6  
**Scope:** All PHP API endpoints, JS authentication, session management, admin page

---

## CRITICAL

**1. Privilege escalation via DM name matching** ✅ FIXED
`api/user.php` ran `UPDATE users SET is_dm = 1 WHERE name = 'David'` on every new PHP session. Any registered user who set their profile name to "David" (via the Character Sheet page or a direct POST to `api/user.php`) would automatically be granted DM access. This gave them full visibility into the System Info page: all user names, login dates, guild status, and IP addresses of every visitor.

**2. Stored XSS targeting the DM account** ✅ FIXED
`js/system.js` rendered user names and visitor IP addresses using raw template literals inside `innerHTML`:
```javascript
<td>${u.name || '—'}</td>      // user-controlled via profile
<td class="admin-ip">${t.ip || '—'}</td>  // user-controlled via X-Forwarded-For
```
A malicious user could register with a name like `<img src=x onerror=alert(document.cookie)>`, or send any HTTP request with a spoofed `X-Forwarded-For: <script>...</script>` header. The payload is stored in the database and executes in the DM's browser when they open System Info. Combined with finding #1, an attacker could self-escalate to DM and then exfiltrate session cookies.

---

## HIGH

**3. `food-search.php` requires no authentication** ✅ FIXED
`api/food-search.php` had no `requireAuth()` call and included `Access-Control-Allow-Origin: *`. The USDA API key was used freely by any unauthenticated visitor or by any third-party website making a cross-origin request. An attacker could hammer this endpoint to exhaust the API rate limit or rack up usage, degrading search for all users.

**4. Internal error details exposed in registration responses** ✅ FIXED
`api/auth/register-begin.php` and `login-begin.php` returned `file`, `line number`, and full stack traces in error JSON responses:
```php
'file'  => basename($e->getFile()) . ':' . $e->getLine(),
'trace' => substr($e->getTraceAsString(), 0, 500),
```
This mapped out internal file paths and library versions to anyone who can trigger an error. Both endpoints now return a single generic error string.

**5. No session ID regeneration after login (session fixation)** ✅ FIXED
`login-finish.php` and `register-finish.php` set `$_SESSION['user_id']` but never called `session_regenerate_id(true)`. An attacker who can set a victim's session cookie before they log in (via subdomain injection, network interception before HTTPS, or browser extension) could take over the authenticated session after the victim completes their passkey challenge. Both files now call `session_regenerate_id(true)` immediately before writing the user ID to the session.

**6. No HTTP security headers** ✅ FIXED
There was no `.htaccess` file at the web root. A `.htaccess` has been added with the following headers on every response:
- `Content-Security-Policy` — restricts scripts to same-origin, blocks inline scripts, whitelists Google Fonts and FontAwesome CDN; `frame-ancestors 'none'` blocks iframe embedding
- `X-Frame-Options: DENY` — belt-and-suspenders clickjacking protection for older browsers
- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing attacks
- `Strict-Transport-Security` — enforces HTTPS for 1 year including subdomains
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage to third parties
- `Permissions-Policy` — disables geolocation, microphone, and camera APIs
- `Options -Indexes` — also resolves Low finding #13 (directory listing)

---

## MEDIUM

**7. IP address spoofable via X-Forwarded-For** ✅ FIXED
`api/visit.php` unconditionally trusted the `HTTP_X_FORWARDED_FOR` header, which is fully client-controlled on SiteGround shared hosting. Any user could log any IP address into `visit_log`, poisoning the traffic report, and combined with finding #2 (now fixed), a crafted header could deliver a stored XSS payload. Fixed by adding `clientIp()` to `db.php` that always uses `REMOTE_ADDR` only; all auth rate limiting also uses this function.

**8. No rate limiting on authentication or registration** ✅ FIXED
`register-begin.php` created a database row on every call with no throttling, enabling `users` table flooding. Login was also unlimited. Fixed by adding `checkRateLimit()` to `db.php` backed by a new `auth_attempts` table. Registration is capped at 5 attempts per IP per hour; login is capped at 10 attempts per IP per 15 minutes. The table self-cleans on a 1-in-50 probabilistic sweep.

**9. `dragon.php` allows client to control "today's date"** ✅ FIXED
The `?today=YYYY-MM-DD` parameter was accepted without bounds, allowing a user who had been inactive 15+ days to pass an old date and avoid dragon level demotion. Fixed by clamping the client-supplied date to within ±1 day of server time — wide enough to absorb any real timezone difference, narrow enough to prevent abuse.

**10. Unvalidated date values stored directly** ✅ FIXED
`food.php`, `exercise.php`, `weight.php`, and `daily.php` accepted `date` from POST/GET input without format-checking. Malformed values like `not-a-date` would be silently coerced by MySQL to `0000-00-00`, storing corrupt entries. Fixed by adding `validDate()` to `db.php` (regex + `checkdate()` calendar check); all four endpoints now fall back to today's date on invalid input.

---

## LOW

**11. Prompt injection in AI food search (`claude-food-search.php`)** ✅ FIXED
User input was inserted into the Claude prompt after `htmlspecialchars()` escaping. HTML escaping does not protect against prompt injection. Fixed by: (1) adding a Unicode character allowlist that strips anything not found in real food names, capping the query at 100 chars; (2) moving all instructions into the API `system` prompt and placing only the sanitized user query in the `messages` user turn — the strongest available structural defence against injection.

**12. DDL statement on every request in `weight.php`** ✅ FIXED
`CREATE TABLE IF NOT EXISTS weight_entries (...)` executed on every single GET and POST to `weight.php`. Fixed by gating it with a `$_SESSION['_weight_ddl']` flag so the DDL runs at most once per session, matching the pattern used elsewhere in the codebase.

**13. `api/` directory may be listable** ✅ FIXED (via #6 .htaccess)
Resolved by `Options -Indexes` in the `.htaccess` added for finding #6.

**14. Long session lifetime with no inactivity expiry** ✅ FIXED
Sessions were set to `lifetime: 86400 * 30` (30 days) with no server-side activity check, meaning a stolen token was valid for a full month regardless of use. Fixed in `requireAuth()` in `db.php`: a `_last_activity` timestamp is written to the session on every authenticated request. If the gap since last activity exceeds 30 days, the session is destroyed server-side and a 401 is returned. The 30-day window now measures idle time rather than time-since-login.

**15. `htmlspecialchars` misapplied in AI search** ✅ FIXED
`htmlspecialchars()` was converting `"` to `&quot;` in food search queries before they reached the AI prompt, degrading accuracy (e.g. `"Big Mac"` became `&quot;Big Mac&quot;`) while providing no meaningful protection. Removed entirely as part of the fix for #11; replaced with a proper character allowlist.

---

## Summary Table

| # | Issue | Severity | Exploitable Without Auth? | Status |
|---|-------|----------|--------------------------|--------|
| 1 | DM privilege escalation via name | **Critical** | No (requires account) | ✅ Fixed |
| 2 | Stored XSS in admin page | **Critical** | No (requires account) | ✅ Fixed |
| 3 | Unauthenticated USDA proxy endpoint | High | Yes | ✅ Fixed |
| 4 | Stack traces in error responses | High | Partial | ✅ Fixed |
| 5 | Session fixation | High | Requires network position | ✅ Fixed |
| 6 | No security headers | High | Yes (passive) | ✅ Fixed |
| 7 | IP spoofing in visit log | Medium | No (requires account) | ✅ Fixed |
| 8 | No rate limiting on auth/register | Medium | Yes | ✅ Fixed |
| 9 | Client-controlled date in dragon calc | Medium | No (requires account) | ✅ Fixed |
| 10 | Unvalidated date inputs | Medium | No (requires account) | ✅ Fixed |
| 11 | Prompt injection in AI search | Low | No (requires guild) | ✅ Fixed |
| 12 | DDL on every weight request | Low | No | ✅ Fixed |
| 13 | API directory listing | Low | Yes | ✅ Fixed (via #6 .htaccess) |
| 14 | 30-day session, no inactivity expiry | Low | Requires stolen cookie | ✅ Fixed |
| 15 | Misapplied `htmlspecialchars` | Low | No | ✅ Fixed (via #11) |
