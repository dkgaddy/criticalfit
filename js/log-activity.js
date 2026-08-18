// ============================================================
// Critical Fit — Log Activity Modal
// MET values sourced from Compendium of Physical Activities (Ainsworth et al.)
// Formula: Calories = MET × weight_kg × (duration_min / 60)
// ============================================================

const ACTIVITY_LIST = [
  {
    name: 'Aerobics Class',
    intensities: [
      { label: 'Low impact',       met: 5.0 },
      { label: 'High impact',      met: 7.3 },
      { label: 'Step aerobics',    met: 8.5 },
    ],
  },
  {
    name: 'Basketball',
    intensities: [
      { label: 'Shooting around',  met: 4.5 },
      { label: 'Recreational game', met: 6.5 },
      { label: 'Competitive game', met: 8.0 },
    ],
  },
  {
    name: 'Bodyweight Training',
    intensities: [
      { label: 'Light (stretching, calisthenics)', met: 3.8 },
      { label: 'Moderate (push-ups, pull-ups)',    met: 5.0 },
      { label: 'Vigorous (burpees, plyometrics)',  met: 8.0 },
    ],
  },
  {
    name: 'Cycling',
    intensities: [
      { label: 'Leisure (< 10 mph)',   met: 4.0  },
      { label: 'Moderate (12 mph)',    met: 8.0  },
      { label: 'Vigorous (14–16 mph)', met: 10.0 },
      { label: 'Racing (> 16 mph)',    met: 12.0 },
    ],
  },
  {
    name: 'CrossFit',
    intensities: [
      { label: 'Moderate', met: 8.0  },
      { label: 'Intense',  met: 12.0 },
    ],
  },
  {
    name: 'Dancing',
    intensities: [
      { label: 'Slow / Ballroom',   met: 3.0 },
      { label: 'Moderate',          met: 5.0 },
      { label: 'Vigorous / Zumba',  met: 8.0 },
    ],
  },
  {
    name: 'Elliptical',
    intensities: [
      { label: 'Light',    met: 4.6 },
      { label: 'Moderate', met: 6.0 },
      { label: 'Vigorous', met: 8.5 },
    ],
  },
  {
    name: 'Golf',
    intensities: [
      { label: 'Riding cart',    met: 3.5 },
      { label: 'Walking course', met: 4.8 },
      { label: 'Carrying clubs', met: 5.5 },
    ],
  },
  {
    name: 'HIIT',
    intensities: [
      { label: 'Moderate', met: 8.0  },
      { label: 'Vigorous', met: 10.0 },
      { label: 'Intense',  met: 12.0 },
    ],
  },
  {
    name: 'Hiking',
    intensities: [
      { label: 'Flat terrain',     met: 5.3 },
      { label: 'Hilly (moderate)', met: 6.0 },
      { label: 'Steep terrain',    met: 7.8 },
    ],
  },
  {
    name: 'Jump Rope',
    intensities: [
      { label: 'Moderate', met: 10.0 },
      { label: 'Fast',     met: 12.3 },
    ],
  },
  {
    name: 'Kayaking / Paddling',
    intensities: [
      { label: 'Leisure',  met: 4.0 },
      { label: 'Moderate', met: 5.0 },
      { label: 'Vigorous', met: 7.0 },
    ],
  },
  {
    name: 'Martial Arts',
    intensities: [
      { label: 'Kata / Drills', met: 6.0  },
      { label: 'Sparring',      met: 10.0 },
    ],
  },
  {
    name: 'Pickleball',
    intensities: [
      { label: 'Recreational', met: 5.0 },
      { label: 'Competitive',  met: 7.0 },
    ],
  },
  {
    name: 'Pilates',
    intensities: [
      { label: 'Beginner',   met: 3.0 },
      { label: 'Moderate',   met: 4.0 },
      { label: 'Advanced',   met: 5.0 },
    ],
  },
  {
    name: 'Rock Climbing',
    intensities: [
      { label: 'Bouldering / Gym', met: 8.0  },
      { label: 'Sport climbing',   met: 10.0 },
    ],
  },
  {
    name: 'Rowing (machine)',
    intensities: [
      { label: 'Light',    met: 4.8 },
      { label: 'Moderate', met: 7.0 },
      { label: 'Vigorous', met: 8.5 },
    ],
  },
  {
    name: 'Running',
    intensities: [
      { label: 'Light jog (5 mph / 12 min mile)', met: 8.3  },
      { label: 'Moderate (6 mph / 10 min mile)',  met: 9.8  },
      { label: 'Vigorous (7 mph / 8.5 min mile)', met: 11.0 },
      { label: 'Fast (8 mph / 7.5 min mile)',     met: 11.8 },
      { label: 'Racing pace (9+ mph)',             met: 14.5 },
    ],
  },
  {
    name: 'Soccer',
    intensities: [
      { label: 'Recreational', met: 7.0  },
      { label: 'Competitive',  met: 10.0 },
    ],
  },
  {
    name: 'Sports (General)',
    intensities: [
      { label: 'Light',    met: 4.0 },
      { label: 'Moderate', met: 6.0 },
      { label: 'Vigorous', met: 8.0 },
    ],
  },
  {
    name: 'Stair Climbing',
    intensities: [
      { label: 'Moderate', met: 5.0 },
      { label: 'Vigorous', met: 8.0 },
    ],
  },
  {
    name: 'Swimming',
    intensities: [
      { label: 'Leisure',  met: 6.0  },
      { label: 'Moderate', met: 8.0  },
      { label: 'Vigorous', met: 10.0 },
    ],
  },
  {
    name: 'Tennis',
    intensities: [
      { label: 'Doubles',     met: 6.0 },
      { label: 'Singles',     met: 8.0 },
      { label: 'Competitive', met: 9.0 },
    ],
  },
  {
    name: 'Volleyball',
    intensities: [
      { label: 'Recreational', met: 4.0 },
      { label: 'Competitive',  met: 6.0 },
    ],
  },
  {
    name: 'Walking',
    intensities: [
      { label: 'Casual (2 mph)',  met: 2.5 },
      { label: 'Moderate (3 mph)', met: 3.5 },
      { label: 'Brisk (3.5 mph)', met: 4.3 },
      { label: 'Fast (4.5 mph)',  met: 5.0 },
    ],
  },
  {
    name: 'Weight Training',
    intensities: [
      { label: 'Light (general)',   met: 3.0 },
      { label: 'Moderate',          met: 5.0 },
      { label: 'Vigorous / Heavy',  met: 6.0 },
    ],
  },
  {
    name: 'Yoga',
    intensities: [
      { label: 'Hatha / Gentle',  met: 2.5 },
      { label: 'Flow / Vinyasa',  met: 4.0 },
      { label: 'Power / Hot Yoga', met: 6.0 },
    ],
  },
];

