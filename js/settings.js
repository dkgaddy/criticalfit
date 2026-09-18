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

// Web Push wants the VAPID key as a raw Uint8Array, not the base64url string
// the server hands us.
function urlBase64ToUint8Array(base64String) {
  const padding    = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64     = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData    = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function subscribeToPush(vapidPublicKey) {
  await navigator.serviceWorker.register('./sw.js');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');

  const ready = await navigator.serviceWorker.ready;
  const sub = await ready.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  await fetch('api/push.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(sub.toJSON()),
  });
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && await reg.pushManager.getSubscription();
  if (!sub) return;
  await sub.unsubscribe();
  await fetch('api/push.php?endpoint=' + encodeURIComponent(sub.endpoint), { method: 'DELETE' });
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

  const { theme, music, notifications, vapidPublicKey } = j.data;

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
      } else {
        stopMusic();
      }
      saveSettingField({ music: track });
    });
  }

  // Notifications
  const notifEl   = document.getElementById('setting-notifications');
  const notifNote = document.getElementById('setting-notifications-note');
  const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  if (notifEl) {
    if (!pushSupported || !vapidPublicKey) {
      notifEl.checked  = false;
      notifEl.disabled = true;
      // Leave the default iOS-install note in place — it's the most likely reason.
    } else if (Notification.permission === 'denied') {
      notifEl.checked  = false;
      notifEl.disabled = true;
      if (notifNote) notifNote.textContent = 'Notifications are blocked in your browser settings for this site.';
    } else {
      notifEl.disabled = false;
      notifEl.checked  = notifications || false;
      if (notifNote) notifNote.textContent = "We'll nudge you if you haven't logged any rations by evening.";

      notifEl.addEventListener('change', async function () {
        const wantsOn = notifEl.checked;
        notifEl.disabled = true;
        try {
          if (wantsOn) {
            await subscribeToPush(vapidPublicKey);
          } else {
            await unsubscribeFromPush();
          }
          await saveSettingField({ notifications: wantsOn });
        } catch (err) {
          notifEl.checked = !wantsOn;
          if (notifNote) notifNote.textContent = 'Could not update notifications — please try again.';
        } finally {
          notifEl.disabled = false;
        }
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  if (document.getElementById('settings-page')) {
    await checkAuth();
    await initSettings();
  }
});
