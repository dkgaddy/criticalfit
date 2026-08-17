// ============================================================
// Critical Fit — Log Weight Modal
// ============================================================

let currentWeight = 0;

function weightStep() {
  return (cachedUser && cachedUser.unit === 'metric') ? 0.1 : 0.5;
}

function weightUnitLabel() {
  return (cachedUser && cachedUser.unit === 'metric') ? 'kg' : 'lbs';
}

function updateWeightDisplay() {
  const el   = document.getElementById('weight-display');
  const unit = document.getElementById('weight-unit-lbl');
  if (el)   el.textContent  = currentWeight.toFixed(1);
  if (unit) unit.textContent = weightUnitLabel();
}

function openWeightModal() {
  const modal = document.getElementById('weight-modal');
  if (!modal) return;

  currentWeight = (cachedUser && cachedUser.weight) ? cachedUser.weight : 150;
  updateWeightDisplay();

  const btn = document.getElementById('weight-log-btn');
  if (btn) { btn.disabled = false; btn.textContent = 'Log Weight'; }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeWeightModal() {
  const modal = document.getElementById('weight-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function showWeightToast(weight, unit) {
  const toast = document.getElementById('weight-toast');
  if (!toast) return;
  toast.textContent = `Weight Logged · ${weight.toFixed(1)} ${unit}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function initLogWeight() {
  document.querySelectorAll('a[href="log-weight.html"]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openWeightModal(); });
  });

  const modal    = document.getElementById('weight-modal');
  const closeBtn = document.getElementById('weight-close');

  closeBtn?.addEventListener('click', closeWeightModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeWeightModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) closeWeightModal();
  });

  document.getElementById('weight-minus')?.addEventListener('click', () => {
    const step = weightStep();
    currentWeight = Math.max(step, Math.round((currentWeight - step) * 10) / 10);
    updateWeightDisplay();
  });

  document.getElementById('weight-plus')?.addEventListener('click', () => {
    const step = weightStep();
    currentWeight = Math.round((currentWeight + step) * 10) / 10;
    updateWeightDisplay();
  });

  document.getElementById('weight-log-btn')?.addEventListener('click', async () => {
    const unit = weightUnitLabel();
    const btn  = document.getElementById('weight-log-btn');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    const res = await fetch('api/weight.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        weight: currentWeight,
        unit:   cachedUser?.unit ?? 'imperial',
        date:   new Date().toISOString().slice(0, 10),
      }),
    });
    const j = await res.json();

    if (j.ok) {
      if (cachedUser) cachedUser.weight = currentWeight;
      closeWeightModal();
      showWeightToast(currentWeight, unit);
      if (typeof renderEnergyUsed === 'function') renderEnergyUsed();
    } else {
      btn.disabled    = false;
      btn.textContent = 'Log Weight';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('home-page')) initLogWeight();
});
