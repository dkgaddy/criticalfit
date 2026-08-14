// ============================================================
// Critical Fit — App Logic
// ============================================================

const DRAGON_STAGES = [
  { level: 0, title: 'Hatchling',      days: 0,   img: 'images/Dragon_Lvl0.png' },
  { level: 1, title: 'Wyrmling',       days: 7,   img: 'images/Dragon_Lvl1.png' },
  { level: 2, title: 'Drake',          days: 21,  img: 'images/Dragon_Lvl2.png' },
  { level: 3, title: 'Guardian',       days: 45,  img: 'images/Dragon_Lvl3.png' },
  { level: 4, title: 'Elder Dragon',   days: 90,  img: 'images/Dragon_Lvl4.png' },
  { level: 5, title: 'Ancient Dragon', days: 180, img: 'images/Dragon_Lvl5.png' },
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
    const r = await fetch('api/dragon.php');
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
};

// ---- Module-level state ----

let viewingDate    = '';
let cachedUser     = null;
let cachedSummaries = [];

// ---- Helpers ----

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function fmtCal(n) {
  return Math.round(Math.abs(n)).toLocaleString();
}

function getDragonStage(streak) {
  let stage = DRAGON_STAGES[0];
  for (const s of DRAGON_STAGES) {
    if (streak >= s.days) stage = s;
  }
  return stage;
}

// ---- Quest Progress Chart ----

function renderChart(container, summaries) {
  const W = 300, H = 90, padX = 6, padY = 10;
  const n = summaries.length;
  const deficits = summaries.map(s => s.caloriesOut - s.caloriesIn);
  const maxAbs = Math.max(300, ...deficits.map(Math.abs));
  const midY = H / 2;

  const toX = i => padX + (n < 2 ? (W - padX * 2) / 2 : (i / (n - 1)) * (W - padX * 2));
  const toY = v => midY - (v / maxAbs) * (midY - padY);
  const pts = deficits.map((v, i) => [toX(i), toY(v)]);

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const defs = document.createElementNS(NS, 'defs');

  const mkClip = (id, y, h) => {
    const cp = document.createElementNS(NS, 'clipPath');
    cp.id = id;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', 0); r.setAttribute('y', y);
    r.setAttribute('width', W); r.setAttribute('height', h);
    cp.appendChild(r);
    return cp;
  };
  defs.appendChild(mkClip('cf-clip-above', 0, midY));
  defs.appendChild(mkClip('cf-clip-below', midY, H));
  svg.appendChild(defs);

  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${pts[n - 1][0].toFixed(1)},${midY} L${pts[0][0].toFixed(1)},${midY} Z`;

  const mkPath = (fill, clip) => {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('d', areaD);
    el.setAttribute('fill', fill);
    if (clip) el.setAttribute('clip-path', `url(#${clip})`);
    return el;
  };

  svg.appendChild(mkPath('rgba(86,98,70,0.2)', 'cf-clip-above'));
  svg.appendChild(mkPath('rgba(122,48,32,0.18)', 'cf-clip-below'));

  const base = document.createElementNS(NS, 'line');
  base.setAttribute('x1', padX); base.setAttribute('y1', midY);
  base.setAttribute('x2', W - padX); base.setAttribute('y2', midY);
  base.setAttribute('stroke', 'rgba(139,106,58,0.3)');
  base.setAttribute('stroke-width', '0.75');
  base.setAttribute('stroke-dasharray', '4,3');
  svg.appendChild(base);

  const line = document.createElementNS(NS, 'polyline');
  line.setAttribute('points', pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'rgba(86,98,70,0.8)');
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('stroke-linecap', 'round');
  svg.appendChild(line);

  pts.forEach(([x, y], i) => {
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', x.toFixed(1));
    dot.setAttribute('cy', y.toFixed(1));
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', deficits[i] >= 0 ? '#566246' : '#7A3020');
    svg.appendChild(dot);
  });

  container.innerHTML = '';
  container.appendChild(svg);
}

// ---- Level-up Toast ----

function showLevelUp(fromStage, toStage) {
  const overlay = document.getElementById('levelup-overlay');
  const msg = document.getElementById('levelup-message');
  if (!overlay || !msg) return;

  msg.innerHTML = `Your companion has grown.<br><br>
    Your <em>${fromStage.title}</em> has become a <em>${toStage.title}</em>.`;

  overlay.classList.add('show');

  overlay.querySelector('.levelup-dismiss').onclick = () => {
    overlay.classList.remove('show');
  };
}

