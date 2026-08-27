// ============================================================
// Critical Fit — App Logic
// ============================================================

const DRAGON_STAGES = [
  { level: 0, title: 'Hatchling',      days: 0,  img: 'images/Dragon_Lvl0.png' },
  { level: 1, title: 'Wyrmling',       days: 1,  img: 'images/Dragon_Lvl1.png' },
  { level: 2, title: 'Drake',          days: 15, img: 'images/Dragon_Lvl2.png' },
  { level: 3, title: 'Guardian',       days: 30, img: 'images/Dragon_Lvl3.png' },
  { level: 4, title: 'Elder Dragon',   days: 45, img: 'images/Dragon_Lvl4.png' },
  { level: 5, title: 'Ancient Dragon', days: 60, img: 'images/Dragon_Lvl5.png' },
];

// ---- API storage layer ----

const store = {
  getUser: async () => {
    const r = await fetch('api/user.php');
    const j = await r.json();
    return j.ok ? j.data : null;
  },

  saveUser: async (profile) => {
    await fetch('api/user.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(profile),
    });
  },

  getDailySummary: async (date) => {
    const r = await fetch(`api/daily.php?date=${date}`);
    const j = await r.json();
    return j.ok ? j.data : { caloriesIn: 0, caloriesOut: 0 };
  },

  getDragonProgress: async () => {
    const r = await fetch(`api/dragon.php?today=${todayKey()}`);
    const j = await r.json();
    return j.ok ? j.data : { streak: 0, maxLevel: 0 };
  },

  saveDragonProgress: async (progress) => {
    await fetch('api/dragon.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(progress),
    });
  },

  getRecentSummaries: async (days) => {
    const r = await fetch(`api/summaries.php?days=${days}`);
    const j = await r.json();
    return j.ok ? j.data : [];
  },

  getFoodEntries: async (date) => {
    const r = await fetch(`api/food.php?date=${date}`);
    const j = await r.json();
    return j.ok ? j.data : [];
  },

  addFoodEntry: async (entry) => {
    const r = await fetch('api/food.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(entry),
    });
    const j = await r.json();
    return j.ok ? j.data : null;
  },

  getExerciseEntries: async (date) => {
    const r = await fetch(`api/exercise.php?date=${date}`);
    const j = await r.json();
    return j.ok ? j.data : [];
  },

  addExerciseEntry: async (entry) => {
    const r = await fetch('api/exercise.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(entry),
    });
    const j = await r.json();
    return j.ok ? j.data : null;
  },

  getRecentFoods: async () => {
    const r = await fetch('api/recent-foods.php');
    const j = await r.json();
    return j.ok ? j.data : [];
  },

  saveRecentFood: async (food) => {
    await fetch('api/recent-foods.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(food),
    });
  },

  getMeals: async () => {
    const r = await fetch('api/meals.php');
    const j = await r.json();
    return j.ok ? j.data : [];
  },
};

// ---- Module-level state ----

let viewingDate          = '';
let cachedUser           = null;
let cachedPersonalTdee   = null;
let cachedSummaries      = [];
let cachedExercise  = [];
let cachedFood      = [];
let cachedSummary   = { caloriesIn: 0, caloriesOut: 0 };
let energyTickTimer = null;

// ---- Helpers ----

function todayKey(d = new Date()) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

function fmtCal(n) {
  return Math.round(Math.abs(n)).toLocaleString();
}

function getDragonStage(level) {
  return DRAGON_STAGES.find(s => s.level === level) || DRAGON_STAGES[0];
}

// ---- Past-Day Confirmation ----

let _pendingLogFn = null;

function checkPastDay(openFn) {
  if (!cachedUser?.dailyGoal) {
    document.getElementById('profile-alert-modal')?.classList.add('open');
    return;
  }
  if (viewingDate === todayKey()) {
    openFn();
    return;
  }
  _pendingLogFn = openFn;
  const bodyEl = document.getElementById('past-day-body');
  if (bodyEl) {
    const d   = new Date(viewingDate + 'T12:00:00');
    const lbl = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    bodyEl.textContent = `You are currently viewing ${lbl}'s log. Do you wish to modify it or log on today?`;
  }
  document.getElementById('past-day-modal')?.classList.add('open');
}

function closePastDayModal() {
  document.getElementById('past-day-modal')?.classList.remove('open');
  _pendingLogFn = null;
}

