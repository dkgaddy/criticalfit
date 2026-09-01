// ============================================================
// Critical Fit — System Info (DM only)
// ============================================================

function _fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _fmtDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function renderUsers(users) {
  const tbody = document.getElementById('users-body');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-loading">No data yet</td></tr>';
    return;
  }
  tbody.innerHTML = users.map((u, i) => `
    <tr>
      <td class="admin-td-num">${i + 1}</td>
      <td>${u.name || '—'}</td>
      <td class="admin-td-num">${u.daysLogged}</td>
      <td class="admin-td-center">${u.isGuild ? '<i class="fa-solid fa-ring" title="Guild Member"></i>' : '<span class="admin-muted">—</span>'}</td>
      <td>${_fmtDateTime(u.lastLogin)}</td>
    </tr>`).join('');
}

function renderTraffic(traffic) {
  const tbody = document.getElementById('traffic-body');
  if (!traffic.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="admin-loading">No traffic logged yet</td></tr>';
    return;
  }
  tbody.innerHTML = traffic.map(t => `
    <tr>
      <td>${_fmtDate(t.date)}</td>
      <td class="admin-ip">${t.ip || '—'}</td>
      <td class="admin-td-num">${t.pagesVisited}</td>
      <td class="admin-td-center">${t.hasPasskey ? '<i class="fa-solid fa-key" title="Has Passkey"></i>' : '<span class="admin-muted">—</span>'}</td>
    </tr>`).join('');
}

async function loadSystemInfo() {
  try {
    const r = await fetch('api/admin.php');
    if (r.status === 403) {
      document.querySelector('.journal-page').innerHTML =
        '<div class="card" style="text-align:center;padding:2rem;"><i class="fa-solid fa-lock" style="font-size:2rem;margin-bottom:1rem;"></i><p>Access restricted to the Dungeon Master.</p><a href="index.html" class="btn btn-primary" style="margin-top:1rem;">Back to Journal</a></div>';
      return;
    }
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    renderUsers(j.data.users);
    renderTraffic(j.data.traffic);
  } catch (e) {
    document.getElementById('users-body').innerHTML  = `<tr><td colspan="5" class="admin-loading">Error: ${e.message}</td></tr>`;
    document.getElementById('traffic-body').innerHTML = `<tr><td colspan="4" class="admin-loading">Error: ${e.message}</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', loadSystemInfo);