// ---- Dragon ----

function renderDragon(dragon, user) {
  const stage = getDragonStage(dragon.streak);
  const dragonImg    = document.getElementById('dragon-img');
  const dragonTitle  = document.getElementById('dragon-title');
  const dragonStreak = document.getElementById('dragon-streak');
  const dragonName   = document.getElementById('dragon-user-name');
  if (dragonImg)    dragonImg.src = stage.img;
  if (dragonTitle)  dragonTitle.textContent = stage.title;
  if (dragonStreak) {
    dragonStreak.textContent = dragon.streak === 0
      ? 'Beginning the Quest'
      : `${dragon.streak} Consecutive Day${dragon.streak === 1 ? '' : 's'}`;
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
  const caloriesIn  = summary.caloriesIn;
  const caloriesOut = summary.caloriesOut;
  const deficit     = caloriesOut - caloriesIn;

  const elIn     = document.getElementById('cal-in');
  const elOut    = document.getElementById('cal-out');
  const elDef    = document.getElementById('cal-deficit');
  const elBar    = document.getElementById('energy-bar');
  const elStatus = document.getElementById('energy-status');

  if (elIn)  elIn.textContent  = fmtCal(caloriesIn);
  if (elOut) elOut.textContent = fmtCal(caloriesOut);

  if (elDef) {
    elDef.textContent = deficit === 0 ? '0'
      : (deficit > 0 ? '+' : '−') + fmtCal(deficit);
    elDef.className = 'stat-value' +
      (deficit > 50 ? ' deficit' : deficit < -50 ? ' surplus' : '');
  }

  if (elBar) {
    if (caloriesOut === 0) {
      elBar.style.width = '0%';
      elBar.className = 'energy-bar';
      if (elStatus) {
        elStatus.textContent = user && user.dailyGoal
          ? `Daily Intake Goal: ${user.dailyGoal.toLocaleString()} cals`
          : 'Set up your profile to see your energy balance';
      }
    } else {
      const pct = Math.min((caloriesIn / caloriesOut) * 100, 100);
      elBar.style.width = pct + '%';
      if (deficit < -50) {
        elBar.className = 'energy-bar surplus';
        if (elStatus) elStatus.textContent = 'Caloric surplus today';
      } else if (deficit < 100) {
        elBar.className = 'energy-bar warning';
        if (elStatus) elStatus.textContent = 'Near maintenance — keep going';
      } else {
        elBar.className = 'energy-bar';
        if (elStatus) elStatus.textContent = `${fmtCal(deficit)} calorie deficit`;
      }
    }
  }
}

// ---- Journal Entries ----

function renderJournalEntries(food, exercise) {
  const today     = todayKey();
  const titleEl   = document.getElementById('journal-date-title');
  const journalEl = document.getElementById('journal-entries');

  if (titleEl) {
    if (viewingDate === today) {
      titleEl.textContent = "Today's Journal";
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
          <span class="entry-detail">${e.duration ? e.duration + ' min · Training' : 'Training'}</span>
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

  renderWeekNav();
  renderEnergyBalance(summary, cachedUser);
  renderJournalEntries(food, exercise);
}

// ---- Home Screen ----

async function initHome() {
  viewingDate = todayKey();

  const [summary, dragon, food, exercise, summaries, user] = await Promise.all([
    store.getDailySummary(viewingDate),
    store.getDragonProgress(),
    store.getFoodEntries(viewingDate),
    store.getExerciseEntries(viewingDate),
    store.getRecentSummaries(90),
    store.getUser(),
  ]);

  cachedUser      = user;
  cachedSummaries = summaries;

  renderDragon(dragon, user);
  renderWeekNav();
  renderEnergyBalance(summary, user);
  renderChart(document.getElementById('quest-chart'), summaries);
  renderJournalEntries(food, exercise);

  document.getElementById('prev-day').addEventListener('click', () => shiftDay(-1));
  document.getElementById('next-day').addEventListener('click', () => shiftDay(1));
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

// ---- Init ----

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('home-page')) {
    initSplash();
    await checkAuth();
    await initHome();
  }
});