async function _pastDayGoToday(fn) {
  viewingDate = todayKey();
  const [summary, food, exercise] = await Promise.all([
    store.getDailySummary(viewingDate),
    store.getFoodEntries(viewingDate),
    store.getExerciseEntries(viewingDate),
  ]);
  cachedExercise = exercise;
  cachedFood     = food;
  cachedSummary  = summary;
  renderWeekNav();
  renderEnergyBalance(summary, cachedUser);
  renderEnergyUsed();
  renderJournalEntries(food, exercise);
  fn();
}

function initProfileAlert() {
  const overlay = document.getElementById('profile-alert-modal');
  document.getElementById('profile-alert-dismiss')?.addEventListener('click', () => {
    overlay?.classList.remove('open');
  });
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
}

function initPastDayModal() {
  document.getElementById('past-day-modify')?.addEventListener('click', () => {
    const fn = _pendingLogFn;
    closePastDayModal();
    fn?.();
  });
  document.getElementById('past-day-today')?.addEventListener('click', async () => {
    const fn = _pendingLogFn;
    closePastDayModal();
    if (fn) await _pastDayGoToday(fn);
  });
  document.getElementById('past-day-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('past-day-modal')) closePastDayModal();
  });
}

// ---- Dragon Evolution Progress Bar ----

const EVO_MILESTONES = [
  { days: 1,  tid: 'evo-t1',  lid: 'evo-l1'  },
  { days: 15, tid: 'evo-t15', lid: 'evo-l15' },
  { days: 30, tid: 'evo-t30', lid: 'evo-l30' },
  { days: 45, tid: 'evo-t45', lid: 'evo-l45' },
  { days: 60, tid: 'evo-t60', lid: 'evo-l60' },
];
const EVO_MAX = 60;

function renderEvoBar(dragon) {
  const totalDays = dragon?.totalLoggedDays || 0;
  const fillPct   = Math.min((totalDays / EVO_MAX) * 100, 100);

  const fillEl = document.getElementById('evo-fill');
  if (fillEl) fillEl.style.width = fillPct + '%';

  EVO_MILESTONES.forEach(({ days, tid, lid }) => {
    const reached = totalDays >= days;
    document.getElementById(tid)?.classList.toggle('evo-tick--done', reached);
    document.getElementById(lid)?.classList.toggle('evo-lbl--done', reached);
  });

  const captionEl = document.getElementById('evo-caption');
  if (!captionEl) return;

  if (totalDays >= EVO_MAX) {
    captionEl.textContent = 'Ancient Dragon — Journey Complete!';
  } else {
    const next = DRAGON_STAGES.find(s => s.days > totalDays);
    if (next) {
      const rem = next.days - totalDays;
      captionEl.textContent = `${rem} day${rem === 1 ? '' : 's'} remaining until ${next.title}`;
    }
  }
}

// ---- Level-up Modal ----

function showLevelUp(dragon) {
  const overlay  = document.getElementById('levelup-overlay');
  const imgEl    = document.getElementById('levelup-dragon-img');
  const headEl   = document.getElementById('levelup-headline');
  const nextEl   = document.getElementById('levelup-next');
  const dismissEl = document.getElementById('levelup-dismiss');
  if (!overlay) return;

  const stage = getDragonStage(dragon.currentLevel);

  if (imgEl) imgEl.src = stage.img;
  if (headEl) headEl.textContent = `Your dragon has been promoted to ${stage.title}!`;
  if (nextEl) {
    if (dragon.daysToNext !== null && dragon.daysToNext > 0) {
      nextEl.textContent = `Next promotion after logging in your journal ${dragon.daysToNext} more day${dragon.daysToNext === 1 ? '' : 's'}!`;
    } else if (dragon.daysToNext === 0) {
      nextEl.textContent = 'You are ready for the next promotion!';
    } else {
      nextEl.textContent = 'Your dragon has reached the highest level. Legendary!';
    }
  }

  overlay.classList.add('show');

  if (dismissEl) {
    dismissEl.onclick = () => overlay.classList.remove('show');
  }
}

// ---- Dragon ----

function renderDragon(dragon, user) {
  const stage = getDragonStage(dragon.currentLevel ?? 0);
  const dragonImg    = document.getElementById('dragon-img');
  const dragonTitle  = document.getElementById('dragon-title');
  const dragonStreak = document.getElementById('dragon-streak');
  const dragonName   = document.getElementById('dragon-user-name');
  if (dragonImg)    dragonImg.src = stage.img;
  if (dragonTitle)  dragonTitle.textContent = stage.title;
  if (dragonStreak) {
    const days = dragon.totalLoggedDays ?? 0;
    dragonStreak.textContent = days === 0
      ? 'Beginning the Quest'
      : `${days} Day${days === 1 ? '' : 's'} Logged`;
  }
  if (dragonName) {
    dragonName.textContent = (user && (user.name || user.displayName)) || '';
  }
}

