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

function startMusic(track, elapsedMs) {
  if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
  if (!track) return;

  // Store effective start time so subsequent page loads can seek to the right position
  var effectiveStart = Date.now() - (elapsedMs || 0);
  sessionStorage.setItem('cfMusicSession', JSON.stringify({ track: track, startedAt: effectiveStart }));

  _bgAudio        = new Audio('music/' + track);
  _bgAudio.volume = 0.5;
  _bgAudio.loop   = true;

  function doPlay() {
    var p = _bgAudio && _bgAudio.play();
    if (p !== undefined) {
      p.catch(function () {
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

  if (elapsedMs > 0) {
    // Seek to the right position before playing so it sounds continuous
    _bgAudio.addEventListener('loadedmetadata', function () {
      if (_bgAudio) _bgAudio.currentTime = (elapsedMs / 1000) % _bgAudio.duration;
      doPlay();
    }, { once: true });
    _bgAudio.load();
  } else {
    doPlay();
  }
}

function stopMusic() {
  if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
  sessionStorage.removeItem('cfMusicSession');
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
      if (track) {
        var elapsedMs = 0;
        try {
          var session = JSON.parse(sessionStorage.getItem('cfMusicSession') || 'null');
          if (session && session.track === track && session.startedAt) {
            elapsedMs = Date.now() - session.startedAt;
          }
        } catch (e) {}
        startMusic(track, elapsedMs);
      }
    })
    .catch(function () { /* not authenticated yet — use cached theme */ });
});
