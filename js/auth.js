// ============================================================
// Critical Fit — Passkey Authentication
// ============================================================

// ---- Base64url helpers ----

function b64urlToBuffer(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0)).buffer;
}

function bufferToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ---- Session check (called on every app page) ----

async function checkAuth() {
  const r = await fetch('api/auth/session.php');
  const j = await r.json();
  if (!j.ok || !j.data) {
    window.location.replace('login.html');
  }
  return j.data;
}

// ---- Registration ----

async function register(displayName) {
  // 1. Get creation options
  const beginRes = await fetch('api/auth/register-begin.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ displayName }),
  });
  const begin = await beginRes.json();
  if (!begin.ok) throw new Error(begin.error);

  const opts = begin.data;
  opts.challenge                = b64urlToBuffer(opts.challenge);
  opts.user.id                  = b64urlToBuffer(opts.user.id);
  if (opts.excludeCredentials) {
    opts.excludeCredentials = opts.excludeCredentials.map(c => ({
      ...c, id: b64urlToBuffer(c.id),
    }));
  }

  // 2. Create passkey (triggers Face ID / Touch ID)
  const credential = await navigator.credentials.create({ publicKey: opts });

  // 3. Send attestation to server
  const finishRes = await fetch('api/auth/register-finish.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      id:    credential.id,
      rawId: bufferToB64url(credential.rawId),
      type:  credential.type,
      response: {
        clientDataJSON:    bufferToB64url(credential.response.clientDataJSON),
        attestationObject: bufferToB64url(credential.response.attestationObject),
      },
    }),
  });
  const finish = await finishRes.json();
  if (!finish.ok) throw new Error(finish.error);
  return finish.data;
}

// ---- Authentication ----

async function authenticate() {
  // 1. Get challenge
  const beginRes = await fetch('api/auth/login-begin.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const begin = await beginRes.json();
  if (!begin.ok) throw new Error(begin.error);

  const opts = begin.data;
  opts.challenge = b64urlToBuffer(opts.challenge);
  if (opts.allowCredentials) {
    opts.allowCredentials = opts.allowCredentials.map(c => ({
      ...c, id: b64urlToBuffer(c.id),
    }));
  }

  // 2. Sign challenge with passkey (triggers biometric picker)
  const assertion = await navigator.credentials.get({ publicKey: opts });

  // 3. Send assertion to server
  const finishRes = await fetch('api/auth/login-finish.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      id:    assertion.id,
      rawId: bufferToB64url(assertion.rawId),
      type:  assertion.type,
      response: {
        clientDataJSON:    bufferToB64url(assertion.response.clientDataJSON),
        authenticatorData: bufferToB64url(assertion.response.authenticatorData),
        signature:         bufferToB64url(assertion.response.signature),
        userHandle:        assertion.response.userHandle
                             ? bufferToB64url(assertion.response.userHandle)
                             : null,
      },
    }),
  });
  const finish = await finishRes.json();
  if (!finish.ok) throw new Error(finish.error);
  return finish.data;
}

// ---- Login page init ----

function initLoginPage() {
  if (!window.PublicKeyCredential) {
    document.getElementById('passkey-unsupported').style.display = 'block';
    document.getElementById('auth-form').style.display = 'none';
    return;
  }

  // If already logged in, go straight to app
  fetch('api/auth/session.php')
    .then(r => r.json())
    .then(j => { if (j.ok && j.data) window.location.replace('index.html'); });

  const nameInput   = document.getElementById('display-name');
  const registerBtn = document.getElementById('btn-register');
  const loginBtn    = document.getElementById('btn-login');
  const errorEl     = document.getElementById('auth-error');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
  function clearError() {
    errorEl.style.display = 'none';
  }
  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.textContent = loading ? 'Working…' : btn.dataset.originalText;
  }

  registerBtn.addEventListener('click', async () => {
    clearError();
    const name = nameInput.value.trim();
    if (!name) { showError('Enter your name to create an account.'); return; }
    setLoading(registerBtn, true);
    try {
      await register(name);
      window.location.replace('index.html');
    } catch (e) {
      showError(e.message || 'Registration failed. Please try again.');
      setLoading(registerBtn, false);
    }
  });

  loginBtn.addEventListener('click', async () => {
    clearError();
    setLoading(loginBtn, true);
    try {
      await authenticate();
      window.location.replace('index.html');
    } catch (e) {
      showError(e.message || 'Sign in failed. Please try again.');
      setLoading(loginBtn, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('login-page')) initLoginPage();
});
