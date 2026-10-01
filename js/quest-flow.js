// ============================================================
// Critical Fit — Daily Quest flow: Briefing, Active Quest, Victory
// ============================================================

'use strict';

let quest = null;        // full quest object from api/quests.php
let seq   = [];          // flattened [{type:'station'|'transition', item}] for one round
let state = null;        // runtime progress through the active quest (persisted to localStorage)
let serverStartedAtMs = null;
let tickTimer  = null;
let wakeLock   = null;
let audioCtx   = null;
let beepTracker = { index: -1, seconds: new Set() };

// ---- Helpers ----

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function fmtClock(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatScore(rounds, extra) {
  return extra > 0 ? `${rounds} round${rounds !== 1 ? 's' : ''} + ${extra}` : `${rounds} round${rounds !== 1 ? 's' : ''}`;
}

// ---- API ----

async function fetchQuest() {
  const r = await fetch('api/quests.php');
  const j = await r.json();
  return j.ok ? j.data : null;
}

async function postAction(action, extra = {}) {
  const r = await fetch('api/quests.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, ...extra }),
  });
  return r.json();
}

// ---- Local persistence (reload recovery) ----

function stateKey(id) { return `cfQuestState_${id}`; }

function loadLocalState(id) {
  try {
    const raw = localStorage.getItem(stateKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLocalState() {
  if (quest) localStorage.setItem(stateKey(quest.id), JSON.stringify(state));
}

function clearLocalState(id) {
  localStorage.removeItem(stateKey(id));
}

function freshState() {
  return {
    round: 1, index: 0,
    pausedAccumMs: 0, pauseStartedAt: null,
    completedStationsThisRound: 0, completedRounds: 0,
    itemStartedAt: Date.now(),
  };
}

// ---- Sequence (stations interleaved with their transitions) ----

function buildSequence(q) {
  const out = [];
  for (let i = 0; i < q.stations.length; i++) {
    out.push({ type: 'station', item: q.stations[i] });
    out.push({ type: 'transition', item: q.transitions[i] });
  }
  return out;
}

function currentSeqItem() { return seq[state.index]; }

// ---- View switching ----

function showView(name) {
  document.getElementById('quest-loading').hidden = true;
  ['briefing', 'active', 'victory'].forEach(v => {
    document.getElementById(`quest-${v}-view`).hidden = v !== name;
  });
  document.body.classList.toggle('quest-active-mode', name === 'active');
  const header = document.getElementById('quest-app-header');
  if (header) header.style.display = name === 'active' ? 'none' : '';
}

// ---- Exercise info (ⓘ) popup ----

function showInfoPopup(name, details) {
  document.getElementById('quest-info-title').textContent = name;
  document.getElementById('quest-info-details').textContent = details;
  document.getElementById('quest-info-modal').classList.add('open');
}

function initInfoPopup() {
  document.getElementById('quest-info-close')?.addEventListener('click', () => {
    document.getElementById('quest-info-modal').classList.remove('open');
  });
  document.getElementById('quest-info-modal')?.addEventListener('click', e => {
    if (e.target.id === 'quest-info-modal') e.target.classList.remove('open');
  });
}

// ---- Disclaimer ----

function initDisclaimer(onAck) {
  document.getElementById('quest-disclaimer-ack')?.addEventListener('click', async () => {
    await fetch('api/quest-prefs.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ackDisclaimer: true }),
    });
    quest.disclaimerAcknowledged = true;
    document.getElementById('quest-disclaimer-modal').classList.remove('open');
    onAck();
  });
}

// ---- Briefing ----

function buildStationRow(item, isTransition) {
  const row = document.createElement('div');
  row.className = 'quest-station-row' + (isTransition ? ' quest-station-row--transition' : '');
  const targetText = item.unit === 'seconds'
    ? `${item.target}s`
    : `${item.target} ${item.unit}${item.perSide ? ' per side' : ''}`;
  row.innerHTML = `
    <span class="quest-station-name">${isTransition ? '<i class="fa-solid fa-arrows-rotate quest-transition-icon"></i> ' : ''}${esc(item.name)}</span>
    <span class="quest-station-target">${esc(targetText)}</span>
    <button class="quest-info-btn" aria-label="Info about ${esc(item.name)}"><i class="fa-solid fa-circle-info"></i></button>
  `;
  row.querySelector('.quest-info-btn').addEventListener('click', () => showInfoPopup(item.name, item.details));
  return row;
}

function renderBriefing() {
  document.getElementById('qb-name').textContent   = quest.name;
  document.getElementById('qb-flavor').textContent = quest.flavor;

  const dayTypeLabel = { upper: 'Upper', lower: 'Lower', full: 'Full' }[quest.dayType];
  document.getElementById('qb-meta').textContent = quest.locked
    ? `${dayTypeLabel} · ${quest.durationMin} min`
    : `${dayTypeLabel} · ${quest.durationMin} min · ${capitalize(quest.difficulty)}`;

  const switchGroup = document.getElementById('qb-daytype-switch');
  switchGroup.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === quest.dayType);
    btn.disabled = quest.locked || quest.status !== 'ready';
  });

  document.getElementById('qb-locked-cta').hidden = !quest.locked;
  document.getElementById('qb-actions').hidden    = quest.locked;

  if (quest.locked) {
    document.getElementById('qb-station-list').innerHTML =
      '<p class="quest-locked-blur">▓▓▓▓▓▓▓▓&nbsp;&nbsp;▓▓▓▓▓▓&nbsp;&nbsp;▓▓▓▓▓▓▓▓▓&nbsp;&nbsp;▓▓▓▓▓▓</p>';
    document.getElementById('qb-personal-best').textContent = '';
    return;
  }

  const listEl = document.getElementById('qb-station-list');
  listEl.innerHTML = '';
  quest.stations.forEach((st, i) => {
    listEl.appendChild(buildStationRow(st, false));
    if (quest.transitions[i]) listEl.appendChild(buildStationRow(quest.transitions[i], true));
  });

  document.getElementById('qb-personal-best').textContent = quest.personalBest
    ? `Personal best for this quest type: ${formatScore(quest.personalBest.rounds, quest.personalBest.extraStations)}`
    : 'No record yet for this quest type.';

  const rerollBtn = document.getElementById('qb-reroll-btn');
  rerollBtn.textContent = `Reroll (${quest.rerollsRemaining} left)`;
  rerollBtn.disabled    = quest.rerollsRemaining <= 0 || quest.status !== 'ready';

  document.getElementById('qb-begin-btn').disabled = quest.status !== 'ready';
}

