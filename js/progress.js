// ============================================================
// Critical Fit — Progress Charts
// ============================================================

'use strict';

const NS  = 'http://www.w3.org/2000/svg';
const W   = 340;
const H   = 160;
const PAD = { t: 10, r: 12, b: 32, l: 46 };

// ---- Date helpers ----

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

// ---- Axis helpers ----

function fmtVal(v) {
  const n = Math.round(v);
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(0) + 'k';
  if (Math.abs(n) >= 1000)  return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toString();
}

function niceInterval(range, target = 4) {
  if (range === 0) return 1;
  const rough = range / target;
  const mag   = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm  = rough / mag;
  let nice;
  if      (norm < 1.5) nice = 1;
  else if (norm < 3.5) nice = 2;
  else if (norm < 7.5) nice = 5;
  else                 nice = 10;
  return nice * mag;
}

function xTickInterval(n) {
  if (n <= 8)   return 1;
  if (n <= 16)  return 2;
  if (n <= 35)  return 7;
  if (n <= 70)  return 14;
  if (n <= 130) return 30;
  return 60;
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
    style: 'width:100%;display:block;overflow:visible;',
  });
}

function svgText(x, y, txt, attrs = {}) {
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', x);
  t.setAttribute('y', y);
  t.setAttribute('font-family', 'system-ui,sans-serif');
  for (const [k, v] of Object.entries(attrs)) t.setAttribute(k, v);
  t.textContent = txt;
  return t;
}

// ---- Core chart renderer ----

