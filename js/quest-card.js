// ============================================================
// Critical Fit — Daily Quest card on the Journal
// ============================================================

'use strict';

const QUEST_EQUIPMENT_ICONS = {
  dumbbells: 'fa-dumbbell',
  bands:     'fa-link',
  bench:     'fa-chair',
  anchor:    'fa-anchor',
};

function questEquipmentIconsHtml(stations) {
  const items = new Set();
  (stations || []).forEach(st => (st.equipment || []).forEach(e => items.add(e)));
  if (items.size === 0) return '';
  return `<span class="quest-equip-icons">${[...items].map(e =>
    `<i class="fa-solid ${QUEST_EQUIPMENT_ICONS[e] || 'fa-dumbbell'}" title="${e}"></i>`
  ).join('')}</span>`;
}

function renderQuestCard(quest) {
  const el = document.getElementById('quest-card-content');
  if (!el || !quest) return;

  const dayTypeLabel = { upper: 'Upper Body', lower: 'Lower Body', full: 'Full Body' }[quest.dayType] || quest.dayType;

  if (quest.locked) {
    el.innerHTML = `
      <div class="quest-card-head">
        <i class="fa-solid fa-lock quest-card-lock"></i>
        <div>
          <p class="quest-card-title">Today's Quest: ${quest.name}</p>
          <p class="quest-card-meta">${dayTypeLabel} · ${quest.durationMin} min</p>
        </div>
      </div>
      <button class="btn btn-primary btn-full" id="quest-card-cta" style="margin-top:0.85rem;">Join the Guild to accept</button>
    `;
    document.getElementById('quest-card-cta')?.addEventListener('click', () => {
      document.getElementById('guild-gate-modal')?.classList.add('open');
    });
    return;
  }

  if (quest.status === 'completed') {
    el.innerHTML = `
      <div class="quest-card-head">
        <i class="fa-solid fa-circle-check quest-card-check"></i>
        <div>
          <p class="quest-card-title">${quest.name}</p>
          <p class="quest-card-meta">${dayTypeLabel} · Quest complete ✓</p>
        </div>
      </div>
      <button class="btn btn-secondary btn-full" id="quest-card-cta" style="margin-top:0.85rem;">View Summary</button>
    `;
    document.getElementById('quest-card-cta')?.addEventListener('click', () => {
      window.location.href = 'quest.html';
    });
    return;
  }

  const ctaLabel = quest.status === 'active' ? 'Resume Quest' : 'View Quest';
  el.innerHTML = `
    <div class="quest-card-head">
      <i class="fa-solid fa-dragon quest-card-icon"></i>
      <div>
        <p class="quest-card-title">Today's Quest: ${quest.name}</p>
        <p class="quest-card-meta">${dayTypeLabel} · ${quest.durationMin} min ${questEquipmentIconsHtml(quest.stations)}</p>
      </div>
    </div>
    <p class="quest-card-campaign">Weekly Campaign ${quest.weeklyCampaign.completed}/${quest.weeklyCampaign.target}</p>
    <button class="btn btn-primary btn-full" id="quest-card-cta" style="margin-top:0.6rem;">${ctaLabel}</button>
  `;
  document.getElementById('quest-card-cta')?.addEventListener('click', () => {
    window.location.href = 'quest.html';
  });
}

async function loadQuestCard() {
  try {
    const r = await fetch('api/quests.php');
    const j = await r.json();
    if (j.ok) renderQuestCard(j.data);
  } catch (e) { /* Journal still works without the quest card */ }
  applyQuestCardDateState();
}

// Quests only ever concern "today" — the card's own content never changes
// based on which day is being viewed, so viewing a past/future day on the
// Journal just disables the button rather than re-fetching anything. Called
// here and again from app.js's shiftDay() whenever the viewed day changes.
function applyQuestCardDateState() {
  const btn = document.getElementById('quest-card-cta');
  if (!btn) return;

  const today = typeof viewingDate === 'undefined' || typeof todayKey !== 'function' || viewingDate === todayKey();
  btn.disabled      = !today;
  btn.title         = today ? '' : "Quests only apply to today — switch back to today's date first.";
  btn.style.opacity = today ? '' : '0.45';
  btn.style.cursor  = today ? '' : 'not-allowed';
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('home-page')) loadQuestCard();
});
