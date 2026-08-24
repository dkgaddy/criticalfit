// ============================================================
// Critical Fit — Settings Page
// ============================================================

async function saveSettingField(payload) {
  await fetch('api/settings.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
}

async function initSettings() {
  // Redirect non-guild members
  const ur = await fetch('api/user.php');
  const uj = await ur.json();
  if (!uj.ok || !uj.data.isPremium) {
    window.location.href = 'index.html';
    return;
  }

  const r = await fetch('api/settings.php');
  const j = await r.json();
  if (!j.ok) return;

  const { theme, music, notifications } = j.data;

  // Theme
  const themeEl = document.getElementById('setting-theme');
  if (themeEl) {
    themeEl.value = theme || 'forest';
    themeEl.addEventListener('change', function () {
      applyTheme(themeEl.value);
      saveSettingField({ theme: themeEl.value });
    });
  }

  // Music
  const musicEl = document.getElementById('setting-music');
  if (musicEl) {
    musicEl.value = music || '';
    musicEl.addEventListener('change', function () {
      const track = musicEl.value || null;
      if (track) {
        startMusic(track);
        sessionStorage.setItem('cfMusic', track);
      } else {
        stopMusic();
      }
      saveSettingField({ music: track });
    });
  }

  // Notifications (placeholder)
  const notifEl = document.getElementById('setting-notifications');
  if (notifEl) {
    notifEl.checked = notifications || false;
    notifEl.addEventListener('change', function () {
      saveSettingField({ notifications: notifEl.checked });
    });
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  if (document.getElementById('settings-page')) {
    await checkAuth();
    await initSettings();
  }
});