function wireBriefingActions() {
  document.getElementById('qb-join-guild-btn')?.addEventListener('click', () => {
    document.getElementById('guild-gate-modal')?.classList.add('open');
  });

  document.getElementById('qb-daytype-switch')?.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (quest.locked || quest.status !== 'ready' || btn.dataset.value === quest.dayType) return;
      const j = await postAction('switchDayType', { dayType: btn.dataset.value });
      if (j.ok) { quest = j.data; renderBriefing(); }
    });
  });

  document.getElementById('qb-reroll-btn')?.addEventListener('click', async () => {
    const j = await postAction('reroll');
    if (j.ok) { quest = j.data; renderBriefing(); }
  });

  document.getElementById('qb-begin-btn')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    if (btn.disabled) return; // guards against a double-tap firing two begins
    btn.disabled = true;
    btn.textContent = 'Starting…';

    const j = await postAction('begin');
    if (!j.ok) {
      // Most likely: an earlier tap already started it. Re-fetch rather than
      // leaving the user stuck on a Briefing that can no longer begin.
      quest = await fetchQuest();
      if (quest && quest.status === 'active') { enterActiveView(true); return; }
      btn.disabled = false;
      btn.textContent = 'Begin Quest';
      return;
    }
    quest = j.data;
    enterActiveView(false);
  });
}

// ---- Active Quest: audio + haptic cues ----

function beep(freq, durationMs) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  } catch (e) { /* Web Audio unavailable — cues are a nice-to-have, fail silently */ }
}

function vibrate(ms) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) { /* iOS Safari has no vibrate API — expected */ }
  }
}

// ---- Active Quest: wake lock ----

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) { /* unsupported or denied — graceful fallback, screen may sleep */ }
}

function releaseWakeLock() {
  try { wakeLock?.release(); } catch (e) {}
  wakeLock = null;
}

// ---- Active Quest: timer engine ----

