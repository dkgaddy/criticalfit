// ============================================================
// Critical Fit — Meals List Page
// ============================================================

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ---- Toast ----

let _toastTimer = null;
function showMealsToast(msg) {
  const toast = document.getElementById('meals-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---- Delete confirm dialog ----

let _pendingDeleteId   = null;
let _pendingDeleteName = null;

function showDeleteConfirm(id, name) {
  _pendingDeleteId   = id;
  _pendingDeleteName = name;
  document.getElementById('delete-confirm-name').textContent = name;
  document.getElementById('delete-confirm-modal').classList.add('open');
}

function hideDeleteConfirm() {
  document.getElementById('delete-confirm-modal').classList.remove('open');
  _pendingDeleteId   = null;
  _pendingDeleteName = null;
}

// ---- Render meals ----

function renderMeals(meals) {
  const list = document.getElementById('meals-list');

  if (!meals.length) {
    list.innerHTML = '<p class="food-empty" style="text-align:center;padding:2rem 0">No saved meals yet.<br>Tap <strong>Create New Meal</strong> above to get started.</p>';
    return;
  }

  list.innerHTML = '';
  meals.forEach(meal => {
    const card = document.createElement('div');
    card.className = 'card meal-card';
    card.innerHTML = `
      <div class="meal-card-name">${esc(meal.name)}</div>
      <div class="meal-card-meta">
        ${meal.itemCount} ration${meal.itemCount !== 1 ? 's' : ''}&ensp;·&ensp;${meal.totalCalories} cal&ensp;·&ensp;P:&nbsp;${meal.totalProtein}g&ensp;C:&nbsp;${meal.totalCarbs}g&ensp;F:&nbsp;${meal.totalFat}g
      </div>
      <div class="meal-card-actions">
        <button class="btn btn-primary btn--sm" data-log="${meal.id}">
          <i class="fa-solid fa-bowl-rice"></i> Log Now
        </button>
        <button class="btn btn-secondary btn--sm" data-edit="${meal.id}">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
        <button class="btn btn-danger btn--sm" data-delete="${meal.id}" data-name="${esc(meal.name)}" aria-label="Delete ${esc(meal.name)}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-log]').forEach(btn => {
    btn.addEventListener('click', () => logMeal(parseInt(btn.dataset.log), btn));
  });
  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = `meal-edit.html?id=${btn.dataset.edit}`;
    });
  });
  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => showDeleteConfirm(parseInt(btn.dataset.delete), btn.dataset.name));
  });
}

// ---- Log a meal ----

async function logMeal(mealId, btn) {
  const d    = new Date();
  const date = d.getFullYear() + '-' +
               String(d.getMonth() + 1).padStart(2, '0') + '-' +
               String(d.getDate()).padStart(2, '0');

  const origHTML   = btn.innerHTML;
  btn.disabled     = true;
  btn.textContent  = 'Logging…';

  const r = await fetch('api/meals.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'log', id: mealId, date }),
  });
  const j = await r.json();

  btn.disabled  = false;
  btn.innerHTML = origHTML;

  if (j.ok) {
    const n = j.data.logged;
    showMealsToast(`Logged — ${n} ration${n !== 1 ? 's' : ''} added to today's journal`);
  }
}

// ---- Delete a meal ----

async function confirmDelete() {
  if (!_pendingDeleteId) return;
  const id = _pendingDeleteId;
  hideDeleteConfirm();

  await fetch('api/meals.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'delete', id }),
  });

  await loadAndRender();
}

// ---- Load and render ----

async function loadAndRender() {
  const r = await fetch('api/meals.php');
  const j = await r.json();
  renderMeals(j.ok ? j.data : []);
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('meals-page')) return;

  // Guild check
  const ur = await fetch('api/user.php');
  const uj = await ur.json();
  if (!uj.ok || !uj.data.isPremium) {
    window.location.href = 'index.html';
    return;
  }

  await loadAndRender();

  document.getElementById('new-meal-btn')?.addEventListener('click', () => {
    window.location.href = 'meal-edit.html';
  });

  // Delete confirm wiring
  document.getElementById('delete-confirm-yes')?.addEventListener('click',    confirmDelete);
  document.getElementById('delete-confirm-cancel')?.addEventListener('click', hideDeleteConfirm);
  document.getElementById('delete-confirm-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('delete-confirm-modal')) hideDeleteConfirm();
  });
});
