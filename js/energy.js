// ============================================================
// Critical Fit — Energy Expenditure Service
// ============================================================
// Single authoritative energy calculation. Never scatter
// calorie math elsewhere — always call calculateDailyEnergyState.

'use strict';

// Critical Fit lifestyle multipliers.
// These represent NON-EXERCISE baseline activity only.
// Deliberate exercise calories are added separately from logged training.
// These are intentionally lower than traditional TDEE multipliers.
const CF_LIFESTYLE = {
  sedentary: 1.20,
  light:     1.30,
  moderate:  1.40,
  active:    1.50,
};

// ---- BMR via Mifflin-St Jeor ----

function calcBMRFromProfile(user) {
  // Use stored BMR when available — preserves historical accuracy
  // (weight may have changed since that day was calculated)
  if (user.bmr && user.bmr > 0) return user.bmr;

  let weightKg, heightCm;
  if (user.unit === 'metric') {
    weightKg = user.weight || 0;
    heightCm = user.cm    || 0;
  } else {
    weightKg = (user.weight || 0) * 0.453592;
    heightCm = ((user.ft   || 0) * 12 + (user.in || 0)) * 2.54;
  }

  const age = user.age || 0;
  if (!weightKg || !heightCm || !age) return 0;

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(user.gender === 'female' ? base - 161 : base + 5);
}

// ---- Core calculation ----

/**
 * calculateDailyEnergyState
 *
 * Implements the Critical Fit energy model:
 *   energyUsedSoFar = baselineBurnSoFar + trainingCalories
 *
 * baselineBurnSoFar accrues continuously through the user's local day.
 * trainingCalories are incremental — never double-counted with baseline.
 *
 * @param {object} user             Profile from api/user.php
 * @param {Date}   now              Current timestamp (JS Date in local TZ)
 * @param {Array}  exerciseEntries  [{calories: number, ...}]
 * @param {number} caloriesConsumed Total kcal consumed for dateStr
 * @param {string} dateStr          'YYYY-MM-DD' of the day being viewed
 *
 * @returns {{
 *   caloriesConsumed: number,
 *   baselineDailyBurn: number,
 *   baselineBurnSoFar: number,
 *   trainingCalories: number,
 *   energyUsedSoFar: number,
 *   projectedDailyBurn: number,
 *   currentCalorieBalance: number,
 *   elapsedFraction: number,
 *   isToday: boolean,
 * }}
 */
function calculateDailyEnergyState(user, now, exerciseEntries, caloriesConsumed, dateStr) {
  const bmr           = calcBMRFromProfile(user);
  const multiplier    = CF_LIFESTYLE[user.activity] || CF_LIFESTYLE.sedentary;
  const baselineDailyBurn = Math.round(bmr * multiplier);

  // Local day boundaries.
  // 'YYYY-MM-DDT00:00:00' (no Z) is parsed in local timezone by all
  // modern JS engines, so start/end correctly straddle the local midnight.
  const startOfDay = new Date(dateStr + 'T00:00:00');
  const endOfDay   = new Date(dateStr + 'T00:00:00');
  endOfDay.setDate(endOfDay.getDate() + 1);
  // totalMs correctly reflects DST transitions (23 h or 25 h days)
  const totalMs = endOfDay.getTime() - startOfDay.getTime();

  // Build the local date string for 'now' without UTC conversion
  const localTodayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const isToday = dateStr === localTodayStr;

  // For today: accrue up to current time.
  // For a completed day: use full-day fraction (1.0).
  const referenceMs = isToday
    ? Math.min(now.getTime(), endOfDay.getTime())
    : endOfDay.getTime();

  const elapsedMs       = referenceMs - startOfDay.getTime();
  const elapsedFraction = Math.max(0, Math.min(elapsedMs / totalMs, 1));

  const baselineBurnSoFar = Math.round(baselineDailyBurn * elapsedFraction);

  // Incremental training calories — added directly, NOT via multiplier
  const trainingCalories = Math.round(
    (exerciseEntries || []).reduce((s, e) => s + (e.calories || 0), 0)
  );

  const energyUsedSoFar    = baselineBurnSoFar + trainingCalories;
  const projectedDailyBurn = baselineDailyBurn + trainingCalories;

  // Positive = deficit (burning more than consuming).
  // Negative = surplus.
  const currentCalorieBalance = energyUsedSoFar - Math.round(caloriesConsumed || 0);

  return {
    caloriesConsumed:    Math.round(caloriesConsumed || 0),
    baselineDailyBurn,
    baselineBurnSoFar,
    trainingCalories,
    energyUsedSoFar,
    projectedDailyBurn,
    currentCalorieBalance,
    elapsedFraction,
    isToday,
  };
}

// Node.js export — no-op in browser
if (typeof module !== 'undefined') {
  module.exports = { calculateDailyEnergyState, calcBMRFromProfile, CF_LIFESTYLE };
}
