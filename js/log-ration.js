// ============================================================
// Critical Fit — Log Ration Modal
// ============================================================

const MAX_RECENT      = 20;
const DEBOUNCE_MS     = 420;
const SEARCH_ENDPOINT = 'api/food-search.php';

// ---- Recent foods (localStorage) ----

function getRecentFoods() {
  return JSON.parse(localStorage.getItem('cf_recent_foods') || '[]');
}

function saveToRecent(food) {
  let recent = getRecentFoods().filter(f => f.fdcId !== food.fdcId);
  recent.unshift({ ...food, usedAt: new Date().toISOString() });
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
  localStorage.setItem('cf_recent_foods', JSON.stringify(recent));
}

// ---- Log a food entry ----

function logFoodEntry(food, grams) {
  const ratio = grams / 100;
  const entry = {
    id:       Date.now(),
    fdcId:    food.fdcId,
    name:     food.name,
    grams,
    calories: Math.round(food.calories * ratio),
    protein:  Math.round(food.protein  * ratio * 10) / 10,
    carbs:    Math.round(food.carbs    * ratio * 10) / 10,
    fat:      Math.round(food.fat      * ratio * 10) / 10,
    loggedAt: new Date().toISOString(),
  };

  const today = new Date().toISOString().slice(0, 10);

  // Append to food log
  const foodLog = JSON.parse(localStorage.getItem('cf_food') || '{}');
  if (!foodLog[today]) foodLog[today] = [];
  foodLog[today].push(entry);
  localStorage.setItem('cf_food', JSON.stringify(foodLog));

  // Update daily summary
  const daily = JSON.parse(localStorage.getItem('cf_daily') || '{}');
  if (!daily[today]) daily[today] = { caloriesIn: 0, caloriesOut: 0 };
  daily[today].caloriesIn = (daily[today].caloriesIn || 0) + entry.calories;
  localStorage.setItem('cf_daily', JSON.stringify(daily));

  // Add to recent list
  saveToRecent(food);

  return entry;
}

// ---- USDA search via PHP proxy ----

const searchCache = {};

async function searchUSDA(query) {
  if (searchCache[query]) return searchCache[query];
  try {
    const res = await fetch(`${SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&pageSize=25`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    searchCache[query] = data.foods || [];
    return searchCache[query];
  } catch (err) {
    console.warn('Food search error:', err.message);
    return [];
  }
}

// ---- Escape HTML ----

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ---- Render a single food row ----

function makeFoodRow(food) {
  const row = document.createElement('div');
  row.className = 'food-item';

  const brand = food.brand ? ` · ${esc(food.brand)}` : '';
  row.innerHTML = `
    <div class="food-item-info">
      <span class="food-item-name">${esc(food.name)} <span class="food-item-cals">(${food.calories.toLocaleString()} cals)</span></span>
      <span class="food-item-macros">P: ${food.protein}g &middot; C: ${food.carbs}g &middot; F: ${food.fat}g${brand} &middot; per 100g</span>
    </div>
    <button class="food-add-btn" aria-label="Add ${esc(food.name)}">Add</button>
  `;

  row.querySelector('.food-add-btn').addEventListener('click', () => expandRow(row, food));
  return row;
}

// ---- Inline quantity expander ----

function expandRow(row, food) {
  // Collapse any other open expander
  document.querySelectorAll('.food-item-expand').forEach(el => el.remove());
  document.querySelectorAll('.food-item.selected').forEach(el => el.classList.remove('selected'));

  row.classList.add('selected');

  const expand = document.createElement('div');
  expand.className = 'food-item-expand';
  expand.innerHTML = `
    <p class="expand-name">${esc(food.name)}</p>
    <div class="expand-row">
      <input type="number" class="qty-input" value="100" min="1" max="9999" inputmode="numeric" aria-label="Amount in grams">
      <span class="qty-unit">g</span>
      <span class="qty-total">${food.calories.toLocaleString()} cals</span>
      <button class="log-it-btn">Log It</button>
    </div>
  `;

  const qtyInput = expand.querySelector('.qty-input');
  const totalEl  = expand.querySelector('.qty-total');

  qtyInput.addEventListener('input', () => {
    const g   = parseFloat(qtyInput.value) || 0;
    const cal = Math.round(food.calories * g / 100);
    totalEl.textContent = `${cal.toLocaleString()} cals`;
  });

  expand.querySelector('.log-it-btn').addEventListener('click', () => {
    const g = parseFloat(qtyInput.value) || 100;
    if (g <= 0) return;
    logFoodEntry(food, g);
    closeModal();
    if (typeof initHome === 'function') initHome();
  });

  row.insertAdjacentElement('afterend', expand);
  qtyInput.focus();
  qtyInput.select();
}

// ---- Render content pane ----

function clearExpand() {
  document.querySelectorAll('.food-item-expand').forEach(el => el.remove());
  document.querySelectorAll('.food-item.selected').forEach(el => el.classList.remove('selected'));
}

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

function showRecent() {
  const pane   = document.getElementById('ration-content');
  const recent = getRecentFoods();
  pane.innerHTML = '';
  clearExpand();

  if (recent.length === 0) {
    pane.appendChild(renderEmpty('No recent rations. Search above to get started.'));
  } else {
    pane.appendChild(renderSection('Recent Rations', recent));
  }
}

function showLoading() {
  const pane = document.getElementById('ration-content');
  pane.innerHTML = '';
  pane.appendChild(renderEmpty('Searching…'));
}

async function showResults(query) {
  showLoading();
  const q      = query.toLowerCase();
  const recent = getRecentFoods().filter(f => f.name.toLowerCase().includes(q));
  const usda   = await searchUSDA(query);
  const recentIds = new Set(recent.map(f => f.fdcId));
  const fresh  = usda.filter(f => !recentIds.has(f.fdcId));

  const pane = document.getElementById('ration-content');
  pane.innerHTML = '';
  clearExpand();

  if (recent.length === 0 && fresh.length === 0) {
    pane.appendChild(renderEmpty(`No results found for "${esc(query)}".`));
    return;
  }

  if (recent.length) pane.appendChild(renderSection('Recent Rations', recent));
  if (fresh.length)  pane.appendChild(renderSection('USDA Food Database', fresh));
}

// ---- Modal open / close ----

function openModal() {
  const modal = document.getElementById('ration-modal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  const input = document.getElementById('ration-search');
  input.value = '';
  showRecent();
  setTimeout(() => input.focus(), 350);
}

function closeModal() {
  document.getElementById('ration-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ---- Debounced search ----

let searchTimer = null;

function handleSearchInput(val) {
  clearTimeout(searchTimer);
  if (!val.trim()) { showRecent(); return; }
  if (val.trim().length < 2) return;
  searchTimer = setTimeout(() => showResults(val.trim()), DEBOUNCE_MS);
}

// ---- Init ----

function initLogRation() {
  // Wire all "Log Ration" links to open the modal instead of navigating
  document.querySelectorAll('a[href="log-ration.html"]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openModal(); });
  });

  const modal      = document.getElementById('ration-modal');
  const closeBtn   = document.getElementById('ration-close');
  const searchInput= document.getElementById('ration-search');

  closeBtn?.addEventListener('click', closeModal);

  // Tap backdrop to close
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) closeModal();
  });

  searchInput?.addEventListener('input', e => handleSearchInput(e.target.value));
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('home-page')) initLogRation();
});
