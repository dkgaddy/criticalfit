'use strict';

// Capture the install prompt before any user gesture.
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

// ---- Toast ----

function showInstallToast(msg) {
  let t = document.getElementById('install-toast');
  if (!t) {
    t = document.createElement('div');
    t.id    = 'install-toast';
    t.className = 'install-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ---- iOS instructions modal (built once, reused) ----

function getIOSModal() {
  let m = document.getElementById('ios-install-modal');
  if (m) return m;

  m = document.createElement('div');
  m.id        = 'ios-install-modal';
  m.className = 'install-overlay';
  m.innerHTML = `
    <div class="install-sheet">
      <p class="install-sheet-title">Install Critical Fit</p>
      <ol class="install-steps">
        <li>Tap the <strong>Share</strong> button <span class="install-share-glyph">&#x2B06;</span> at the bottom of Safari.</li>
        <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
        <li>Tap <strong>Add</strong> to confirm.</li>
      </ol>
      <p class="install-steps-note">The app will appear on your home screen just like a native app — no App Store required.</p>
      <button class="btn btn-primary install-sheet-close" id="ios-modal-close">Got It</button>
    </div>
  `;
  document.body.appendChild(m);

  const close = () => m.classList.remove('open');
  document.getElementById('ios-modal-close').addEventListener('click', close);
  m.addEventListener('click', (e) => { if (e.target === m) close(); });
  return m;
}

// ---- Install button handler ----

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('nav-install');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (isStandalone) {
      showInstallToast('Critical Fit is already installed!');
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showInstallToast('Installing Critical Fit…');
      }
      deferredPrompt = null;
      return;
    }

    if (isIOS) {
      getIOSModal().classList.add('open');
      return;
    }

    // Fallback — browser doesn't support install prompt
    showInstallToast('Open in Chrome or Safari on your mobile device to install.');
  });
});
