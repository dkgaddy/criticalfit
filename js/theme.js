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

function _buildAudio(track, elapsedMs) {
  if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
  _bgTrack  = track;
  _bgAudio  = new Audio('music/' + track);
  _bgAudio.volume = 0.33;
  _bgAudio.loop   = true;
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
  if (p !== undefined) {
    p.catch(function () {
      // Capture phase fires before any child stopPropagation.
      // Re-build the Audio object INSIDE the gesture so iOS accepts the play() call.
      var t = track;
      function resume() {
        if (_bgTrack !== t) return; // track changed while waiting
        _buildAudio(t, _elapsedFor(t));
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
}

// ---- Load settings from API and apply ----

document.addEventListener('DOMContentLoaded', function () {
  // Start from localStorage immediately — avoids waiting for the API round-trip
  // on pages where the user already has activation state (any page after the first).
  var cached = localStorage.getItem('cfMusic') || '';
  if (cached) startMusic(cached, _elapsedFor(cached));

  fetch('api/settings.php')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.ok) return;
      applyTheme(j.data.theme);
      var track = j.data.music || null;
      localStorage.setItem('cfMusic', track || '');
      // Only act if the API track differs from what's already started
      if (track && track !== _bgTrack) {
        startMusic(track, 0);
      } else if (!track && _bgAudio) {
        stopMusic();
      }
    })
    .catch(function () { /* not authenticated yet — use cached theme */ });
});