function drawChart(container, dates, datasets, opts = {}) {
  const { zeroLine = false, sparse = false } = opts;

  const allVals = datasets.flatMap(d => d.values.filter(v => v !== null && v !== undefined));

  if (allVals.length === 0 || allVals.every(v => v === 0)) {
    container.innerHTML = '<p class="chart-empty">No data for this period.</p>';
    return;
  }

  // Snap y range to nice tick boundaries
  let rawMin = Math.min(...allVals);
  let rawMax = Math.max(...allVals);
  if (zeroLine) { rawMin = Math.min(0, rawMin); rawMax = Math.max(0, rawMax); }
  if (rawMin === rawMax) { rawMin -= 10; rawMax += 10; }

  const interval = niceInterval(rawMax - rawMin, 4);
  const yMin = Math.floor(rawMin / interval) * interval;
  const yMax = Math.ceil(rawMax  / interval) * interval;
  const yRange = yMax - yMin;

  const yTicks = [];
  for (let t = yMin; t <= yMax + interval * 0.001; t += interval) {
    yTicks.push(Math.round(t * 1e6) / 1e6);
  }

  const n       = dates.length;
  const xStep   = xTickInterval(n);
  const xTickIdxs = [];
  for (let i = 0; i < n; i += xStep) xTickIdxs.push(i);
  if (xTickIdxs[xTickIdxs.length - 1] !== n - 1) xTickIdxs.push(n - 1);

  const chartL = PAD.l;
  const chartR = W - PAD.r;
  const chartT = PAD.t;
  const chartB = H - PAD.b;
  const chartW = chartR - chartL;
  const chartH = chartB - chartT;

  const toX = i => chartL + (n < 2 ? chartW / 2 : (i / (n - 1)) * chartW);
  const toY = v => chartT + (1 - (v - yMin) / yRange) * chartH;
  const y0  = zeroLine ? toY(0) : chartB;

  const svg  = makeSvg();
  const defs = document.createElementNS(NS, 'defs');

  // Clip data to chart area
  const clipId = `cp-${Math.random().toString(36).slice(2)}`;
  const clip   = document.createElementNS(NS, 'clipPath');
  clip.id = clipId;
  clip.appendChild(el('rect', { x: chartL, y: chartT, width: chartW, height: chartH }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  // ---- Gridlines (faint horizontals) ----
  for (const tick of yTicks) {
    const y = toY(tick).toFixed(1);
    svg.appendChild(el('line', {
      x1: chartL, y1: y, x2: chartR, y2: y,
      stroke: 'rgba(210,195,165,0.07)', 'stroke-width': '0.5',
    }));
  }

  // ---- Zero reference dashed line ----
  if (zeroLine && yMin < 0 && yMax > 0) {
    svg.appendChild(el('line', {
      x1: chartL, y1: y0.toFixed(1), x2: chartR, y2: y0.toFixed(1),
      stroke: 'rgba(139,106,58,0.55)', 'stroke-width': '1', 'stroke-dasharray': '5,3',
    }));
  }

  // ---- Data group (clipped) ----
  const dataG = document.createElementNS(NS, 'g');
  dataG.setAttribute('clip-path', `url(#${clipId})`);

  for (const ds of datasets) {
    const pts = ds.values.map((v, i) =>
      (v !== null && v !== undefined) ? [toX(i), toY(v), v] : null
    );
    const valid = pts.filter(Boolean);
    if (valid.length === 0) continue;

    if (sparse) {
      // Connect only adjacent logged points
      for (let i = 0; i < pts.length; i++) {
        if (!pts[i]) continue;
        let j = i + 1;
        while (j < pts.length && !pts[j]) j++;
        if (j < pts.length) {
          dataG.appendChild(el('line', {
            x1: pts[i][0].toFixed(1), y1: pts[i][1].toFixed(1),
            x2: pts[j][0].toFixed(1), y2: pts[j][1].toFixed(1),
            stroke: ds.color, 'stroke-width': '2.5', 'stroke-linecap': 'round',
          }));
        }
      }
      for (let i = 0; i < pts.length; i++) {
        if (!pts[i]) continue;
        dataG.appendChild(el('circle', {
          cx: pts[i][0].toFixed(1), cy: pts[i][1].toFixed(1),
          r: '3.5', fill: ds.color,
        }));
      }
    } else {
      const gid = `pg-${Math.random().toString(36).slice(2)}`;

      if (valid.length > 1) {
        const grad = document.createElementNS(NS, 'linearGradient');
        grad.id = gid;
        grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
        grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
        const s1 = document.createElementNS(NS, 'stop');
        s1.setAttribute('offset', '0%');   s1.setAttribute('stop-color', ds.color); s1.setAttribute('stop-opacity', '0.28');
        const s2 = document.createElementNS(NS, 'stop');
        s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', ds.color); s2.setAttribute('stop-opacity', '0.02');
        grad.appendChild(s1); grad.appendChild(s2);
        defs.appendChild(grad);

        const lineD = valid.map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const areaD = `${lineD} L${valid[valid.length-1][0].toFixed(1)},${y0.toFixed(1)} L${valid[0][0].toFixed(1)},${y0.toFixed(1)} Z`;
        dataG.appendChild(el('path', { d: areaD, fill: `url(#${gid})` }));

        dataG.appendChild(el('polyline', {
          points: valid.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
          fill: 'none', stroke: ds.color, 'stroke-width': '2.5',
          'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        }));
      }

      if (n <= 60) {
        for (const [x, y, v] of valid) {
          dataG.appendChild(el('circle', {
            cx: x.toFixed(1), cy: y.toFixed(1), r: '3',
            fill: zeroLine ? (v >= 0 ? ds.color : '#C0392B') : ds.color,
          }));
        }
      }
    }
  }

  svg.appendChild(dataG);

  // ---- Axes (drawn on top of data) ----
  const axisStroke = 'rgba(210,195,165,0.35)';
  svg.appendChild(el('line', {
    x1: chartL, y1: chartT, x2: chartL, y2: chartB,
    stroke: axisStroke, 'stroke-width': '1',
  }));
  svg.appendChild(el('line', {
    x1: chartL, y1: chartB, x2: chartR, y2: chartB,
    stroke: axisStroke, 'stroke-width': '1',
  }));

  // ---- Y-axis ticks + labels ----
  const tickColor = 'rgba(210,195,165,0.45)';
  const labelFill = 'rgba(210,195,165,0.65)';

  for (const tick of yTicks) {
    const y = toY(tick);
    if (y < chartT - 1 || y > chartB + 1) continue;
    const yStr = y.toFixed(1);
    svg.appendChild(el('line', {
      x1: chartL - 4, y1: yStr, x2: chartL, y2: yStr,
      stroke: tickColor, 'stroke-width': '0.75',
    }));
    svg.appendChild(svgText(chartL - 6, (y + 2.5).toFixed(1), fmtVal(tick), {
      'text-anchor': 'end', 'font-size': '7.5', fill: labelFill,
    }));
  }

  // ---- X-axis ticks + labels ----
  for (const i of xTickIdxs) {
    const x    = toX(i).toFixed(1);
    const isFirst = i === 0;
    const isLast  = i === n - 1;
    svg.appendChild(el('line', {
      x1: x, y1: chartB, x2: x, y2: (chartB + 4).toFixed(1),
      stroke: tickColor, 'stroke-width': '0.75',
    }));
    svg.appendChild(svgText(x, H - 3, fmtDateLabel(dates[i]), {
      'text-anchor': isFirst ? 'start' : isLast ? 'end' : 'middle',
      'font-size': '7', fill: labelFill,
    }));
  }

  // ---- Render ----
  container.innerHTML = '';
  container.appendChild(svg);

  // ---- Legend (below chart, only for multi-dataset) ----
  if (datasets.some(d => d.label)) {
    const leg = document.createElement('div');
    leg.className = 'progress-legend';
    for (const ds of datasets) {
      if (!ds.label) continue;
      const item = document.createElement('div');
      item.className = 'pleg-item';
      const swatch = document.createElement('span');
      swatch.className = 'pleg-swatch';
      swatch.style.background = ds.color;
      const lbl = document.createElement('span');
      lbl.className = 'pleg-text';
      lbl.textContent = ds.label;
      item.appendChild(swatch);
      item.appendChild(lbl);
      leg.appendChild(item);
    }
    container.appendChild(leg);
  }
}

// ---- Fetch + render ----

async function loadProgress(days) {
  const [data, user] = await Promise.all([
    fetch(`api/progress.php?days=${days}`).then(r => r.json()),
    fetch('api/user.php').then(r => r.json()),
  ]);

  if (!data.ok) return;
  const progressUser = user.ok ? user.data : null;

  const dates    = dateRange(days);
  const food     = data.data.food     || {};
  const exercise = data.data.exercise || {};
  const weights  = data.data.weights  || {};

  const bmr        = progressUser?.bmr || 0;
  const multiplier = (progressUser?.activity && CF_LIFESTYLE[progressUser.activity]) || 1.20;
  const baseline   = Math.round(bmr * multiplier);

  const caloriesIn    = [];
  const carbsArr      = [];
  const fatArr        = [];
  const proteinArr    = [];
  const exCalsArr     = [];
  const totalUsedArr  = [];
  const lifePointsArr = [];
  const weightArr     = [];

  for (const date of dates) {
    const f     = food[date]     || {};
    const ex    = exercise[date] || 0;
    const cal   = Math.round(f.calories || 0);
    const exCal = Math.round(ex);
    const used  = baseline > 0 ? baseline + exCal : exCal;

    caloriesIn.push(cal > 0 ? cal : null);
    carbsArr.push(f.carbs   > 0 ? Math.round(f.carbs)   : null);
    fatArr.push(f.fat       > 0 ? Math.round(f.fat)     : null);
    proteinArr.push(f.protein > 0 ? Math.round(f.protein) : null);
    exCalsArr.push(exCal > 0 ? exCal : null);
    totalUsedArr.push(used > 0 ? used : null);
    lifePointsArr.push((cal > 0 || exCal > 0) ? used - cal : null);
    weightArr.push(weights[date] ?? null);
  }

  drawChart(document.getElementById('chart-lifepoints'), dates,
    [{ values: lifePointsArr, color: '#E8A020' }],
    { zeroLine: true });

  drawChart(document.getElementById('chart-energy-stored'), dates,
    [{ values: caloriesIn, color: '#6B9E6B' }]);

  drawChart(document.getElementById('chart-breakdown'), dates, [
    { values: carbsArr,   color: '#7BC67E', label: 'Carbs'   },
    { values: fatArr,     color: '#E8A020', label: 'Fat'     },
    { values: proteinArr, color: '#6BA8D1', label: 'Protein' },
  ]);

  drawChart(document.getElementById('chart-energy-used'), dates,
    [{ values: totalUsedArr, color: '#6B9E6B' }]);

  drawChart(document.getElementById('chart-activity'), dates,
    [{ values: exCalsArr, color: '#E8A020' }]);

  drawChart(document.getElementById('chart-weight'), dates,
    [{ values: weightArr, color: '#A07BC6' }],
    { sparse: true });
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('progress-page')) return;
  await checkAuth();

  const rangeEl = document.getElementById('progress-range');
  await loadProgress(parseInt(rangeEl.value, 10));
  rangeEl.addEventListener('change', () => loadProgress(parseInt(rangeEl.value, 10)));
});
