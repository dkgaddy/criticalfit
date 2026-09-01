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

**3. `food-search.php` requires no authentication**
`api/food-search.php` has no `requireAuth()` call and includes `Access-Control-Allow-Origin: *`. The USDA API key is used freely by any unauthenticated visitor or by any third-party website making a cross-origin request. An attacker could hammer this endpoint to exhaust the API rate limit or rack up usage, degrading search for all users.

**4. Internal error details exposed in registration responses**
`api/auth/register-begin.php` returns `file`, `line number`, and the full stack trace in error JSON responses:
```php
'file'  => basename($e->getFile()) . ':' . $e->getLine(),
'trace' => substr($e->getTraceAsString(), 0, 500),
```
This maps out internal file paths and library versions to anyone who can trigger an error, making targeted exploit development significantly easier.

**5. No session ID regeneration after login (session fixation)**
`login-finish.php` sets `$_SESSION['user_id']` but never calls `session_regenerate_id(true)`. An attacker who can set a victim's session cookie before they log in (via subdomain injection, network interception before HTTPS, or browser extension) takes over the authenticated session after the victim completes their passkey challenge.

**6. No HTTP security headers**
There is no `.htaccess` file at the web root or in `api/`. The following headers are absent on every response:
- `Content-Security-Policy` — would block XSS attacks
- `X-Frame-Options` — app can be embedded in iframes for clickjacking
- `X-Content-Type-Options: nosniff` — browser MIME sniffing attacks
- `Strict-Transport-Security` — no HTTPS enforcement at the HTTP layer
- `Referrer-Policy` — navigation paths leak to third-party resources (Google Fonts, FontAwesome CDN)

---

## MEDIUM

**7. IP address spoofable via X-Forwarded-For**
`api/visit.php` unconditionally trusts the `HTTP_X_FORWARDED_FOR` header, which is fully client-controlled on SiteGround shared hosting. Any user can log any IP address into `visit_log`, poisoning the traffic report. Combined with finding #2, a crafted header becomes an XSS delivery vector.

**8. No rate limiting on authentication or registration**
`register-begin.php` creates a database row on every call with no throttling. An attacker can flood the `users` table with provisional rows (never cleaned up if registration is abandoned). Login attempts are also unlimited, though WebAuthn's hardware key requirement significantly raises the practical bar.

**9. `dragon.php` allows client to control "today's date"**
The `?today=YYYY-MM-DD` parameter is accepted from the client to avoid timezone mismatches. A user who has been inactive for 15+ days can pass the real current date to avoid dragon level demotion indefinitely. Only affects the calling user's own gamification state.

**10. Unvalidated date values stored directly**
`food.php`, `exercise.php`, `weight.php`, and `daily.php` accept `date` from POST/GET input and pass it to prepared statements without format-checking. Malformed values like `not-a-date` would be silently coerced by MySQL to `0000-00-00`, storing corrupt entries. Not SQL-injectable (prepared statements used), but data integrity is unprotected.

---

## LOW

**11. Prompt injection in AI food search (`claude-food-search.php`)**
User input is inserted into the Claude prompt after `htmlspecialchars()` escaping. HTML escaping does not protect against prompt injection. The endpoint is guild-member only and output is validated as JSON with numeric bounds. Worst case is inaccurate nutrition data.

**12. DDL statement on every request in `weight.php`**
`CREATE TABLE IF NOT EXISTS weight_entries (...)` executes on every single GET and POST to `weight.php`. The table has existed since launch. Unnecessary database overhead on every weight-related request.

**13. `api/` directory may be listable**
No `index.php` or `Options -Indexes` directive exists in the `api/` directory. Depending on Apache configuration, a browser GET to `/api/` may return a directory listing of all PHP endpoint filenames, disclosing the full API surface.

**14. Long session lifetime with no inactivity expiry**
Sessions are set to `lifetime: 86400 * 30` (30 days). There is no server-side activity check — a stolen session token is valid for a full month.

**15. `htmlspecialchars` misapplied in AI search**
In `claude-food-search.php`, the user query is run through `htmlspecialchars()` before being injected into an AI prompt. This converts `"` to `&quot;`, slightly degrading search accuracy while providing no meaningful security benefit in a non-HTML context.

---

## Summary Table

| # | Issue | Severity | Exploitable Without Auth? | Status |
|---|-------|----------|--------------------------|--------|
| 1 | DM privilege escalation via name | **Critical** | No (requires account) | ✅ Fixed |
| 2 | Stored XSS in admin page | **Critical** | No (requires account) | ✅ Fixed |
| 3 | Unauthenticated USDA proxy endpoint | High | Yes | Open |
| 4 | Stack traces in error responses | High | Partial | Open |
| 5 | Session fixation | High | Requires network position | Open |
| 6 | No security headers | High | Yes (passive) | Open |
| 7 | IP spoofing in visit log | Medium | No (requires account) | Open |
| 8 | No rate limiting on auth/register | Medium | Yes | Open |
| 9 | Client-controlled date in dragon calc | Medium | No (requires account) | Open |
| 10 | Unvalidated date inputs | Medium | No (requires account) | Open |
| 11 | Prompt injection in AI search | Low | No (requires guild) | Open |
| 12 | DDL on every weight request | Low | No | Open |
| 13 | API directory listing | Low | Yes | Open |
| 14 | 30-day session, no inactivity expiry | Low | Requires stolen cookie | Open |
| 15 | Misapplied `htmlspecialchars` | Low | No | Open |