function overallElapsedMs() {
  const pausedNow = state.pauseStartedAt ? (Date.now() - state.pauseStartedAt) : 0;
  return (Date.now() - serverStartedAtMs) - state.pausedAccumMs - pausedNow;
}

function overallRemainingMs() {
  return quest.durationMin * 60000 - overallElapsedMs();
}

function itemElapsedMs() {
  const pausedNow = state.pauseStartedAt ? (Date.now() - state.pauseStartedAt) : 0;
  return (Date.now() - state.itemStartedAt) - pausedNow;
}

function advanceItem() {
  if (state.pauseStartedAt) return; // ignore a stray Done tap while paused
  const cur = currentSeqItem();
  if (cur.type === 'station') state.completedStationsThisRound++;

  state.index++;
  if (state.index >= seq.length) {
    state.index = 0;
    state.completedRounds++;
    state.completedStationsThisRound = 0;
    state.round++;
  }
  state.itemStartedAt = Date.now();
  saveLocalState();
  beep(660, 120);
  vibrate(80);
}

function renderActiveTick() {
  if (state.pauseStartedAt) return; // frozen while paused — nothing to update

  const remainingOverall = overallRemainingMs();
  document.getElementById('qa-overall-timer').textContent = fmtClock(remainingOverall);

  if (remainingOverall <= 0) { finishQuestNaturally(); return; }

  const cur = currentSeqItem();
  const stationNum = Math.floor(state.index / 2) + 1;
  document.getElementById('qa-round-label').textContent =
    `Round ${state.round} · Station ${stationNum}/${quest.stations.length}`;

  document.getElementById('qa-exercise-name').textContent = cur.item.name + (cur.item.perSide ? ' (per side)' : '');
  document.getElementById('qa-exercise-cue').textContent  = cur.item.cue;

  const doneBtn    = document.getElementById('qa-done-btn');
  const stationTmr = document.getElementById('qa-station-timer');
  const targetEl   = document.getElementById('qa-exercise-target');

  if (cur.item.unit === 'seconds') {
    const remainingItemMs = Math.max(0, cur.item.target * 1000 - itemElapsedMs());
    const remainingSec    = Math.ceil(remainingItemMs / 1000);

    targetEl.textContent    = '';
    stationTmr.hidden       = false;
    stationTmr.textContent  = `${remainingSec}s`;
    doneBtn.hidden          = true;

    if (beepTracker.index !== state.index) beepTracker = { index: state.index, seconds: new Set() };
    if (remainingSec <= 3 && remainingSec >= 1 && !beepTracker.seconds.has(remainingSec)) {
      beepTracker.seconds.add(remainingSec);
      beep(880, 90);
    }
    if (remainingItemMs <= 0) { advanceItem(); return; }
  } else {
    targetEl.textContent   = `${cur.item.target} ${cur.item.unit}${cur.item.perSide ? ' per side' : ''}`;
    stationTmr.hidden      = true;
    doneBtn.hidden         = false;
  }

  const nextItem = seq[(state.index + 1) % seq.length];
  document.getElementById('qa-next-label').textContent = `Next: ${nextItem.item.name}`;
}

function startTimerLoop() {
  stopTimerLoop();
  renderActiveTick();
  tickTimer = setInterval(renderActiveTick, 250);
}

function stopTimerLoop() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}

// ---- Active Quest: pause/resume ----

function togglePause() {
  const btn = document.getElementById('qa-pause-btn');
  if (state.pauseStartedAt) {
    state.pausedAccumMs += Date.now() - state.pauseStartedAt;
    state.pauseStartedAt = null;
    btn.textContent = 'Pause';
  } else {
    state.pauseStartedAt = Date.now();
    btn.textContent = 'Resume';
  }
  saveLocalState();
}

// ---- Active Quest: entering / finishing ----

function enterActiveView(resumed) {
  seq = buildSequence(quest);
  // startedAtMs is written server-side as UTC at 'begin' time — the one
  // authoritative anchor for the overall countdown, since the client's own
  // clock/localStorage could be stale or missing across devices.
  serverStartedAtMs = quest.startedAtMs || Date.now();
  const saved = resumed ? loadLocalState(quest.id) : null;
  state = saved || freshState();
  beepTracker = { index: -1, seconds: new Set() };

  document.getElementById('qa-pause-btn').textContent = state.pauseStartedAt ? 'Resume' : 'Pause';

  showView('active');
  requestWakeLock();
  startTimerLoop();
}

