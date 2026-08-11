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

// ---- Storage layer (localStorage → API swap-ready) ----

const store = {
  getUser: () =>
    JSON.parse(localStorage.getItem('cf_user') || 'null'),

  getDailySummary: (date) => {
    const all = JSON.parse(localStorage.getItem('cf_daily') || '{}');
    return all[date] || { caloriesIn: 0, caloriesOut: 0 };
  },

  getDragonProgress: () =>
    JSON.parse(localStorage.getItem('cf_dragon') || '{"streak":0,"maxLevel":0}'),

  getRecentSummaries: (days) => {
    const all = JSON.parse(localStorage.getItem('cf_daily') || '{}');
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push(all[key] || { caloriesIn: 0, caloriesOut: 0 });
    }
    return result;
  },

  getFoodEntries: (date) => {
    const all = JSON.parse(localStorage.getItem('cf_food') || '{}');
    return all[date] || [];
  },

  getExerciseEntries: (date) => {
    const all = JSON.parse(localStorage.getItem('cf_exercise') || '{}');
    return all[date] || [];
  },
};

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

  // Clip paths for above/below baseline coloring
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

  // Area path
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

  // Baseline
  const base = document.createElementNS(NS, 'line');
  base.setAttribute('x1', padX); base.setAttribute('y1', midY);
  base.setAttribute('x2', W - padX); base.setAttribute('y2', midY);
  base.setAttribute('stroke', 'rgba(139,106,58,0.3)');
  base.setAttribute('stroke-width', '0.75');
  base.setAttribute('stroke-dasharray', '4,3');
  svg.appendChild(base);

  // Line
  const line = document.createElementNS(NS, 'polyline');
  line.setAttribute('points', pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'rgba(86,98,70,0.8)');
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('stroke-linecap', 'round');
  svg.appendChild(line);

  // Dots
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

// ---- Home Screen ----

function initHome() {
  const today = todayKey();
  const summary = store.getDailySummary(today);
  const dragon  = store.getDragonProgress();
  const stage   = getDragonStage(dragon.streak);

  // Dragon
  const dragonImg    = document.getElementById('dragon-img');
  const dragonTitle  = document.getElementById('dragon-title');
  const dragonStreak = document.getElementById('dragon-streak');

  if (dragonImg)    dragonImg.src = stage.img;
  if (dragonTitle)  dragonTitle.textContent = stage.title;
  if (dragonStreak) {
    dragonStreak.textContent = dragon.streak === 0
      ? 'Beginning the Quest'
      : `${dragon.streak} Consecutive Day${dragon.streak === 1 ? '' : 's'}`;
  }

  // Energy Balance
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
      if (elStatus) {
        const user = store.getUser();
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

  // Quest Progress chart
  const chartEl = document.getElementById('quest-chart');
  if (chartEl) renderChart(chartEl, store.getRecentSummaries(14));

  // Today's Journal entries
  const journalEl = document.getElementById('journal-entries');
  if (journalEl) {
    const food     = store.getFoodEntries(today);
    const exercise = store.getExerciseEntries(today);

    if (food.length === 0 && exercise.length === 0) {
      journalEl.innerHTML = `<p class="empty-state">No rations recorded yet today.<br>Begin your quest.</p>`;
    } else {
      const rows = [
        ...food.map(e => `
          <div class="journal-entry">
            <div class="entry-info">
              <span class="entry-name">${e.name}</span>
              <span class="entry-detail">${e.serving || ''}</span>
            </div>
            <span class="entry-cal">${fmtCal(e.calories)} kcal</span>
          </div>`),
        ...exercise.map(e => `
          <div class="journal-entry">
            <div class="entry-info">
              <span class="entry-name">${e.name}</span>
              <span class="entry-detail">${e.duration} min · Training</span>
            </div>
            <span class="entry-cal burned">−${fmtCal(e.calories)} kcal</span>
          </div>`),
      ];
      journalEl.innerHTML = rows.join('');
    }
  }
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
  setTimeout(() => {
    splash.classList.add('fade-out');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }, 5000);
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  initSplash();
  if (document.getElementById('home-page')) initHome();
});
