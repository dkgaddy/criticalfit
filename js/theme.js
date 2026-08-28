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
var _bgTrack  = null;
var _muted    = localStorage.getItem('cfMusicMuted') === '1';

function _syncMuteBtn() {
  var btn  = document.getElementById('mute-btn');
  var icon = document.getElementById('mute-icon');
  if (!btn) return;
  btn.hidden = !_bgTrack;
  if (icon) {
    icon.className = _muted
      ? 'fa-solid fa-volume-xmark'
      : 'fa-solid fa-volume';
  }
}

function _buildAudio(track, elapsedMs) {
  if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
  _bgTrack       = track;
  _bgAudio       = new Audio('music/' + track);
  _bgAudio.volume = 0.33;
  _bgAudio.loop   = true;
  _bgAudio.muted  = _muted;
  if (elapsedMs > 0) {
    _bgAudio.addEventListener('loadedmetadata', function () {
      if (_bgAudio) _bgAudio.currentTime = (elapsedMs / 1000) % _bgAudio.duration;
    }, { once: true });
  }
  return _bgAudio.play();
}

function _elapsedFor(track) {
  try {
    var s = JSON.parse(sessionStorage.getItem('cfMusicSession') || 'null');
    if (s && s.track === track && s.startedAt) return Date.now() - s.startedAt;
  } catch (e) {}
  return 0;
}

function startMusic(track, elapsedMs) {
  if (!track) return;
  localStorage.setItem('cfMusic', track);

  var effectiveStart = Date.now() - (elapsedMs || 0);
  sessionStorage.setItem('cfMusicSession', JSON.stringify({ track: track, startedAt: effectiveStart }));

  var p = _buildAudio(track, elapsedMs || 0);
  _syncMuteBtn();
  if (p !== undefined) {
    p.catch(function () {
      var t = track;
      function resume() {
        if (_bgTrack !== t) return;
        _buildAudio(t, _elapsedFor(t));
        _syncMuteBtn();
      }
      document.addEventListener('click',      resume, { capture: true, once: true });
      document.addEventListener('touchstart', resume, { capture: true, once: true });
    });
  }
}

function stopMusic() {
  if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
  _bgTrack = null;
  sessionStorage.removeItem('cfMusicSession');
  localStorage.setItem('cfMusic', '');
  _syncMuteBtn();
}

// ---- Load settings from API and apply ----

document.addEventListener('DOMContentLoaded', function () {
  // Inject mute button into header
  var header = document.querySelector('.app-header');
  if (header && !header.querySelector('#mute-btn')) {
    var muteBtn = document.createElement('button');
    muteBtn.id        = 'mute-btn';
    muteBtn.className = 'mute-btn';
    muteBtn.setAttribute('aria-label', 'Toggle music');
    muteBtn.hidden    = true;
    muteBtn.innerHTML = '<i class="fa-solid fa-volume" id="mute-icon"></i>';
    header.appendChild(muteBtn);

    muteBtn.addEventListener('click', function () {
      _muted = !_muted;
      localStorage.setItem('cfMusicMuted', _muted ? '1' : '');
      if (_bgAudio) _bgAudio.muted = _muted;
      _syncMuteBtn();
    });
  }

  // Start from localStorage immediately
  var cached = localStorage.getItem('cfMusic') || '';
  if (cached) startMusic(cached, _elapsedFor(cached));

  fetch('api/settings.php')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.ok) return;
      applyTheme(j.data.theme);
      var track = j.data.music || null;
      localStorage.setItem('cfMusic', track || '');
      if (track && track !== _bgTrack) {
        startMusic(track, 0);
      } else if (!track && _bgAudio) {
        stopMusic();
      }
    })
    .catch(function () { /* not authenticated yet — use cached theme */ });
});
