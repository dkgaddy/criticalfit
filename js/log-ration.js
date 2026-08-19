// ============================================================
// Critical Fit — Log Ration Modal
// ============================================================

const SEARCH_ENDPOINT = 'api/food-search.php';

// ---- Detail panel state ----

let currentFood     = null;
let currentServings = 1;

// ---- Log a food entry (servings-based, 1 serving = 100g) ----

async function logFoodEntry(food, servings) {
  const entry = {
    fdcId:    food.fdcId,
    name:     food.name,
    grams:    Math.round(servings * 100),
    calories: Math.round(food.calories * servings),
    protein:  Math.round(food.protein  * servings * 10) / 10,
    carbs:    Math.round(food.carbs    * servings * 10) / 10,
    fat:      Math.round(food.fat      * servings * 10) / 10,
    date:     viewingDate,
  };
  await store.addFoodEntry(entry);
  await store.saveRecentFood(food);
  return entry;
}

// ---- USDA search via PHP proxy ----

const searchCache = {};

// Throws on network/API failure so callers can distinguish "the database is
// unavailable" from "no matches" — the two used to look identical (empty list),
// which made transient rate-limit errors masquerade as empty results.
async function searchUSDA(query) {
  if (query in searchCache) return searchCache[query];
  const res = await fetch(`${SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&pageSize=50`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data  = await res.json();
  const foods = data.foods || [];
  if (foods.length > 0) searchCache[query] = foods; // only cache successful results
  return foods;
}

// Recent/logged foods, cached when the modal opens so typing filters them
// instantly with no network round-trip.
let recentFoods = [];

async function loadRecentFoods() {
  recentFoods = await store.getRecentFoods();
  return recentFoods;
}

// ---- Escape HTML ----

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ---- Food Detail Panel ----

function showFoodDetail(food) {
  currentFood     = food;
  currentServings = 1;

  document.getElementById('food-detail-name').textContent = food.name;

  const macroEl = document.getElementById('food-detail-macros');
  macroEl.innerHTML = `
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
  if (qtyEl) {
    qtyEl.textContent = Number.isInteger(currentServings)
      ? String(currentServings)
      : currentServings.toFixed(1);
  }

  if (!currentFood) return;
  const cal = Math.round(currentFood.calories * currentServings);
  const pro = Math.round(currentFood.protein  * currentServings * 10) / 10;
  const car = Math.round(currentFood.carbs    * currentServings * 10) / 10;
  const fat = Math.round(currentFood.fat      * currentServings * 10) / 10;

  const totalsEl = document.getElementById('food-detail-totals');
  if (totalsEl) {
    totalsEl.innerHTML = `
      <div class="food-detail-total-box">
        <span class="detail-total-cal">${cal.toLocaleString()} cal</span>
        <span class="detail-total-macros">P: ${pro}g · C: ${car}g · F: ${fat}g</span>
      </div>
    `;
  }
}

// ---- Energy Stored Toast ----

function showEnergyToast() {
  const toast = document.getElementById('energy-toast');
  if (!toast) return;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ---- Render a single food row ----

function makeFoodRow(food) {
  const row = document.createElement('div');
  row.className = 'food-item';

  const brand = food.brand ? ` · ${esc(food.brand)}` : '';
  row.innerHTML = `
    <div class="food-item-info">
      <span class="food-item-name">${esc(food.name)} <span class="food-item-cals">(${Math.round(food.calories).toLocaleString()} cal)</span></span>
      <span class="food-item-macros">P: ${food.protein}g &middot; C: ${food.carbs}g &middot; F: ${food.fat}g${brand} &middot; per 100g</span>
    </div>
    <button class="food-add-btn" aria-label="Add ${esc(food.name)}">Add</button>
  `;

  row.querySelector('.food-add-btn').addEventListener('click', () => showFoodDetail(food));
  return row;
}

// ---- Helpers ----

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Convert a logged entry (with actual grams/calories) back to per-100g food object
function entryToFood(entry) {
  if (!entry.grams || entry.grams === 0) return null;
  const f = 100 / entry.grams;
  return {
    fdcId:    entry.fdcId,
    name:     entry.name,
    calories: Math.round(entry.calories * f * 10) / 10,
    protein:  entry.protein != null ? Math.round(entry.protein * f * 100) / 100 : 0,
    carbs:    entry.carbs   != null ? Math.round(entry.carbs   * f * 100) / 100 : 0,
    fat:      entry.fat     != null ? Math.round(entry.fat     * f * 100) / 100 : 0,
    brand:    null,
  };
}

// ---- Render content pane ----

function renderEmpty(msg) {
  return Object.assign(document.createElement('p'), {
    className: 'food-empty',
    textContent: msg,
  });
}

function renderSection(title, foods) {
  const wrap = document.createElement('div');
  const hdr  = document.createElement('p');
  hdr.className   = 'food-section-label';
  hdr.textContent = title;
  wrap.appendChild(hdr);
  foods.forEach(f => wrap.appendChild(makeFoodRow(f)));
  return wrap;
}

async function showDefault() {
  const pane = document.getElementById('ration-content');
  pane.innerHTML = '';

  const yesterdayEntries = await store.getFoodEntries(yesterdayKey());
  const recent           = recentFoods;

  const yesterdayFoods = yesterdayEntries.map(entryToFood).filter(Boolean);

  if (yesterdayFoods.length === 0 && recent.length === 0) {
    pane.appendChild(renderEmpty('No recent rations. Search above to get started.'));
    return;
  }

  if (yesterdayFoods.length > 0) {
    pane.appendChild(renderSection("Yesterday's Rations", yesterdayFoods));
  }

  // Show recent foods not already in yesterday's list
  const yesterdayNames = new Set(yesterdayFoods.map(f => f.name));
  const extras = recent.filter(f => !yesterdayNames.has(f.name));
  if (extras.length > 0) {
    pane.appendChild(renderSection('Recent Rations', extras));
  }
}

// Filter the cached recent/logged foods locally as the user types. No network
// call — the USDA database search only runs on Enter / the Go button.
function localMatches(query) {
  const q = query.toLowerCase();
  return recentFoods.filter(f => f.name.toLowerCase().includes(q));
}

function renderSearchPrompt(query) {
  const wrap = document.createElement('div');
  wrap.className = 'food-search-prompt';
  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'food-search-prompt-btn';
  btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i>Search the food database for “${esc(query)}”`;
  btn.addEventListener('click', () => runUsdaSearch(query));
  wrap.appendChild(btn);
  return wrap;
}

function renderSearchError(query) {
  const wrap = document.createElement('div');
  wrap.className = 'food-search-prompt';
  const msg = document.createElement('p');
  msg.className   = 'food-empty';
  msg.style.padding = '0 0 0.75rem';
  msg.textContent = 'The food database is unavailable right now.';
  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'food-search-prompt-btn';
  btn.textContent = 'Tap to retry';
  btn.addEventListener('click', () => runUsdaSearch(query));
  wrap.appendChild(msg);
  wrap.appendChild(btn);
  return wrap;
}

function showLocalMatches(query) {
  const pane   = document.getElementById('ration-content');
  const recent = localMatches(query);

  pane.innerHTML = '';
  if (recent.length) pane.appendChild(renderSection('Recent Rations', recent));
  pane.appendChild(renderSearchPrompt(query));
}

// Guards against out-of-order responses: only the most recent search renders.
let searchSeq = 0;

async function runUsdaSearch(rawQuery) {
  const query = (rawQuery || '').trim();
  if (query.length < 2) return;

  const seq    = ++searchSeq;
  const pane   = document.getElementById('ration-content');
  const recent = localMatches(query);

  const render = (dbNode) => {
    if (seq !== searchSeq) return; // a newer search superseded this one
    pane.innerHTML = '';
    if (recent.length) pane.appendChild(renderSection('Recent Rations', recent));
    pane.appendChild(dbNode);
  };

  render(renderEmpty('Searching the food database…'));

  let usda;
  try {
    usda = await searchUSDA(query);
  } catch (err) {
    console.warn('Food search error:', err.message);
    render(renderSearchError(query));
    return;
  }

  const recentIds = new Set(recent.map(f => f.fdcId));
  const fresh     = usda.filter(f => !recentIds.has(f.fdcId));

  if (fresh.length === 0) {
    render(renderEmpty(recent.length
      ? `No additional matches in the food database for “${esc(query)}”.`
      : `No results found for “${esc(query)}”.`));
    return;
  }

  render(renderSection('USDA Food Database', fresh));
}

// ---- Modal open / close ----

async function openModal() {
  const modal = document.getElementById('ration-modal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  hideFoodDetail();
  const input = document.getElementById('ration-search');
  input.value = '';
  await loadRecentFoods();
  showDefault();
  setTimeout(() => input.focus(), 350);
}

function closeModal() {
  document.getElementById('ration-modal').classList.remove('open');
  document.body.style.overflow = '';
  searchSeq++; // invalidate any in-flight database search
  hideFoodDetail();
}

// ---- Live local filtering (USDA search deferred to Enter / Go) ----

let searchTimer = null;

function handleSearchInput(val) {
  clearTimeout(searchTimer);
  const q = val.trim();
  if (!q) { showDefault(); return; }
  if (q.length < 2) return;
  // Tiny debounce just to coalesce rapid keystrokes; this only touches the
  // in-memory recent-foods list, so it never hits the network.
  searchTimer = setTimeout(() => showLocalMatches(q), 120);
}

// ---- Init ----

function initLogRation() {
  document.querySelectorAll('a[href="log-ration.html"]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); checkPastDay(openModal); });
  });

  const modal       = document.getElementById('ration-modal');
  const closeBtn    = document.getElementById('ration-close');
  const searchInput = document.getElementById('ration-search');

  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) closeModal();
  });

  searchInput?.addEventListener('input', e => handleSearchInput(e.target.value));
  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); runUsdaSearch(searchInput.value); }
  });
  document.getElementById('ration-search-go')?.addEventListener('click', () => {
    runUsdaSearch(searchInput.value);
  });

  document.getElementById('food-detail-back')?.addEventListener('click', hideFoodDetail);

  document.getElementById('qty-minus')?.addEventListener('click', () => {
    if (currentServings > 0.5) {
      currentServings = Math.round((currentServings - 0.5) * 10) / 10;
    } else if (currentServings > 0.1) {
      currentServings = Math.round((currentServings - 0.1) * 10) / 10;
    }
    updateDetailTotals();
  });

  document.getElementById('qty-plus')?.addEventListener('click', () => {
    if (currentServings < 0.5) {
      currentServings = Math.round((currentServings + 0.1) * 10) / 10;
    } else {
      currentServings = Math.round((currentServings + 0.5) * 10) / 10;
    }
    updateDetailTotals();
  });

  document.getElementById('food-log-btn')?.addEventListener('click', async () => {
    if (!currentFood) return;
    const btn = document.getElementById('food-log-btn');
    btn.disabled    = true;
    btn.textContent = 'Saving…';
    await logFoodEntry(currentFood, currentServings);
    btn.disabled    = false;
    btn.textContent = 'Log It';
    closeModal();
    showEnergyToast();
    if (typeof refreshHomeForToday === 'function') await refreshHomeForToday();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('home-page')) initLogRation();
});
