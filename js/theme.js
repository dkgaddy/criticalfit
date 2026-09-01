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
  btn.style.display = _bgTrack ? '' : 'none';
  if (icon) {
    icon.className = _muted
      ? 'fa-solid fa-volume-xmark'
      : 'fa-solid fa-volume-high';
  }
}

function _buildAudio(track, elapsedMs) {
  if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
  _bgTrack        = track;
  _bgAudio        = new Audio('music/' + track);
  _bgAudio.volume = 0.15;
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

// Record a successful play in sessionStorage. Kept separate from startMusic so
// it can be called from both the initial play and the resume-after-gesture path.
function _recordSession(track, elapsedMs) {
  sessionStorage.setItem('cfMusicSession', JSON.stringify({
    track:     track,
    startedAt: Date.now() - (elapsedMs || 0),
  }));
}

function startMusic(track, elapsedMs) {
  if (!track) return;
  localStorage.setItem('cfMusic', track);

  var actualElapsed = elapsedMs || 0;
  var p = _buildAudio(track, actualElapsed);
  _syncMuteBtn();

  if (p !== undefined) {
    // Record the session only after play() actually succeeds so that
    // cfMusicSession being present reliably means autoplay is allowed.
    p.then(function () {
      _recordSession(track, actualElapsed);
    });

    p.catch(function () {
      // play() was blocked — browser requires a user gesture first.
      // Don't log anything; just wait for the first interaction.
      var t = track;
      function resume() {
        if (_bgTrack !== t) return;
        var p2 = _buildAudio(t, _elapsedFor(t));
        _syncMuteBtn();
        if (p2) {
          p2.then(function () { _recordSession(t, 0); }).catch(function () {});
        }
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
    muteBtn.style.display = 'none';
    muteBtn.innerHTML = '<i class="fa-solid fa-volume-high" id="mute-icon"></i>';
    header.appendChild(muteBtn);

    muteBtn.addEventListener('click', function () {
      _muted = !_muted;
      localStorage.setItem('cfMusicMuted', _muted ? '1' : '');
      if (_bgAudio) _bgAudio.muted = _muted;
      _syncMuteBtn();
    });
  }

  var cached = localStorage.getItem('cfMusic') || '';
  if (cached) {
    if (sessionStorage.getItem('cfMusicSession')) {
      // cfMusicSession is only written after a successful play(), so its presence
      // means the browser already allowed audio this session — safe to autoplay.
      startMusic(cached, _elapsedFor(cached));
    } else {
      // First page load this session: calling play() now would be blocked and
      // log a NotAllowedError. Instead, prime the track and mute button, then
      // start on the first user gesture with no error.
      _bgTrack = cached;
      _syncMuteBtn();
      (function () {
        function onFirstGesture() {
          var track = localStorage.getItem('cfMusic') || '';
          if (track) startMusic(track, 0);
        }
        document.addEventListener('click',      onFirstGesture, { capture: true, once: true });
        document.addEventListener('touchstart', onFirstGesture, { capture: true, once: true });
      }());
    }
  }

  fetch('api/settings.php')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.ok) return;
      applyTheme(j.data.theme);
      var track = j.data.music || null;
      localStorage.setItem('cfMusic', track || '');
      if (track && track !== _bgTrack) {
        if (sessionStorage.getItem('cfMusicSession')) {
          // Session is warm — switching tracks mid-session is safe.
          startMusic(track, 0);
        } else {
          // Still waiting for first gesture; update what will play when it arrives.
          _bgTrack = track;
          _syncMuteBtn();
        }
      } else if (!track && _bgAudio) {
        stopMusic();
      }
      // Log page visit now that we know the user is authenticated
      var page = location.pathname.split('/').pop().replace('.html', '') || 'home';
      fetch('api/visit.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: page }) }).catch(function () {});
    })
    .catch(function () { /* not authenticated yet — use cached theme */ });
});
