// ============================================================
// Critical Fit — Progress Charts
// ============================================================

'use strict';

const NS  = 'http://www.w3.org/2000/svg';
const W   = 340;
const H   = 110;
const PAD = { t: 14, r: 8, b: 20, l: 8 };

// ---- Date helpers ----

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dateRange(days) {
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  return dates;
}

function fmtDateLabel(ds) {
  const d = new Date(ds + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---- SVG helpers ----

function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function makeSvg() {
  return el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    style: 'width:100%;display:block;',
  });
}

// ---- Core chart renderer ----

function drawChart(container, dates, datasets, opts = {}) {
  const { zeroLine = false, sparse = false, yUnit = '' } = opts;

  const allVals = datasets.flatMap(d => d.values.filter(v => v !== null && v !== undefined));

  if (allVals.length === 0 || allVals.every(v => v === 0)) {
    container.innerHTML = '<p class="empty-state" style="font-size:0.75rem;padding:1rem 0;">No data for this period.</p>';
    return;
  }

  let yMin = Math.min(...allVals);
  let yMax = Math.max(...allVals);
  if (zeroLine) { yMin = Math.min(0, yMin); yMax = Math.max(0, yMax); }
  if (yMin === yMax) { yMin -= 10; yMax += 10; }
  const yRange = yMax - yMin;

  const chartL = PAD.l;
  const chartR = W - PAD.r;
  const chartT = PAD.t;
  const chartB = H - PAD.b;
  const chartW = chartR - chartL;
  const chartH = chartB - chartT;
  const n      = dates.length;

  const toX = i  => chartL + (n < 2 ? chartW / 2 : (i / (n - 1)) * chartW);
  const toY = v  => chartT + (1 - (v - yMin) / yRange) * chartH;
  const y0  = toY(Math.max(yMin, 0));

  const svg = makeSvg();
  const defs = document.createElementNS(NS, 'defs');

  // Date axis labels (first + last)
  const addLabel = (txt, x, anchor) => {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', H - 3);
    t.setAttribute('text-anchor', anchor);
    t.setAttribute('font-size', '7');
    t.setAttribute('fill', 'rgba(210,195,165,0.55)');
    t.setAttribute('font-family', 'system-ui,sans-serif');
    t.textContent = txt;
    svg.appendChild(t);
  };
  addLabel(fmtDateLabel(dates[0]),         chartL,     'start');
  addLabel(fmtDateLabel(dates[n - 1]),     chartR,     'end');
  if (n > 14) addLabel(fmtDateLabel(dates[Math.floor(n/2)]), toX(Math.floor(n/2)), 'middle');

  // Min/max value labels
  const addValLabel = (txt, y, anchor = 'end') => {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', chartR);
    t.setAttribute('y', y + 4);
    t.setAttribute('text-anchor', anchor);
    t.setAttribute('font-size', '7');
    t.setAttribute('fill', 'rgba(210,195,165,0.45)');
    t.setAttribute('font-family', 'system-ui,sans-serif');
    t.textContent = txt + (yUnit ? ` ${yUnit}` : '');
    svg.appendChild(t);
  };
  addValLabel(Math.round(yMax).toLocaleString(), chartT);
  if (zeroLine && yMin < 0) addValLabel(Math.round(yMin).toLocaleString(), toY(yMin));

  // Zero reference line
  if (zeroLine && yMin < 0 && yMax > 0) {
    svg.appendChild(el('line', {
      x1: chartL, y1: y0, x2: chartR, y2: y0,
      stroke: 'rgba(139,106,58,0.35)', 'stroke-width': '0.75', 'stroke-dasharray': '4,3',
    }));
  }

  // Each dataset
  for (const ds of datasets) {
    const pts = ds.values.map((v, i) => (v !== null && v !== undefined) ? [toX(i), toY(v), v] : null);
    const valid = pts.filter(Boolean);
    if (valid.length === 0) continue;

    if (sparse) {
      // Connect existing points only — no fill
      for (let i = 0; i < pts.length; i++) {
        if (!pts[i]) continue;
        let j = i + 1;
        while (j < pts.length && !pts[j]) j++;
        if (j < pts.length) {
          svg.appendChild(el('line', {
            x1: pts[i][0].toFixed(1), y1: pts[i][1].toFixed(1),
            x2: pts[j][0].toFixed(1), y2: pts[j][1].toFixed(1),
            stroke: ds.color, 'stroke-width': '1.5', 'stroke-linecap': 'round',
          }));
        }
        svg.appendChild(el('circle', {
          cx: pts[i][0].toFixed(1), cy: pts[i][1].toFixed(1), r: '3',
          fill: ds.color,
        }));
      }
    } else {
      // Gradient fill id
      const gid = `pg-${Math.random().toString(36).slice(2)}`;

      if (valid.length > 1) {
        // Gradient def
        const grad = document.createElementNS(NS, 'linearGradient');
        grad.id = gid;
        grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
        grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
        const s1 = document.createElementNS(NS, 'stop');
        s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', ds.color); s1.setAttribute('stop-opacity', '0.25');
        const s2 = document.createElementNS(NS, 'stop');
        s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', ds.color); s2.setAttribute('stop-opacity', '0.02');
        grad.appendChild(s1); grad.appendChild(s2);
        defs.appendChild(grad);

        // Area fill
        const lineD = valid.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const areaD = `${lineD} L${valid[valid.length-1][0].toFixed(1)},${y0} L${valid[0][0].toFixed(1)},${y0} Z`;
        svg.appendChild(el('path', { d: areaD, fill: `url(#${gid})` }));

        // Line
        svg.appendChild(el('polyline', {
          points: valid.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
          fill: 'none', stroke: ds.color, 'stroke-width': '1.5',
          'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        }));
      }

      // Dots — skip when many data points to avoid clutter
      if (n <= 60) {
        for (const [x, y, v] of valid) {
          svg.appendChild(el('circle', {
            cx: x.toFixed(1), cy: y.toFixed(1), r: '2',
            fill: zeroLine ? (v >= 0 ? ds.color : '#C0392B') : ds.color,
          }));
        }
      }
    }
  }

  svg.appendChild(defs);
  container.innerHTML = '';
  container.appendChild(svg);
}

// ---- Fetch + render ----

let progressUser = null;

async function loadProgress(days) {
  const [data, user] = await Promise.all([
    fetch(`api/progress.php?days=${days}`).then(r => r.json()),
    fetch('api/user.php').then(r => r.json()),
  ]);

  if (!data.ok) return;
  progressUser = user.ok ? user.data : null;

  const dates    = dateRange(days);
  const food     = data.data.food     || {};
  const exercise = data.data.exercise || {};
  const weights  = data.data.weights  || {};

  const bmr        = (progressUser?.bmr) || 0;
  const multiplier = (progressUser?.activity && CF_LIFESTYLE[progressUser.activity]) || 1.20;
  const baseline   = Math.round(bmr * multiplier);

  // Build series arrays
  const caloriesIn     = [];
  const carbsArr       = [];
  const fatArr         = [];
  const proteinArr     = [];
  const exCalsArr      = [];
  const totalUsedArr   = [];
  const lifePointsArr  = [];
  const weightArr      = [];

  for (const date of dates) {
    const f   = food[date]     || {};
    const ex  = exercise[date] || 0;
    const cal = Math.round(f.calories || 0);
    const exCal = Math.round(ex);
    const used = baseline > 0 ? baseline + exCal : exCal;

    caloriesIn.push(cal > 0 ? cal : null);
    carbsArr.push(f.carbs   > 0 ? Math.round(f.carbs)   : null);
    fatArr.push(f.fat       > 0 ? Math.round(f.fat)     : null);
    proteinArr.push(f.protein > 0 ? Math.round(f.protein) : null);
    exCalsArr.push(exCal > 0 ? exCal : null);
    totalUsedArr.push(used  > 0 ? used  : null);
    lifePointsArr.push((cal > 0 || exCal > 0) ? used - cal : null);
    weightArr.push(weights[date] ?? null);
  }

  const wUnit = progressUser?.unit === 'metric' ? 'kg' : 'lbs';

  // 1. Life Points
  drawChart(
    document.getElementById('chart-lifepoints'),
    dates,
    [{ values: lifePointsArr, color: '#E8A020' }],
    { zeroLine: true }
  );

  // 2. Energy Stored
  drawChart(
    document.getElementById('chart-energy-stored'),
    dates,
    [{ values: caloriesIn, color: '#566246' }]
  );

  // 3. Energy Breakdown (multi-line)
  drawChart(
    document.getElementById('chart-breakdown'),
    dates,
    [
      { values: carbsArr,   color: '#7BC67E', label: 'Carbs'   },
      { values: fatArr,     color: '#E8A020', label: 'Fat'     },
      { values: proteinArr, color: '#6BA8D1', label: 'Protein' },
    ]
  );

  // 4. Total Energy Used
  drawChart(
    document.getElementById('chart-energy-used'),
    dates,
    [{ values: totalUsedArr, color: '#566246' }]
  );

  // 5. Activity Energy
  drawChart(
    document.getElementById('chart-activity'),
    dates,
    [{ values: exCalsArr, color: '#E8A020' }]
  );

  // 6. Weight
  drawChart(
    document.getElementById('chart-weight'),
    dates,
    [{ values: weightArr, color: '#A07BC6' }],
    { sparse: true, yUnit: wUnit }
  );
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('progress-page')) return;
  await checkAuth();

  const rangeEl = document.getElementById('progress-range');
  await loadProgress(parseInt(rangeEl.value, 10));

  rangeEl.addEventListener('change', () => loadProgress(parseInt(rangeEl.value, 10)));
});
