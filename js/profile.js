// ============================================================
// Critical Fit — Profile
// ============================================================

const ACTIVITY_LEVELS = {
  sedentary: { mult: 1.200 },
  light:     { mult: 1.375 },
  moderate:  { mult: 1.550 },
  active:    { mult: 1.725 },
};

let currentUnit     = 'imperial';
let currentGender   = 'male';
let currentActivity = 'sedentary';

// ---- Unit conversions ----

const lbsToKg  = lbs => lbs * 0.453592;
const kgToLbs  = kg  => kg  / 0.453592;
const inToCm   = i   => i   * 2.54;
const cmToIn   = cm  => cm  / 2.54;

function round1(n) { return Math.round(n * 10) / 10; }

// ---- Read form values ----

function getHeightCm() {
  if (currentUnit === 'metric') {
    return parseFloat(document.getElementById('prof-cm').value) || 0;
  }
  const ft      = parseFloat(document.getElementById('prof-ft').value) || 0;
  const inches  = parseFloat(document.getElementById('prof-in').value) || 0;
  return inToCm(ft * 12 + inches);
}

function getWeightKg() {
  const w = parseFloat(document.getElementById('prof-weight').value) || 0;
  return currentUnit === 'imperial' ? lbsToKg(w) : w;
}

// ---- BMR (Mifflin-St Jeor) ----