// ---- Week Navigator ----

function renderWeekNav() {
  const today   = todayKey();
  const strip   = document.getElementById('week-strip');
  const prevBtn = document.getElementById('prev-day');
  const nextBtn = document.getElementById('next-day');
  if (!strip || !prevBtn || !nextBtn) return;

  // Sunday of the week containing viewingDate
  const d  = new Date(viewingDate + 'T12:00:00');
  const ws = new Date(d);
  ws.setDate(d.getDate() - d.getDay());

  const loggedSet = new Set(
    cachedSummaries
      .filter(s => s.caloriesIn > 0 || s.caloriesOut > 0)
      .map(s => s.date)
  );

  const LTRS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  strip.innerHTML = LTRS.map((ltr, i) => {
    const day    = new Date(ws);
    day.setDate(ws.getDate() + i);
    const ds     = day.toISOString().slice(0, 10);
    const active = ds === viewingDate;
    const future = ds > today;
    const logged = loggedSet.has(ds);
    const cls    = ['week-day',
      active ? 'week-day--active' : '',
      logged ? 'week-day--logged' : '',
      future ? 'week-day--future' : '',
    ].filter(Boolean).join(' ');
    return `<div class="${cls}">
      <div class="week-day-dot"></div>
      <span class="week-day-lbl">${ltr}</span>
      <div class="week-day-ring">${logged ? '<i class="fa-solid fa-check"></i>' : ''}</div>
    </div>`;
  }).join('');

  prevBtn.disabled = ![...loggedSet].some(d => d < viewingDate);
  nextBtn.disabled = viewingDate >= today;
}

// ---- Energy Balance ----

function renderEnergyBalance(summary, user) {
  const caloriesIn = Math.round(summary.caloriesIn);
  const dailyGoal  = user && user.dailyGoal ? user.dailyGoal : null;
  const today      = todayKey();

  // Card title — changes when viewing a past day
  const titleEl = document.getElementById('energy-card-title');
  if (titleEl) {
    if (viewingDate === today) {
      titleEl.textContent = "Today's Energy Stored";
    } else {
      const d = new Date(viewingDate + 'T12:00:00');
      const day = d.toLocaleDateString('en-US', { weekday: 'long' });
      titleEl.textContent = `${day}'s Energy Stored`;
    }
  }

  // Calories consumed (big number)
  const calInEl = document.getElementById('cal-in');
  if (calInEl) calInEl.textContent = caloriesIn.toLocaleString();

  // "/ goal 🔥" label
  const goalEl = document.getElementById('energy-of-goal');
  if (goalEl) {
    goalEl.textContent = dailyGoal ? `/ ${dailyGoal.toLocaleString()}` : '';
  }

  // Remaining / over
  const deltaNumEl = document.getElementById('energy-delta-num');
  const deltaLblEl = document.getElementById('energy-delta-lbl');
  if (deltaNumEl && deltaLblEl) {
    if (dailyGoal) {
      const remaining = dailyGoal - caloriesIn;
      const isOver    = remaining < 0;
      deltaNumEl.textContent = Math.abs(remaining).toLocaleString();
      deltaNumEl.className   = 'energy-big' + (isOver ? ' energy-over' : '');
      deltaLblEl.textContent = isOver ? 'over' : 'left';
    } else {
      deltaNumEl.textContent = '';
      deltaLblEl.textContent = '';
    }
  }

  // Stacked macro bar
  const stackedEl = document.getElementById('energy-bar-stacked');
  if (stackedEl) {
    const pct = (dailyGoal && dailyGoal > 0)
      ? Math.min((caloriesIn / dailyGoal) * 100, 100)
      : 0;
    stackedEl.style.width = pct + '%';

    const carbG    = cachedFood.reduce((s, e) => s + (e.carbs   || 0), 0);
    const fatG     = cachedFood.reduce((s, e) => s + (e.fat     || 0), 0);
    const proteinG = cachedFood.reduce((s, e) => s + (e.protein || 0), 0);
    const carbCals    = carbG    * 4;
    const fatCals     = fatG     * 9;
    const proteinCals = proteinG * 4;
    const totalMacroCals = carbCals + fatCals + proteinCals;

    const carbSeg    = document.getElementById('bar-carbs');
    const fatSeg     = document.getElementById('bar-fat');
    const proteinSeg = document.getElementById('bar-protein');

    if (carbSeg && fatSeg && proteinSeg) {
      if (totalMacroCals > 0) {
        carbSeg.style.flexGrow    = carbCals;
        fatSeg.style.flexGrow     = fatCals;
        proteinSeg.style.flexGrow = proteinCals;
      } else {
        carbSeg.style.flexGrow    = 1;
        fatSeg.style.flexGrow     = 1;
        proteinSeg.style.flexGrow = 1;
      }
    }
  }
}