// ---- State ----

let activityDuration = 30; // minutes

// ---- Helpers ----

function getUserWeightKg() {
  if (!cachedUser || !cachedUser.weight) return 75; // ~165 lb fallback
  return cachedUser.unit === 'metric'
    ? cachedUser.weight
    : cachedUser.weight * 0.453592;
}

function estimateCalories(met, durationMin) {
  return Math.round(met * getUserWeightKg() * (durationMin / 60));
}

function getSelectedActivity() {
  const sel = document.getElementById('activity-select');
  return sel ? ACTIVITY_LIST[parseInt(sel.value, 10)] ?? null : null;
}

function getSelectedIntensity() {
  const activity = getSelectedActivity();
  const sel      = document.getElementById('intensity-select');
  if (!activity || !sel || sel.value === '') return null;
  return activity.intensities[parseInt(sel.value, 10)] ?? null;
}

// ---- UI updaters ----

function populateActivitySelect() {
  const sel = document.getElementById('activity-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">Choose an activity…</option>';
  ACTIVITY_LIST.forEach((act, i) => {
    const opt = document.createElement('option');
    opt.value       = i;
    opt.textContent = act.name;
    sel.appendChild(opt);
  });
}

function onActivityChange() {
  const activity       = getSelectedActivity();
  const intensityGroup = document.getElementById('intensity-group');
  const intensitySel   = document.getElementById('intensity-select');

  if (!activity || !intensityGroup || !intensitySel) return;

  intensityGroup.hidden = !activity;

  if (activity) {
    intensitySel.innerHTML = '';
    activity.intensities.forEach((iv, i) => {
      const opt       = document.createElement('option');
      opt.value       = i;
      opt.textContent = iv.label;
      intensitySel.appendChild(opt);
    });
  }

  updateEstimate();
}

function updateDurationDisplay() {
  const el = document.getElementById('dur-display');
  if (el) el.textContent = activityDuration;
}

function updateEstimate() {
  const estimateEl = document.getElementById('activity-estimate');
  const logBtn     = document.getElementById('activity-log-btn');
  const intensity  = getSelectedIntensity();

  if (!estimateEl) return;

  if (!intensity) {
    estimateEl.innerHTML = '';
    if (logBtn) logBtn.disabled = true;
    return;
  }

  const cal      = estimateCalories(intensity.met, activityDuration);
  const activity = getSelectedActivity();

  estimateEl.innerHTML = `
    <div class="activity-estimate-box">
      <span class="activity-estimate-lbl">Estimated Burn</span>
      <span class="activity-estimate-cal">${cal.toLocaleString()} cal</span>
      <span class="activity-estimate-meta">${activity.name} · ${intensity.label} · ${activityDuration} min</span>
    </div>
  `;

  if (logBtn) logBtn.disabled = false;
}

// ---- Modal open / close ----

function openActivityModal() {
  const modal = document.getElementById('activity-modal');
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Reset state
  activityDuration = 30;
  updateDurationDisplay();

  const actSel = document.getElementById('activity-select');
  if (actSel) actSel.value = '';

  const intensityGroup = document.getElementById('intensity-group');
  if (intensityGroup) intensityGroup.hidden = true;

  const estimateEl = document.getElementById('activity-estimate');
  if (estimateEl) estimateEl.innerHTML = '';

  const logBtn = document.getElementById('activity-log-btn');
  if (logBtn) {
    logBtn.disabled    = true;
    logBtn.textContent = 'Log It';
  }
}

function closeActivityModal() {
  const modal = document.getElementById('activity-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

// ---- Show toast ----

function showActivityToast(cal) {
  const toast = document.getElementById('activity-toast');
  if (!toast) return;
  toast.textContent = `Activity Logged · −${cal.toLocaleString()} cal`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---- Init ----

function initLogActivity() {
  // Intercept nav/button clicks
  document.querySelectorAll('a[href="log-activity.html"]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openActivityModal(); });
  });

  const modal   = document.getElementById('activity-modal');
  const closeBtn = document.getElementById('activity-close');

  closeBtn?.addEventListener('click', closeActivityModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeActivityModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) closeActivityModal();
  });

  populateActivitySelect();

  document.getElementById('activity-select')
    ?.addEventListener('change', onActivityChange);

  document.getElementById('intensity-select')
    ?.addEventListener('change', updateEstimate);

  document.getElementById('dur-minus')?.addEventListener('click', () => {
    if (activityDuration > 5) {
      activityDuration = Math.max(5, activityDuration - 5);
      updateDurationDisplay();
      updateEstimate();
    }
  });

  document.getElementById('dur-plus')?.addEventListener('click', () => {
    if (activityDuration < 480) {
      activityDuration = Math.min(480, activityDuration + 5);
      updateDurationDisplay();
      updateEstimate();
    }
  });

  document.getElementById('activity-log-btn')?.addEventListener('click', async () => {
    const activity  = getSelectedActivity();
    const intensity = getSelectedIntensity();
    if (!activity || !intensity) return;

    const cal = estimateCalories(intensity.met, activityDuration);
    const btn = document.getElementById('activity-log-btn');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    await store.addExerciseEntry({
      name:     `${activity.name} — ${intensity.label}`,
      duration: activityDuration,
      calories: cal,
      date:     todayKey(),
    });

    btn.disabled    = false;
    btn.textContent = 'Log It';
    closeActivityModal();
    showActivityToast(cal);
    if (typeof refreshHomeForToday === 'function') await refreshHomeForToday();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('home-page')) initLogActivity();
});
