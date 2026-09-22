// ============================================================
// Critical Fit — Push Notifications admin (DM only)
// ============================================================

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

const SCHEDULE_LABELS = {
  daily_morning: 'Daily Morning',
  daily_noon:    'Daily Noon',
  daily_night:   'Daily Night',
  weekly:        'Weekly',
  monthly:       'Monthly',
};

// ---- Toast ----

let _toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('push-admin-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---- Delete confirm dialog ----

let _pendingDeleteId    = null;
let _pendingDeleteTitle = null;

function showDeleteConfirm(id, title) {
  _pendingDeleteId    = id;
  _pendingDeleteTitle = title;
  document.getElementById('delete-confirm-name').textContent = title;
  document.getElementById('delete-confirm-modal').classList.add('open');
}

function hideDeleteConfirm() {
  document.getElementById('delete-confirm-modal').classList.remove('open');
  _pendingDeleteId    = null;
  _pendingDeleteTitle = null;
}

async function confirmDelete() {
  if (!_pendingDeleteId) return;
  const id = _pendingDeleteId;
  hideDeleteConfirm();

  await fetch('api/push-admin.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'delete', id }),
  });
  showToast('Notification deleted');
  await loadAndRender();
}

// ---- Create/edit modal ----

let _editingId = null;

function openModal(notification) {
  _editingId = notification ? notification.id : null;
  document.getElementById('notification-modal-title').textContent = notification ? 'Edit Notification' : 'New Notification';
  document.getElementById('notification-title').value    = notification ? notification.title   : '';
  document.getElementById('notification-message').value  = notification ? notification.message : '';
  document.getElementById('notification-schedule').value = notification ? notification.schedule : 'daily_morning';
  document.getElementById('notification-active').checked = notification ? notification.active   : true;
  document.getElementById('notification-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('notification-modal').classList.remove('open');
  _editingId = null;
}

async function saveNotification() {
  const title    = document.getElementById('notification-title').value.trim();
  const message  = document.getElementById('notification-message').value.trim();
  const schedule = document.getElementById('notification-schedule').value;
  const active   = document.getElementById('notification-active').checked;

  if (!title || !message) {
    showToast('Title and message are required');
    return;
  }

  const body = { action: _editingId ? 'update' : 'create', title, message, schedule, active };
  if (_editingId) body.id = _editingId;

  const r = await fetch('api/push-admin.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) { showToast(j.error || 'Save failed'); return; }

  closeModal();
  showToast('Notification saved');
  await loadAndRender();
}

// ---- Inline active toggle ----

async function setActive(id, active) {
  await fetch('api/push-admin.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'setActive', id, active }),
  });
}

// ---- Render table ----

let _notifications = [];

function renderNotifications() {
  const tbody = document.getElementById('notifications-body');
  if (!_notifications.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="admin-loading">No scheduled notifications yet</td></tr>';
    return;
  }
  tbody.innerHTML = _notifications.map(n => `
    <tr>
      <td>${esc(n.title)}</td>
      <td>${esc(SCHEDULE_LABELS[n.schedule] || n.schedule)}</td>
      <td class="admin-td-center">
        <label class="toggle-switch">
          <input type="checkbox" data-toggle="${n.id}" ${n.active ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
      </td>
      <td>
        <div class="admin-actions">
          <button class="btn btn-secondary btn--sm" data-edit="${n.id}" aria-label="Edit ${esc(n.title)}">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-danger btn--sm" data-delete="${n.id}" aria-label="Delete ${esc(n.title)}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-toggle]').forEach(cb => {
    cb.addEventListener('change', () => setActive(parseInt(cb.dataset.toggle), cb.checked));
  });
  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = _notifications.find(x => x.id === parseInt(btn.dataset.edit));
      if (n) openModal(n);
    });
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = _notifications.find(x => x.id === parseInt(btn.dataset.delete));
      if (n) showDeleteConfirm(n.id, n.title);
    });
  });
}

async function loadAndRender() {
  const r = await fetch('api/push-admin.php');
  const j = await r.json();
  _notifications = j.ok ? j.data : [];
  renderNotifications();
}

// ---- Send Now ----

async function sendNow() {
  const title   = document.getElementById('sendnow-title').value.trim();
  const message = document.getElementById('sendnow-message').value.trim();

  if (!message) {
    showToast('Message is required');
    return;
  }

  const btn = document.getElementById('sendnow-btn');
  btn.disabled = true;

  const r = await fetch('api/push-admin.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'sendNow', title, message }),
  });
  const j = await r.json();

  btn.disabled = false;

  if (!j.ok) { showToast(j.error || 'Send failed'); return; }
  document.getElementById('sendnow-message').value = '';
  showToast(`Sent to ${j.data.sent} user${j.data.sent !== 1 ? 's' : ''}`);
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const r = await fetch('api/user.php');
    const j = await r.json();
    if (!j.ok || !j.data?.isDm) throw new Error('forbidden');
  } catch (e) {
    document.querySelector('.journal-page').innerHTML =
      '<div class="card" style="text-align:center;padding:2rem;"><i class="fa-solid fa-lock" style="font-size:2rem;margin-bottom:1rem;"></i><p>Access restricted to the Dungeon Master.</p><a href="index.html" class="btn btn-primary" style="margin-top:1rem;">Back to Journal</a></div>';
    return;
  }

  await loadAndRender();

  document.getElementById('new-notification-btn')?.addEventListener('click', () => openModal(null));
  document.getElementById('notification-close')?.addEventListener('click', closeModal);
  document.getElementById('notification-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('notification-modal')) closeModal();
  });
  document.getElementById('notification-save-btn')?.addEventListener('click', saveNotification);

  document.getElementById('delete-confirm-yes')?.addEventListener('click',    confirmDelete);
  document.getElementById('delete-confirm-cancel')?.addEventListener('click', hideDeleteConfirm);
  document.getElementById('delete-confirm-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('delete-confirm-modal')) hideDeleteConfirm();
  });

  document.getElementById('sendnow-btn')?.addEventListener('click', sendNow);
});