// ---- Energy Used ----

function renderEnergyUsed() {
  const titleEl    = document.getElementById('energy-used-card-title');
  const numEl      = document.getElementById('energy-used-num');
  const projEl     = document.getElementById('energy-used-of-projected');
  const deltaNumEl = document.getElementById('energy-used-delta-num');
  const deltaLblEl = document.getElementById('energy-used-delta-lbl');
  const barEl      = document.getElementById('energy-used-bar');
  if (!numEl) return;

  // No profile → placeholder
  if (!cachedUser || !cachedUser.bmr) {
    numEl.textContent = '—';
    if (projEl)     projEl.textContent     = '';
    if (deltaNumEl) deltaNumEl.textContent = '';
    if (deltaLblEl) deltaLblEl.textContent = 'Set up your profile to track energy';
    const lpVal = document.getElementById('lp-value');
    if (lpVal) lpVal.textContent = '—';
    return;
  }

  const state = calculateDailyEnergyState(
    cachedUser, new Date(), cachedExercise, cachedSummary.caloriesIn, viewingDate
  );

  // Card title
  const today = todayKey();
  if (titleEl) {
    if (viewingDate === today) {
      titleEl.textContent = "Today's Energy Used";
    } else {
      const d   = new Date(viewingDate + 'T12:00:00');
      const day = d.toLocaleDateString('en-US', { weekday: 'long' });
      titleEl.textContent = `${day}'s Energy Used`;
    }
  }

  const adjustedBurn = cachedPersonalTdee || cachedUser.tdee || state.baselineDailyBurn;

  numEl.textContent = state.energyUsedSoFar.toLocaleString();

  if (projEl) {
    projEl.textContent = `/ ${adjustedBurn.toLocaleString()}`;
  }

  if (state.isToday) {
    const needed = Math.max(0, adjustedBurn - state.energyUsedSoFar);
    if (deltaNumEl) deltaNumEl.textContent = needed.toLocaleString();
    if (deltaLblEl) deltaLblEl.textContent = 'needed';
  } else {
    if (deltaNumEl) deltaNumEl.textContent = '';
    if (deltaLblEl) deltaLblEl.textContent = '';
  }

  if (barEl) {
    const pct = adjustedBurn > 0
      ? Math.min((state.energyUsedSoFar / adjustedBurn) * 100, 100)
      : 0;
    barEl.style.width = pct + '%';
  }

  // Life Points = deficit (energy used − calories consumed)
  const lpVal  = document.getElementById('lp-value');
  const lpIcon = document.getElementById('lp-icon');
  if (lpVal && lpIcon) {
    const lp    = Math.round(state.energyUsedSoFar - state.caloriesConsumed);
    const hot   = lp >= 500;
    lpVal.textContent = Math.abs(lp).toLocaleString();
    lpVal.className   = 'lp-value' + (lp < 0 ? ' lp-negative' : '');
    lpIcon.src        = hot ? 'images/FireOn.png' : 'images/FireOff.png';
  }
}

// Real-time tick — updates Energy Used every 60 s while viewing today
function startEnergyTick() {
  if (energyTickTimer) clearInterval(energyTickTimer);
  energyTickTimer = setInterval(() => {
    if (viewingDate === todayKey() && cachedUser) renderEnergyUsed();
  }, 60_000);
}

// ---- Journal Entries ----

