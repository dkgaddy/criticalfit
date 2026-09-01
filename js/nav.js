// ============================================================
// Critical Fit — Hamburger menu, guild gate, nav wiring
// ============================================================

// ---- Guild membership check ----

let _guildStatus = null;

async function isGuildMember() {
  if (_guildStatus !== null) return _guildStatus;
  // Reuse data already fetched by app.js on the journal page
  if (typeof cachedUser !== 'undefined' && cachedUser !== null) {
    _guildStatus = cachedUser.isPremium === true;
    return _guildStatus;
  }
  // Session cache so we only hit the API once per browser session
  const stored = sessionStorage.getItem('cfGuildMember');
  if (stored !== null) {
    _guildStatus = stored === 'true';
    return _guildStatus;
  }
  try {
    const r = await fetch('api/user.php');
    const j = await r.json();
    _guildStatus = j.ok && j.data?.isPremium === true;
    sessionStorage.setItem('cfGuildMember', String(_guildStatus));
  } catch {
    _guildStatus = false;
  }
  return _guildStatus;
}

// ---- Guild gate popup ----

function showGuildGate() {
  document.getElementById('guild-gate-modal')?.classList.add('open');
}

function initGuildGate() {
  const overlay = document.getElementById('guild-gate-modal');
  const defaultGateMsg = 'Join the Guild for more exciting features like this!';
  function closeGuildGate() {
    overlay?.classList.remove('open');
    const msgEl = document.getElementById('guild-gate-msg');
    if (msgEl) msgEl.textContent = defaultGateMsg;
  }
  document.getElementById('guild-gate-dismiss')?.addEventListener('click', closeGuildGate);
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) closeGuildGate();
  });
}

// ---- Hamburger menu ----

function initHamburger() {
  const btn  = document.getElementById('hamburger-btn');
  const menu = document.getElementById('ham-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const opening = menu.hidden;
    menu.hidden = !opening;
    btn.setAttribute('aria-expanded', String(opening));
  });

  document.addEventListener('click', e => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

// ---- Guild-gated actions ----

async function handleMealsClick(e) {
  e.preventDefault();
  if (await isGuildMember()) {
    window.location.href = 'meals.html';
  } else {
    showGuildGate();
  }
}

async function handleSettingsClick() {
  document.getElementById('ham-menu').hidden = true;
  document.getElementById('hamburger-btn')?.setAttribute('aria-expanded', 'false');
  if (await isGuildMember()) {
    window.location.href = 'settings.html';
  } else {
    showGuildGate();
  }
}

// ---- DM menu item ----

function _addSystemInfoLink() {
  const menu = document.getElementById('ham-menu');
  if (!menu || menu.querySelector('#nav-system-info')) return;
  const a = document.createElement('a');
  a.href      = 'system.html';
  a.className = 'ham-item';
  a.id        = 'nav-system-info';
  a.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> System Info';
  menu.appendChild(a);
}

async function _initDmMenu() {
  if (typeof cachedUser !== 'undefined' && cachedUser !== null) {
    if (cachedUser.isDm) _addSystemInfoLink();
    return;
  }
  const stored = sessionStorage.getItem('cfIsDm');
  if (stored === '1') { _addSystemInfoLink(); return; }
  if (stored === '0') return;
  try {
    const r = await fetch('api/user.php');
    const j = await r.json();
    const dm = j.ok && j.data?.isDm;
    sessionStorage.setItem('cfIsDm', dm ? '1' : '0');
    if (dm) _addSystemInfoLink();
  } catch {}
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  initHamburger();
  initGuildGate();

  document.getElementById('ham-settings')?.addEventListener('click', handleSettingsClick);
  document.getElementById('nav-meals')?.addEventListener('click', handleMealsClick);
  _initDmMenu();
});
