// Apply cached theme before page renders to prevent flash
(function () {
  const t = localStorage.getItem('cfTheme');
  if (t && t !== 'forest') document.documentElement.setAttribute('data-theme', t);
}());

// ---- Theme ----

function applyTheme(theme) {
  const t = theme || 'forest';
  if (t === 'forest') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', t);
  }
  localStorage.setItem('cfTheme', t);
}

// ---- Music ----

var _bgAudio = null;

function startMusic(track) {
  if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
  if (!track) return;
  _bgAudio        = new Audio('music/' + track);
  _bgAudio.volume = 0.5;
  _bgAudio.loop   = true;
  var p = _bgAudio.play();
  if (p !== undefined) {
    p.catch(function () {
      // Autoplay blocked — resume on first user gesture
      function resume() {
        _bgAudio && _bgAudio.play();
        document.removeEventListener('click',      resume);
        document.removeEventListener('touchstart', resume);
      }
      document.addEventListener('click',      resume, { once: true });
      document.addEventListener('touchstart', resume, { once: true });
    });
  }
}

function stopMusic() {
  if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
  sessionStorage.setItem('cfMusic', '');
}

// ---- Load settings from API and apply ----

document.addEventListener('DOMContentLoaded', function () {
  fetch('api/settings.php')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.ok) return;
      applyTheme(j.data.theme);
      var track = j.data.music || null;
      sessionStorage.setItem('cfMusic', track || '');
      if (track) startMusic(track);
    })
    .catch(function () { /* not authenticated yet — use cached theme */ });
});
