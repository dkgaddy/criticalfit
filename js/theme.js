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
// Always-on background music rotation for every user (not a Guild perk, not
// user-selectable). A session (sessionStorage — survives page navigation,
// cleared when the tab closes) starts on a random track so short visits
// don't always hear the same one; from there it advances through the fixed
// list in order, wrapping around, so a long-enough visit eventually hears
// all five before the cycle repeats.

var MUSIC_TRACKS = [
  'HammeringHearts.mp3',
  'MistyTaverns.mp3',
  'PipeSmoke.mp3',
  'RowingTheLoch.mp3',
  'SpinningElves.mp3',
];

var _bgAudio = null;
var _bgIndex = null;
var _muted   = localStorage.getItem('cfMusicMuted') === '1';

function _syncMuteBtn() {
  var btn  = document.getElementById('mute-btn');
  var icon = document.getElementById('mute-icon');
  if (!btn) return;
  btn.style.display = _bgIndex !== null ? '' : 'none';
  if (icon) {
    icon.className = _muted
      ? 'fa-solid fa-volume-xmark'
      : 'fa-solid fa-volume-high';
  }
}

function _readMusicSession() {
  try {
    var s = JSON.parse(sessionStorage.getItem('cfMusicSession') || 'null');
    if (s && typeof s.index === 'number' && s.startedAt) return s;
  } catch (e) {}
  return null;
}

// Builds and plays the track at `index`, seeking to `elapsedMs` in (used when
// resuming on a new page load mid-track). If elapsed has already run past
// this track's own length — e.g. the user navigated to a new page well after
// it would have finished — skip ahead to the next track instead of seeking
// past the end; a little imprecise on exactly how far into that next track
// to seek, but keeps this simple for an edge case page navigation makes rare.
function _buildAudio(index, elapsedMs) {
  if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
  _bgIndex     = index;
  var audio    = new Audio('music/' + MUSIC_TRACKS[index]);
  _bgAudio     = audio;
  audio.volume = 0.15;
  audio.muted  = _muted;

  audio.addEventListener('loadedmetadata', function () {
    if (_bgAudio !== audio) return;
    if (elapsedMs > 0) {
      if (elapsedMs / 1000 < audio.duration) {
        audio.currentTime = elapsedMs / 1000;
      } else {
        _playTrack((index + 1) % MUSIC_TRACKS.length, 0);
      }
    }
  }, { once: true });

  audio.addEventListener('ended', function () {
    if (_bgAudio !== audio) return;
    _playTrack((index + 1) % MUSIC_TRACKS.length, 0);
  });

  return audio.play();
}

// Plays `index` starting `elapsedMs` into the track, recording the session
// (only once play() actually succeeds, same reasoning as before: its
// presence reliably means autoplay is allowed) so the next page load or the
// 'ended' advance both know where playback stands.
function _playTrack(index, elapsedMs) {
  var startedAt = Date.now() - (elapsedMs || 0);
  var p = _buildAudio(index, elapsedMs || 0);
  _syncMuteBtn();
  if (p !== undefined) {
    p.then(function () {
      // Guard against a race: if elapsedMs overshot this track's length,
      // loadedmetadata may have already swapped _bgIndex to the next track
      // before this promise resolved. Don't let the abandoned track's
      // session write clobber the replacement's.
      if (_bgIndex !== index) return;
      sessionStorage.setItem('cfMusicSession', JSON.stringify({ index: index, startedAt: startedAt }));
    });

    p.catch(function () {
      // play() was blocked — browser requires a user gesture first.
      // Don't log anything; just wait for the first interaction and retry
      // this same track from the same elapsed position (nothing played in
      // the meantime, so no time to account for).
      function resume() {
        if (_bgIndex !== index) return;
        var p2 = _buildAudio(index, elapsedMs || 0);
        _syncMuteBtn();
        if (p2) {
          p2.then(function () {
            if (_bgIndex !== index) return;
            sessionStorage.setItem('cfMusicSession', JSON.stringify({ index: index, startedAt: Date.now() - (elapsedMs || 0) }));
          }).catch(function () {});
        }
      }
      document.addEventListener('click',      resume, { capture: true, once: true });
      document.addEventListener('touchstart', resume, { capture: true, once: true });
    });
  }
}

function initMusicRotation() {
  var session = _readMusicSession();
  if (session) {
    _playTrack(session.index, Date.now() - session.startedAt);
  } else {
    _playTrack(Math.floor(Math.random() * MUSIC_TRACKS.length), 0);
  }
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

  initMusicRotation();

  fetch('api/settings.php')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.ok) return;
      applyTheme(j.data.theme);
      // Log page visit now that we know the user is authenticated
      var page = location.pathname.split('/').pop().replace('.html', '') || 'home';
      fetch('api/visit.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: page }) }).catch(function () {});
    })
    .catch(function () { /* not authenticated yet — use cached theme */ });
});
