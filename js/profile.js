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

// ---- Update calculated display ----

function updateCalcs() {
  const age      = parseInt(document.getElementById('prof-age').value)    || 0;
  const weightKg = getWeightKg();
  const heightCm = getHeightCm();

  const bmr  = calcBMR(weightKg, heightCm, age, currentGender);
  const tdee = bmr ? Math.round(bmr * ACTIVITY_LEVELS[currentActivity].mult) : 0;
  const goal = tdee ? Math.max(1200, Math.round(tdee - 500)) : 0;

  const fmt = n => n ? n.toLocaleString() + ' kcal' : '—';
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

  // Convert weight
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

  // Convert height
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

function loadProfile() {
  const p = JSON.parse(localStorage.getItem('cf_user') || 'null');
  if (!p) return;

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
}

function saveProfile() {
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

  localStorage.setItem('cf_user', JSON.stringify(profile));

  const status = document.getElementById('save-status');
  status.textContent = 'Profile saved.';
  status.classList.add('visible');
  setTimeout(() => status.classList.remove('visible'), 2500);
}

// ---- Init ----

function initProfile() {
  // Unit toggle
  document.querySelectorAll('.unit-btn').forEach(btn =>
    btn.addEventListener('click', () => toggleUnits(btn.dataset.unit))
  );

  // Gender
  const genderGroup = document.getElementById('gender-group');
  genderGroup.querySelectorAll('.toggle-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      currentGender = btn.dataset.value;
      setToggleGroup(genderGroup, currentGender);
      updateCalcs();
    })
  );

  // Activity
  const activityGroup = document.getElementById('activity-group');
  activityGroup.querySelectorAll('.toggle-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      currentActivity = btn.dataset.value;
      setToggleGroup(activityGroup, currentActivity);
      updateCalcs();
    })
  );

  // Live recalc on any numeric input
  ['prof-age', 'prof-weight', 'prof-ft', 'prof-in', 'prof-cm', 'prof-goal-weight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalcs);
  });

  // Save
  document.getElementById('save-profile').addEventListener('click', saveProfile);

  loadProfile();
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('profile-page')) initProfile();
});