function calcBMR(weightKg, heightCm, age, gender) {
  if (!weightKg || !heightCm || !age) return 0;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

// ---- Personalized TDEE confidence display ----

function renderTdeeConfidence(confidence, days, underReporting) {
  const el = document.getElementById('calc-tdee-confidence');
  if (!el) return;
  let level, suffix;
  if (confidence === 'observed') {
    level  = 'Observed';
    suffix = ` over ${days} days`;
  } else if (confidence === 'personalized') {
    level  = 'Personalized';
    suffix = ' to you';
  } else if (underReporting) {
    // Distinguish "hit the sanity-check floor after real data" from the
    // plain beginner "Estimated" shown before 7 days of logging exist —
    // otherwise it reads like personalization isn't working at all.
    level  = 'Estimated';
    suffix = ` after ${days} observed days*`;
  } else {
    level  = 'Estimated';
    suffix = '';
  }
  el.innerHTML = `Confidence level: <span class="quest-num-confidence-level quest-num-confidence-level--${confidence}">${level}</span>${suffix}`;
}

// ---- Update calculated display ----

function updateCalcs() {
  const age      = parseInt(document.getElementById('prof-age').value)    || 0;
  const weightKg = getWeightKg();
  const heightCm = getHeightCm();

  const bmr  = calcBMR(weightKg, heightCm, age, currentGender);
  const tdee = bmr ? Math.round(bmr * ACTIVITY_LEVELS[currentActivity].mult) : 0;
  const goal = tdee ? Math.max(1200, Math.round(tdee - 500)) : 0;

  const fmt = n => n ? n.toLocaleString() + ' cals' : '—';
  document.getElementById('calc-bmr').textContent  = fmt(bmr);
  document.getElementById('calc-tdee').textContent = fmt(tdee);
  document.getElementById('calc-goal').textContent = fmt(goal);
}

// ---- Unit toggle ----

function applyUnit(unit) {
  document.querySelectorAll('.unit-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.unit === unit)
  );
  document.querySelectorAll('.imperial-fields').forEach(el =>
    el.style.display = unit === 'imperial' ? '' : 'none'
  );
  document.querySelectorAll('.metric-fields').forEach(el =>
    el.style.display = unit === 'metric' ? '' : 'none'
  );
  document.querySelectorAll('.weight-unit').forEach(el =>
    el.textContent = unit === 'imperial' ? 'lbs' : 'kg'
  );
}

function toggleUnits(unit) {
  if (unit === currentUnit) return;
  const prev = currentUnit;
  currentUnit = unit;

  const wEl  = document.getElementById('prof-weight');
  const gwEl = document.getElementById('prof-goal-weight');

  if (wEl.value) {
    const w = parseFloat(wEl.value);
    wEl.value = prev === 'imperial' ? round1(lbsToKg(w)) : round1(kgToLbs(w));
  }
  if (gwEl.value) {
    const gw = parseFloat(gwEl.value);
    gwEl.value = prev === 'imperial' ? round1(lbsToKg(gw)) : round1(kgToLbs(gw));
  }

  if (prev === 'imperial') {
    const ft = parseFloat(document.getElementById('prof-ft').value) || 0;
    const inches = parseFloat(document.getElementById('prof-in').value) || 0;
    const totalIn = ft * 12 + inches;
    document.getElementById('prof-cm').value = totalIn ? Math.round(inToCm(totalIn)) : '';
  } else {
    const cm = parseFloat(document.getElementById('prof-cm').value) || 0;
    const totalIn = cm ? cmToIn(cm) : 0;
    document.getElementById('prof-ft').value = totalIn ? Math.floor(totalIn / 12) : '';
    document.getElementById('prof-in').value = totalIn ? Math.round(totalIn % 12) : '';
  }

  applyUnit(unit);
  updateCalcs();
}

// ---- Toggle button groups ----

function setToggleGroup(groupEl, value) {
  groupEl.querySelectorAll('.toggle-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.value === value)
  );
}

// ---- Load / Save ----

// ---- Toast ----

let _profileToastTimer = null;
function showProfileToast(msg) {
  const toast = document.getElementById('profile-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_profileToastTimer);
  _profileToastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ---- Guild purchase / billing actions ----

async function startGuildCheckout(plan, btn) {
  if (btn) { btn.disabled = true; }
  const r = await fetch('api/stripe-checkout.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ plan }),
  });
  const j = await r.json();
  if (!j.ok) {
    showProfileToast(j.error || 'Could not start checkout');
    if (btn) btn.disabled = false;
    return;
  }
  window.location.href = j.data.url;
}

async function openBillingPortal(btn) {
  if (btn) { btn.disabled = true; }
  const r = await fetch('api/stripe-portal.php', { method: 'POST' });
  const j = await r.json();
  if (!j.ok) {
    showProfileToast(j.error || 'Could not open billing portal');
    if (btn) btn.disabled = false;
    return;
  }
  window.location.href = j.data.url;
}

// After Stripe redirects back from Checkout, confirm the purchase server-side
// (api/stripe-confirm.php) so the Guild card updates immediately rather than
// waiting on the webhook, which is the durable path for everything after
// this moment (renewals, cancellations, refunds).
async function handleCheckoutReturn() {
  const params   = new URLSearchParams(window.location.search);
  const checkout = params.get('checkout');
  if (!checkout) return;

  if (checkout === 'success') {
    const sessionId = params.get('session_id');
    if (sessionId) {
      const r = await fetch(`api/stripe-confirm.php?session_id=${encodeURIComponent(sessionId)}`);
      const j = await r.json();
      showProfileToast(
        j.ok && j.data.applied
          ? (j.data.plan === 'lifetime' ? 'Welcome to the Guild — Lifetime!' : 'Welcome to the Guild!')
          : 'Payment received — finishing setup…'
      );
      await loadProfile();
    }
  } else if (checkout === 'cancelled') {
    showProfileToast('Checkout cancelled');
  }

  // Clean the query string so refreshing the page doesn't re-trigger this.
  history.replaceState(null, '', window.location.pathname);
}

// ---- Guild card ----

function renderGuildCard(isPremium, guildPlan) {
  const el = document.getElementById('guild-content');
  if (!el) return;

  if (isPremium && guildPlan === 'lifetime') {
    el.innerHTML = `
      <div class="guild-active">
        <i class="fa-solid fa-ring guild-crown"></i>
        <p class="guild-active-title">Guild Member — Lifetime</p>
      </div>
    `;
    return;
  }

  if (isPremium && guildPlan === 'annual') {
    el.innerHTML = `
      <div class="guild-active">
        <i class="fa-solid fa-ring guild-crown"></i>
        <p class="guild-active-title">Guild Member</p>
      </div>
      <button class="btn btn-secondary btn-full" id="guild-manage-btn" style="margin-top:0.85rem;">Manage Membership</button>
      <button class="btn btn-primary btn-full" id="guild-upgrade-btn" style="margin-top:0.6rem;">Upgrade to Lifetime — $69.99</button>
    `;
    document.getElementById('guild-manage-btn')?.addEventListener('click', e => openBillingPortal(e.currentTarget));
    document.getElementById('guild-upgrade-btn')?.addEventListener('click', e => startGuildCheckout('lifetime', e.currentTarget));
    return;
  }

  el.innerHTML = `
    <p class="guild-join-heading">Join the Guild today to unlock these features:</p>
    <ul class="guild-features">
      <li><i class="fa-solid fa-ring guild-bullet"></i><div><strong>Wizard Ration Search</strong> — restaurant &amp; branded food items with suggested servings</div></li>
      <li><i class="fa-solid fa-ring guild-bullet"></i><div><strong>Advanced Charting</strong> — track up to a year's worth of progress</div></li>
      <li><i class="fa-solid fa-ring guild-bullet"></i><div><strong>Build Meals</strong> — log regular food rations in custom made meals</div></li>
      <li><i class="fa-solid fa-ring guild-bullet"></i><div><strong>Custom Themes and Music</strong> — Choose from a myriad of colors, scenes, and background music</div></li>
      <li><i class="fa-solid fa-ring guild-bullet"></i><div>Get exclusive fitness suggestions</div></li>
    </ul>
    <button class="btn btn-primary btn-full" id="guild-join-annual-btn">Join Annually — $29.99/yr</button>
    <button class="btn btn-secondary btn-full" id="guild-join-lifetime-btn" style="margin-top:0.6rem;">Go Lifetime — $69.99</button>
  `;
  document.getElementById('guild-join-annual-btn')?.addEventListener('click', e => startGuildCheckout('annual', e.currentTarget));
  document.getElementById('guild-join-lifetime-btn')?.addEventListener('click', e => startGuildCheckout('lifetime', e.currentTarget));
}

async function loadProfile() {
  const p = await store.getUser();
  if (!p) return;

  renderGuildCard(p.isPremium ?? false, p.guildPlan ?? null);

  currentUnit     = p.unit     || 'imperial';
  currentGender   = p.gender   || 'male';
  currentActivity = p.activity || 'sedentary';

  applyUnit(currentUnit);
  setToggleGroup(document.getElementById('gender-group'),   currentGender);
  setToggleGroup(document.getElementById('activity-group'), currentActivity);

  if (p.name)       document.getElementById('prof-name').value        = p.name;
  if (p.age)        document.getElementById('prof-age').value         = p.age;
  if (p.weight)     document.getElementById('prof-weight').value      = p.weight;
  if (p.goalWeight) document.getElementById('prof-goal-weight').value = p.goalWeight;

  if (currentUnit === 'imperial') {
    if (p.ft != null) document.getElementById('prof-ft').value = p.ft;
    if (p.in != null) document.getElementById('prof-in').value = p.in;
  } else {
    if (p.cm) document.getElementById('prof-cm').value = p.cm;
  }

  updateCalcs();

  // Fetch personalized TDEE from historical data and override display + goal
  const tdeeRes = await fetch('api/tdee.php').then(r => r.json()).catch(() => null);
  if (tdeeRes?.ok && tdeeRes.data?.personalizedTdee) {
    const { personalizedTdee, confidence, confidenceDays, underReporting } = tdeeRes.data;
    const tdeeEl = document.getElementById('calc-tdee');
    if (tdeeEl) tdeeEl.textContent = personalizedTdee.toLocaleString() + ' cals';
    const goalEl = document.getElementById('calc-goal');
    if (goalEl) goalEl.textContent = Math.max(1200, Math.round(personalizedTdee - 500)).toLocaleString() + ' cals';
    renderTdeeConfidence(confidence, confidenceDays, underReporting);
    const banner  = document.getElementById('underreporting-banner');
    const divider = document.getElementById('underreporting-divider');
    if (banner)  banner.style.display  = underReporting ? '' : 'none';
    if (divider) divider.style.display = underReporting ? '' : 'none';
  } else {
    renderTdeeConfidence('estimated', 0);
  }
}

async function saveProfile() {
  const age      = parseInt(document.getElementById('prof-age').value) || null;
  const weightKg = getWeightKg();
  const heightCm = getHeightCm();
  const bmr      = calcBMR(weightKg, heightCm, age || 0, currentGender);
  const tdee     = bmr ? Math.round(bmr * ACTIVITY_LEVELS[currentActivity].mult) : 0;
  const goal     = tdee ? Math.max(1200, Math.round(tdee - 500)) : 0;

  const profile = {
    unit:       currentUnit,
    gender:     currentGender,
    activity:   currentActivity,
    name:       document.getElementById('prof-name').value.trim(),
    age,
    weight:     parseFloat(document.getElementById('prof-weight').value)      || null,
    goalWeight: parseFloat(document.getElementById('prof-goal-weight').value) || null,
    bmr:        bmr  || null,
    tdee:       tdee || null,
    dailyGoal:  goal || null,
  };

  if (currentUnit === 'imperial') {
    profile.ft = parseInt(document.getElementById('prof-ft').value) || null;
    profile.in = parseInt(document.getElementById('prof-in').value) || 0;
  } else {
    profile.cm = parseFloat(document.getElementById('prof-cm').value) || null;
  }

  const btn    = document.getElementById('save-profile');
  const status = document.getElementById('save-status');
  btn.disabled = true;

  await store.saveUser(profile);

  window.location.href = 'index.html';
}

// ---- Init ----

async function initProfile() {
  document.querySelectorAll('.unit-btn').forEach(btn =>
    btn.addEventListener('click', () => toggleUnits(btn.dataset.unit))
  );

  const genderGroup = document.getElementById('gender-group');
  genderGroup.querySelectorAll('.toggle-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      currentGender = btn.dataset.value;
      setToggleGroup(genderGroup, currentGender);
      updateCalcs();
    })
  );

  const activityGroup = document.getElementById('activity-group');
  activityGroup.querySelectorAll('.toggle-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      currentActivity = btn.dataset.value;
      setToggleGroup(activityGroup, currentActivity);
      updateCalcs();
    })
  );

  ['prof-age', 'prof-weight', 'prof-ft', 'prof-in', 'prof-cm', 'prof-goal-weight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalcs);
  });

  document.getElementById('save-profile').addEventListener('click', saveProfile);

  await loadProfile();
  await handleCheckoutReturn();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('profile-page')) {
    await checkAuth();
    await initProfile();
  }
});