async function finishQuestNaturally() {
  stopTimerLoop();
  releaseWakeLock();
  const activeSeconds = Math.round(quest.durationMin * 60); // timer ran out — full active duration reached
  const rounds        = state.completedRounds;
  const extraStations = state.completedStationsThisRound;
  clearLocalState(quest.id);

  const j = await postAction('complete', { rounds, extraStations, activeSeconds, partial: false });
  if (j.ok) { quest = j.data; await showVictory(rounds, extraStations, false); }
}

// ---- End Quest early ----

function openEndQuestConfirm() {
  const activeSeconds = Math.round(overallElapsedMs() / 1000);
  const canLogPartial  = activeSeconds >= 60;

  document.getElementById('quest-end-confirm-body').textContent = canLogPartial
    ? 'At least a minute logged so far — you can log what you did, or discard it entirely.'
    : "Not enough time logged yet to count — ending now won't log anything.";
  document.getElementById('quest-end-log-partial').hidden = !canLogPartial;
  document.getElementById('quest-end-confirm-modal').classList.add('open');
}

function initEndQuestConfirm() {
  document.getElementById('qa-end-btn')?.addEventListener('click', () => {
    togglePauseForConfirm(true);
    openEndQuestConfirm();
  });

  document.getElementById('quest-end-keep-going')?.addEventListener('click', () => {
    document.getElementById('quest-end-confirm-modal').classList.remove('open');
    togglePauseForConfirm(false);
  });

  document.getElementById('quest-end-discard')?.addEventListener('click', async () => {
    document.getElementById('quest-end-confirm-modal').classList.remove('open');
    stopTimerLoop();
    releaseWakeLock();
    clearLocalState(quest.id);
    await postAction('abandon');
    window.location.href = 'index.html';
  });

  document.getElementById('quest-end-log-partial')?.addEventListener('click', async () => {
    document.getElementById('quest-end-confirm-modal').classList.remove('open');
    stopTimerLoop();
    releaseWakeLock();
    const activeSeconds = Math.round(overallElapsedMs() / 1000);
    const rounds        = state.completedRounds;
    const extraStations = state.completedStationsThisRound;
    clearLocalState(quest.id);
    const j = await postAction('complete', { rounds, extraStations, activeSeconds, partial: true });
    if (j.ok) { quest = j.data; await showVictory(rounds, extraStations, true); }
  });
}

// Pauses the timer visually while the end-quest confirm is open, without
// touching state.pauseStartedAt (so "Keep Going" resumes exactly as before).
let _confirmFrozeTimer = false;
function togglePauseForConfirm(freeze) {
  if (freeze) { stopTimerLoop(); _confirmFrozeTimer = true; }
  else if (_confirmFrozeTimer) { startTimerLoop(); _confirmFrozeTimer = false; }
}

// ---- Resume prompt (reload mid-quest) ----

function offerResume() {
  document.getElementById('quest-resume-modal').classList.add('open');
  document.getElementById('quest-resume-continue').addEventListener('click', () => {
    document.getElementById('quest-resume-modal').classList.remove('open');
    enterActiveView(true);
  }, { once: true });

  document.getElementById('quest-resume-end').addEventListener('click', () => {
    document.getElementById('quest-resume-modal').classList.remove('open');
    seq = buildSequence(quest);
    serverStartedAtMs = quest.startedAtMs || Date.now();
    state = loadLocalState(quest.id) || freshState();
    openEndQuestConfirm();
  }, { once: true });
}

// ---- Victory ----

async function showVictory(rounds, extraStations, partial) {
  showView('victory');
  document.getElementById('qv-title').textContent     = partial ? 'Quest Logged' : 'Quest Complete';
  document.getElementById('qv-quest-name').textContent = quest.name;
  document.getElementById('qv-score').textContent      = formatScore(rounds, extraStations);

  const pb = quest.personalBest;
  const isNewBest = pb && (rounds > pb.rounds || (rounds === pb.rounds && extraStations > pb.extraStations));
  document.getElementById('qv-newbest').hidden = !isNewBest;

  document.getElementById('qv-campaign').textContent =
    `Weekly Campaign ${quest.weeklyCampaign.completed}/${quest.weeklyCampaign.target}`;
  document.getElementById('qv-campaign-banner').hidden =
    !(quest.weeklyCampaign.completed >= quest.weeklyCampaign.target && !partial);

  await renderVictoryEnergyAndDragon();
}