function renderJournalEntries(food, exercise) {
  const today     = todayKey();
  const titleEl   = document.getElementById('journal-date-title');
  const journalEl = document.getElementById('journal-entries');

  if (titleEl) {
    if (viewingDate === today) {
      titleEl.textContent = "Today's Quest Journal";
    } else {
      const d = new Date(viewingDate + 'T12:00:00');
      titleEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
  }

  if (!journalEl) return;

  if (food.length === 0 && exercise.length === 0) {
    const msg = viewingDate === today
      ? 'No rations recorded yet today.<br>Begin your quest.'
      : 'No entries for this day.';
    journalEl.innerHTML = `<p class="empty-state">${msg}</p>`;
    return;
  }

  const rows = [
    ...food.map(e => `
      <div class="journal-entry">
        <div class="entry-info">
          <span class="entry-name">${e.name}</span>
          <span class="entry-detail">${e.grams ? e.grams + 'g' : ''}</span>
        </div>
        <span class="entry-cal">${fmtCal(e.calories)} kcal</span>
      </div>`),
    ...exercise.map(e => `
      <div class="journal-entry">
        <div class="entry-info">
          <span class="entry-name">${e.name}</span>
          <span class="entry-detail">${e.duration ? e.duration + ' min · Activity' : 'Activity'}</span>
        </div>
        <span class="entry-cal burned">−${fmtCal(e.calories)} kcal</span>
      </div>`),
  ];
  journalEl.innerHTML = rows.join('');
}

// ---- Day Navigation ----

async function shiftDay(delta) {
  const d = new Date(viewingDate + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  viewingDate = d.toISOString().slice(0, 10);

  const [summary, food, exercise] = await Promise.all([
    store.getDailySummary(viewingDate),
    store.getFoodEntries(viewingDate),
    store.getExerciseEntries(viewingDate),
  ]);

  cachedExercise = exercise;
  cachedFood     = food;
  cachedSummary  = summary;

  renderWeekNav();
  renderEnergyBalance(summary, cachedUser);
  renderEnergyUsed();
  renderJournalEntries(food, exercise);
}

// ---- Home Screen ----

async function initHome() {
  viewingDate = todayKey();

  const [summary, dragon, food, exercise, summaries, user, tdeeData] = await Promise.all([
    store.getDailySummary(viewingDate),
    store.getDragonProgress(),
    store.getFoodEntries(viewingDate),
    store.getExerciseEntries(viewingDate),
    store.getRecentSummaries(90),
    store.getUser(),
    fetch('api/tdee.php').then(r => r.json()).catch(() => null),
  ]);

  cachedUser         = user;
  cachedPersonalTdee = tdeeData?.ok ? (tdeeData.data?.personalizedTdee ?? null) : null;
  cachedSummaries = summaries;
  cachedExercise  = exercise;
  cachedFood      = food;
  cachedSummary   = summary;

  renderDragon(dragon, user);
  renderWeekNav();
  renderEnergyBalance(summary, user);
  renderEnergyUsed();
  renderEvoBar(dragon);
  renderJournalEntries(food, exercise);
  initPastDayModal();
  initProfileAlert();

  if (dragon.promoted) showLevelUp(dragon);
}

// ---- Refresh today's data after logging ----

async function refreshHomeForToday() {
  viewingDate = todayKey();
  const [summary, food, exercise, summaries, dragon] = await Promise.all([
    store.getDailySummary(viewingDate),
    store.getFoodEntries(viewingDate),
    store.getExerciseEntries(viewingDate),
    store.getRecentSummaries(90),
    store.getDragonProgress(),
  ]);
  cachedSummaries = summaries;
  cachedExercise  = exercise;
  cachedFood      = food;
  cachedSummary   = summary;

  renderDragon(dragon, cachedUser);
  renderWeekNav();
  renderEnergyBalance(summary, cachedUser);
  renderEnergyUsed();
  renderEvoBar(dragon);
  renderJournalEntries(food, exercise);

  if (dragon.promoted) showLevelUp(dragon);
}

// ---- Service Worker ----

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('./sw.js').catch(console.error)
  );
}

// ---- Splash Screen ----

function initSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  const today = todayKey();
  if (localStorage.getItem('cf_splash_date') === today) {
    splash.remove();
    return;
  }

  localStorage.setItem('cf_splash_date', today);
  setTimeout(() => {
    splash.classList.add('fade-out');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }, 5000);
}

// ---- On-screen keyboard handling ----
// iOS doesn't shrink the layout viewport when the keyboard appears, so a
// bottom-anchored modal ends up hidden behind it. Track the visual viewport
// and expose the keyboard height as --kb so the modal can size above it.
function initKeyboardViewport() {
  const vv = window.visualViewport;
  if (!vv) return;

  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', kb + 'px');
    document.body.classList.toggle('keyboard-open', kb > 120);
  };

  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('home-page')) {
    initSplash();
    initKeyboardViewport();
    await checkAuth();
    await initHome();
    document.getElementById('prev-day')?.addEventListener('click', () => shiftDay(-1));
    document.getElementById('next-day')?.addEventListener('click', () => shiftDay(1));
    startEnergyTick();
  }
});
