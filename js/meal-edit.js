// ============================================================
// Critical Fit — Meal Edit Page
// ============================================================

// ---- State ----

let mealId      = null;   // null = creating new meal
let mealItems   = [];     // { id?, tempId?, name, fdcId, calories, protein, carbs, fat, grams, servingDesc }
let tempCounter = 0;

// ---- Food search state ----

let searchMode      = 'ai';
let currentFood     = null;
let currentServings = 1;
let searchSeq       = 0;
const searchCache   = {};
const aiSearchCache = {};

// ---- Helpers ----

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ---- Render meal items list ----

function renderItemsList() {
  const container = document.getElementById('meal-items-list');
  const nutCard   = document.getElementById('meal-nutrition-card');

  if (!mealItems.length) {
    container.innerHTML = '<p class="food-empty">No rations added yet.</p>';
    nutCard.hidden = true;
    return;
  }

  container.innerHTML = '';
  mealItems.forEach(item => {
    const row = document.createElement('div');
    row.className = 'meal-item-row';
    const desc = item.servingDesc
      ? esc(item.servingDesc)
      : (item.grams ? `${item.grams}g` : '1 serving');
    row.innerHTML = `
      <div class="meal-item-info">
        <div class="meal-item-name">${esc(item.name)}</div>
        <div class="meal-item-macros">${Math.round(item.calories)} cal · P: ${item.protein}g · C: ${item.carbs}g · F: ${item.fat}g · ${desc}</div>
      </div>
      <button class="meal-item-remove" aria-label="Remove ${esc(item.name)}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    row.querySelector('.meal-item-remove').addEventListener('click', () => removeItem(item));
    container.appendChild(row);
  });

  // Nutrition summary
  const totCal = Math.round(mealItems.reduce((s, i) => s + i.calories, 0));
  const totPro = Math.round(mealItems.reduce((s, i) => s + i.protein, 0) * 10) / 10;
  const totCar = Math.round(mealItems.reduce((s, i) => s + i.carbs,   0) * 10) / 10;
  const totFat = Math.round(mealItems.reduce((s, i) => s + i.fat,     0) * 10) / 10;
  document.getElementById('meal-nutrition-summary').innerHTML = `
    <div class="meal-nutrition-row">
      <span class="meal-nutrition-cal">${totCal} <small style="font-size:0.65em;font-weight:400">cal</small></span>
      <span class="meal-nutrition-macros">P: ${totPro}g &nbsp; C: ${totCar}g &nbsp; F: ${totFat}g</span>
    </div>
  `;
  nutCard.hidden = false;
}

// ---- Remove item ----

async function removeItem(item) {
  if (item.id) {
    // Existing item saved to DB — delete it
    await fetch('api/meal-items.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'remove', id: item.id }),
    });
  }
  mealItems = mealItems.filter(i => i !== item);
  renderItemsList();
}

// ---- Add food to meal ----

async function addFoodToMeal() {
  if (!currentFood) return;

  const base     = currentFood.grams ?? 100;
  const servDesc = currentServings === 1
    ? (currentFood.serving_desc || null)
    : (currentFood.serving_desc ? `${currentServings}× ${currentFood.serving_desc}` : null);

  const item = {
    name:        currentFood.name,
    fdcId:       currentFood.fdcId ?? null,
    calories:    Math.round(currentFood.calories * currentServings),
    protein:     Math.round(currentFood.protein  * currentServings * 10) / 10,
    carbs:       Math.round(currentFood.carbs    * currentServings * 10) / 10,
    fat:         Math.round(currentFood.fat      * currentServings * 10) / 10,
    grams:       Math.round(base * currentServings),
    servingDesc: servDesc,
  };

  const btn         = document.getElementById('food-log-btn');
  btn.disabled      = true;
  btn.textContent   = 'Adding…';

  if (mealId) {
    // Editing: persist immediately
    const r = await fetch('api/meal-items.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:      'add',
        meal_id:     mealId,
        name:        item.name,
        fdcId:       item.fdcId,
        calories:    item.calories,
        protein:     item.protein,
        carbs:       item.carbs,
        fat:         item.fat,
        grams:       item.grams,
        serving_desc: item.servingDesc,
      }),
    });
    const j = await r.json();
    if (j.ok) item.id = j.data.id;
  } else {
    // Creating: cache locally until Save
    item.tempId = ++tempCounter;
  }

  mealItems.push(item);
  btn.disabled    = false;
  btn.textContent = 'Add to Meal';
  closeAddModal();
  renderItemsList();
}

// ---- Save meal ----

async function saveMeal() {
  const nameEl = document.getElementById('meal-name');
  const name   = (nameEl?.value || '').trim();
  const status = document.getElementById('meal-save-status');

  if (!name) {
    if (nameEl) { nameEl.focus(); nameEl.classList.add('input-error'); }
    if (status) status.textContent = 'Please enter a meal name.';
    return;
  }
  if (nameEl) nameEl.classList.remove('input-error');

  const btn       = document.getElementById('save-meal-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  if (mealId) {
    // Editing: update name only (items already saved in real time)
    await fetch('api/meals.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'update', id: mealId, name }),
    });
  } else {
    // Creating: create the meal then batch-add items
    const cr = await fetch('api/meals.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'create', name }),
    });
    const cj = await cr.json();
    if (!cj.ok) {
      btn.disabled    = false;
      btn.textContent = 'Save Meal';
      if (status) status.textContent = 'Could not save. Please try again.';
      return;
    }
    mealId = cj.data.id;

    for (const item of mealItems) {
      await fetch('api/meal-items.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:       'add',
          meal_id:      mealId,
          name:         item.name,
          fdcId:        item.fdcId,
          calories:     item.calories,
          protein:      item.protein,
          carbs:        item.carbs,
          fat:          item.fat,
          grams:        item.grams,
          serving_desc: item.servingDesc,
        }),
      });
    }
  }

  window.location.href = 'meals.html';
}

// ============================================================
// Food Search Modal (same logic as log-ration.js)
// ============================================================

async function searchUSDA(query) {
  if (query in searchCache) return searchCache[query];
  const r = await fetch(`api/food-search.php?query=${encodeURIComponent(query)}&pageSize=50`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data  = await r.json();
  const foods = data.foods || [];
  if (foods.length) searchCache[query] = foods;
  return foods;
}

async function searchAI(query) {
  if (query in aiSearchCache) return aiSearchCache[query];
  const r = await fetch(`api/claude-food-search.php?query=${encodeURIComponent(query)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'AI error');
  if (j.data.length) aiSearchCache[query] = j.data;
  return j.data;
}

function renderEmpty(msg) {
  return Object.assign(document.createElement('p'), { className: 'food-empty', textContent: msg });
}

function makeFoodRow(food) {
  const row = document.createElement('div');
  row.className = 'food-item';
  const serving = food.serving_desc
    ? esc(food.serving_desc) + ' · per serving'
    : (food.brand ? esc(food.brand) + ' · ' : '') + 'per 100g';
  row.innerHTML = `
    <div class="food-item-info">
      <span class="food-item-name">${esc(food.name)} <span class="food-item-cals">(${Math.round(food.calories).toLocaleString()} cal)</span></span>
      <span class="food-item-macros">P: ${food.protein}g &middot; C: ${food.carbs}g &middot; F: ${food.fat}g &middot; ${serving}</span>
    </div>
    <button class="food-add-btn" aria-label="Add ${esc(food.name)}">Add</button>
  `;
  row.querySelector('.food-add-btn').addEventListener('click', () => showFoodDetail(food));
  return row;
}

function renderSection(title, foods) {
  const wrap = document.createElement('div');
  const hdr  = Object.assign(document.createElement('p'), { className: 'food-section-label', textContent: title });
  wrap.appendChild(hdr);
  foods.forEach(f => wrap.appendChild(makeFoodRow(f)));
  return wrap;
}

function showFoodDetail(food) {
  currentFood     = food;
  currentServings = 1;

  document.getElementById('food-detail-name').textContent = food.name;
  const perEl = document.getElementById('food-detail-per');
  if (perEl) perEl.textContent = food.serving_desc ? `Per serving · ${food.serving_desc}` : 'Per serving · 100g';

  document.getElementById('food-detail-macros').innerHTML = `
    <div class="macro-box macro-box--cal">
      <span class="macro-val">${Math.round(food.calories).toLocaleString()}</span>
      <span class="macro-lbl">cal</span>
    </div>
    <div class="macro-box">
      <span class="macro-val">${food.protein}g</span>
      <span class="macro-lbl">protein</span>
    </div>
    <div class="macro-box">
      <span class="macro-val">${food.carbs}g</span>
      <span class="macro-lbl">carbs</span>
    </div>
    <div class="macro-box">
      <span class="macro-val">${food.fat}g</span>
      <span class="macro-lbl">fat</span>
    </div>
  `;
  updateDetailTotals();
  document.getElementById('food-detail-panel').classList.add('active');
}

function hideFoodDetail() {
  document.getElementById('food-detail-panel').classList.remove('active');
}

function updateDetailTotals() {
  const qtyEl = document.getElementById('qty-display');
  if (qtyEl) qtyEl.textContent = Number.isInteger(currentServings) ? String(currentServings) : currentServings.toFixed(1);
  if (!currentFood) return;
  const cal = Math.round(currentFood.calories * currentServings);
  const pro = Math.round(currentFood.protein  * currentServings * 10) / 10;
  const car = Math.round(currentFood.carbs    * currentServings * 10) / 10;
  const fat = Math.round(currentFood.fat      * currentServings * 10) / 10;
  const el  = document.getElementById('food-detail-totals');
  if (el) el.innerHTML = `
    <div class="food-detail-total-box">
      <span class="detail-total-cal">${cal.toLocaleString()} cal</span>
      <span class="detail-total-macros">P: ${pro}g · C: ${car}g · F: ${fat}g</span>
    </div>
  `;
}

function showLocalMatches(query) {
  const pane = document.getElementById('ration-content');
  pane.innerHTML = '';
  if (searchMode === 'ai') {
    pane.appendChild(renderAiSearchPrompt(query));
  } else {
    pane.appendChild(renderSearchPrompt(query));
  }
}

function renderSearchPrompt(query) {
  const wrap = document.createElement('div');
  wrap.className = 'food-search-prompt';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'food-search-prompt-btn';
  btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Search the food database for "${esc(query)}"`;
  btn.addEventListener('click', () => runUsdaSearch(query));
  wrap.appendChild(btn);
  return wrap;
}

function renderAiSearchPrompt(query) {
  const wrap = document.createElement('div');
  wrap.className = 'food-search-prompt';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'food-search-prompt-btn food-search-prompt-btn--ai';
  btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Ask the Wizard for "${esc(query)}"`;
  btn.addEventListener('click', () => runAiSearch(query));
  wrap.appendChild(btn);
  return wrap;
}

async function runUsdaSearch(rawQuery) {
  const query = (rawQuery || '').trim();
  if (query.length < 2) return;
  const seq  = ++searchSeq;
  const pane = document.getElementById('ration-content');
  const render = node => { if (seq === searchSeq) { pane.innerHTML = ''; pane.appendChild(node); } };
  render(renderEmpty('Searching the food database…'));
  try {
    const foods = await searchUSDA(query);
    if (!foods.length) { render(renderEmpty(`No results found for "${query}".`)); return; }
    render(renderSection('USDA Food Database', foods));
  } catch (e) {
    render(renderEmpty('The food database is unavailable right now.'));
  }
}

async function runAiSearch(rawQuery) {
  const query = (rawQuery || '').trim();
  if (query.length < 2) return;
  const seq  = ++searchSeq;
  const pane = document.getElementById('ration-content');
  const render = node => { if (seq === searchSeq) { pane.innerHTML = ''; pane.appendChild(node); } };
  render(renderEmpty('Consulting the Wizard…'));
  try {
    const foods = await searchAI(query);
    if (!foods.length) { render(renderEmpty(`No Wizard results found for "${query}".`)); return; }
    render(renderSection('Wizard Suggestions', foods));
  } catch (e) {
    render(renderEmpty('Wizard Search is unavailable right now.'));
  }
}

function syncModePills() {
  document.getElementById('mode-ai')?.classList.toggle('mode-pill--active',   searchMode === 'ai');
  document.getElementById('mode-usda')?.classList.toggle('mode-pill--active', searchMode === 'usda');
}

// ---- Modal open / close ----

function openAddModal() {
  const modal = document.getElementById('ration-modal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  hideFoodDetail();
  syncModePills();
  const input = document.getElementById('ration-search');
  if (input) { input.value = ''; }
  document.getElementById('ration-content').innerHTML = '';
  setTimeout(() => input?.focus(), 350);
}

function closeAddModal() {
  document.getElementById('ration-modal').classList.remove('open');
  document.body.style.overflow = '';
  searchSeq++;
  hideFoodDetail();
}

// ---- Init ----

async function initMealEdit() {
  const params  = new URLSearchParams(window.location.search);
  const idParam = params.get('id');

  if (idParam) {
    mealId = parseInt(idParam, 10);
    document.getElementById('meal-edit-title').textContent = 'Edit Meal';

    // Load meal name from list endpoint
    const mr = await fetch('api/meals.php');
    const mj = await mr.json();
    const meal = mj.ok ? mj.data.find(m => m.id === mealId) : null;
    if (!meal) { window.location.href = 'meals.html'; return; }
    document.getElementById('meal-name').value = meal.name;

    // Load items
    const ir = await fetch(`api/meal-items.php?meal_id=${mealId}`);
    const ij = await ir.json();
    if (ij.ok) {
      mealItems = ij.data.map(i => ({
        id:          i.id,
        name:        i.name,
        fdcId:       i.fdcId,
        calories:    i.calories,
        protein:     i.protein,
        carbs:       i.carbs,
        fat:         i.fat,
        grams:       i.grams,
        servingDesc: i.servingDesc,
      }));
    }
  }

  renderItemsList();

  // Add Ration button
  document.getElementById('add-food-btn')?.addEventListener('click', openAddModal);

  // Save button
  document.getElementById('save-meal-btn')?.addEventListener('click', saveMeal);

  // Modal close
  const modal = document.getElementById('ration-modal');
  document.getElementById('ration-close')?.addEventListener('click', closeAddModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeAddModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) closeAddModal();
  });

  // Mode toggle
  const searchInput = document.getElementById('ration-search');
  document.getElementById('mode-ai')?.addEventListener('click', () => {
    searchMode = 'ai'; syncModePills();
    const q = searchInput?.value.trim();
    if (q && q.length >= 2) showLocalMatches(q);
  });
  document.getElementById('mode-usda')?.addEventListener('click', () => {
    searchMode = 'usda'; syncModePills();
    const q = searchInput?.value.trim();
    if (q && q.length >= 2) showLocalMatches(q);
  });

  // Search input
  let searchTimer = null;
  searchInput?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (!q) { document.getElementById('ration-content').innerHTML = ''; return; }
    if (q.length < 2) return;
    searchTimer = setTimeout(() => showLocalMatches(q), 120);
  });
  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchMode === 'ai') runAiSearch(searchInput.value);
      else runUsdaSearch(searchInput.value);
    }
  });
  document.getElementById('ration-search-go')?.addEventListener('click', () => {
    if (searchMode === 'ai') runAiSearch(searchInput?.value || '');
    else runUsdaSearch(searchInput?.value || '');
  });

  // Food detail
  document.getElementById('food-detail-back')?.addEventListener('click', hideFoodDetail);
  document.getElementById('qty-minus')?.addEventListener('click', () => {
    if (currentServings > 0.5) currentServings = Math.round((currentServings - 0.5) * 10) / 10;
    else if (currentServings > 0.1) currentServings = Math.round((currentServings - 0.1) * 10) / 10;
    updateDetailTotals();
  });
  document.getElementById('qty-plus')?.addEventListener('click', () => {
    if (currentServings < 0.5) currentServings = Math.round((currentServings + 0.1) * 10) / 10;
    else currentServings = Math.round((currentServings + 0.5) * 10) / 10;
    updateDetailTotals();
  });
  document.getElementById('food-log-btn')?.addEventListener('click', addFoodToMeal);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('meal-edit-page')) return;

  // Guild check
  const ur = await fetch('api/user.php');
  const uj = await ur.json();
  if (!uj.ok || !uj.data.isPremium) {
    window.location.href = 'index.html';
    return;
  }

  await initMealEdit();
});