async function showVictoryForCompleted() {
  // Landing on an already-completed-today quest — read-only summary, no
  // fresh score to report beyond what's already on record.
  const stmtLike = await fetch(`api/daily.php?date=${todayKeyLocal()}`).then(r => r.json()).catch(() => null);
  showView('victory');
  document.getElementById('qv-title').textContent     = 'Quest Complete ✓';
  document.getElementById('qv-quest-name').textContent = quest.name;
  document.getElementById('qv-score').textContent      = quest.personalBest
    ? formatScore(quest.personalBest.rounds, quest.personalBest.extraStations)
    : '—';
  document.getElementById('qv-newbest').hidden = true;
  document.getElementById('qv-campaign').textContent =
    `Weekly Campaign ${quest.weeklyCampaign.completed}/${quest.weeklyCampaign.target}`;
  document.getElementById('qv-campaign-banner').hidden =
    quest.weeklyCampaign.completed < quest.weeklyCampaign.target;
  await renderVictoryEnergyAndDragon();
}

function todayKeyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Mirrors the Energy Used / Life Points formula js/app.js and js/progress.js
// already use — this page has no access to the Journal's live cachedUser
// state since it's a separate full page, so it re-fetches the same pieces.
async function renderVictoryEnergyAndDragon() {
  const [user, dailySummary, tdeeData, dragon] = await Promise.all([
    fetch('api/user.php').then(r => r.json()).then(j => j.ok ? j.data : null),
    fetch(`api/daily.php?date=${todayKeyLocal()}`).then(r => r.json()).then(j => j.ok ? j.data : { caloriesIn: 0, caloriesOut: 0 }),
    fetch('api/tdee.php').then(r => r.json()).catch(() => null),
    fetch(`api/dragon.php?today=${todayKeyLocal()}`).then(r => r.json()).then(j => j.ok ? j.data : null).catch(() => null),
  ]);

  if (user) {
    const bmr        = user.bmr || 0;
    const multiplier = (user.activity && CF_LIFESTYLE[user.activity]) || CF_LIFESTYLE.sedentary;
    const baseline   = (tdeeData?.ok && tdeeData.data?.personalizedTdee) ? tdeeData.data.personalizedTdee : Math.round(bmr * multiplier);
    const used       = baseline + (dailySummary.caloriesOut || 0);
    const lifePoints = Math.round(used - (dailySummary.caloriesIn || 0));

    document.getElementById('qv-energy-used').textContent = `${Math.round(used).toLocaleString()} cal`;
    document.getElementById('qv-life-points').textContent = (lifePoints < 0 ? '−' : '') + Math.abs(lifePoints).toLocaleString();
  }

  if (dragon) {
    document.getElementById('qv-dragon-img').src = `images/Dragon_Lvl${dragon.currentLevel}.png`;
  }
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('quest-page')) return;
  await checkAuth();

  initInfoPopup();
  initEndQuestConfirm();
  document.getElementById('qa-done-btn')?.addEventListener('click', advanceItem);
  document.getElementById('qa-pause-btn')?.addEventListener('click', togglePause);
  document.getElementById('qv-continue-btn')?.addEventListener('click', () => { window.location.href = 'index.html'; });

  quest = await fetchQuest();
  if (!quest) { document.getElementById('quest-loading').textContent = 'Could not load your quest.'; return; }

  if (quest.locked) {
    showView('briefing');
    renderBriefing();
    wireBriefingActions();
    return;
  }

  seq = buildSequence(quest);

  const proceed = () => {
    if (quest.status === 'completed') {
      showVictoryForCompleted();
    } else if (quest.status === 'active') {
      offerResume();
    } else {
      showView('briefing');
      renderBriefing();
      wireBriefingActions();
    }
  };

  if (!quest.disclaimerAcknowledged) {
    initDisclaimer(proceed);
    document.getElementById('quest-disclaimer-modal').classList.add('open');
  } else {
    proceed();
  }
});
