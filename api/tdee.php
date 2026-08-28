<?php
require_once __DIR__ . '/db.php';
$uid = requireAuth();
$pdo = db();

// User's stored initial TDEE and profile
$stmt = $pdo->prepare('SELECT bmr, tdee, activity FROM users WHERE id = ?');
$stmt->execute([$uid]);
$user = $stmt->fetch();

if (!$user || !$user['bmr']) {
    json_out(['personalizedTdee' => null, 'confidence' => 'estimated', 'confidenceDays' => 0]);
    exit;
}

// Initial TDEE: BMR x non-exercise lifestyle multiplier — the same basis
// used for the Life Points calc in energy.js (CF_LIFESTYLE). Deliberately
// lower than a traditional activity multiplier, which already assumes
// exercise is baked in — that would pre-credit calories before any
// exercise is logged or real weight data proves otherwise.
$CF_LIFESTYLE = ['sedentary' => 1.20, 'light' => 1.30, 'moderate' => 1.40, 'active' => 1.50];
$initialTdee  = (int)round($user['bmr'] * ($CF_LIFESTYLE[$user['activity']] ?? 1.20));

// ---- Last 35 days of weight entries ----
$stmt = $pdo->prepare("
    SELECT log_date, weight, unit FROM weight_entries
    WHERE user_id = ? AND log_date >= CURDATE() - INTERVAL 35 DAY
    ORDER BY log_date ASC
");
$stmt->execute([$uid]);
$wRows = $stmt->fetchAll();

// Convert all weights to lbs for consistent 3500 cal/lb math
$weightsByDate = [];
foreach ($wRows as $r) {
    $w = (float)$r['weight'];
    if ($r['unit'] === 'metric') $w *= 2.20462;
    $weightsByDate[$r['log_date']] = $w;
}

$entryCount  = count($weightsByDate);
$weightDates = array_keys($weightsByDate);
$weightVals  = array_values($weightsByDate);

// Not enough weight history — return initial TDEE as-is
if ($entryCount < 7) {
    json_out(['personalizedTdee' => $initialTdee, 'confidence' => 'estimated', 'confidenceDays' => $entryCount]);
    exit;
}

// Step 3: 7-day average (most recent 7 entries)
$last7   = array_slice($weightVals, -7);
$avg7    = array_sum($last7) / 7.0;

// Step 4: span of the window
$earliestWeight = $weightVals[0];
$earliestDate   = $weightDates[0];
$latestDate     = end($weightDates);
$daysDiff       = (int)round((strtotime($latestDate) - strtotime($earliestDate)) / 86400);

if ($daysDiff < 6) {
    json_out(['personalizedTdee' => $initialTdee, 'confidence' => 'estimated', 'confidenceDays' => $entryCount]);
    exit;
}

// Step 5: daily deficit/surplus (positive = deficit = weight loss)
$weightChangeLbs = $earliestWeight - $avg7;
if (abs($weightChangeLbs) / $daysDiff > 1.5) {
    // Implausibly large rate — data integrity issue, stay with initial
    json_out(['personalizedTdee' => $initialTdee, 'confidence' => 'estimated', 'confidenceDays' => $entryCount]);
    exit;
}
$dailyDeficit = ($weightChangeLbs * 3500.0) / $daysDiff;

// Step 6: average daily food calories over the same window (exclude days < 200 cal as incomplete)
$stmt = $pdo->prepare("
    SELECT AVG(daily_cal) AS avg_cal
    FROM (
        SELECT log_date, SUM(calories) AS daily_cal
        FROM food_entries
        WHERE user_id = ? AND log_date >= ?
        GROUP BY log_date
        HAVING SUM(calories) > 200
    ) AS t
");
$stmt->execute([$uid, $earliestDate]);
$foodRow     = $stmt->fetch();
$avgCalories = $foodRow ? (float)$foodRow['avg_cal'] : 0;

if ($avgCalories < 500) {
    json_out(['personalizedTdee' => $initialTdee, 'confidence' => 'estimated', 'confidenceDays' => $entryCount]);
    exit;
}

// Observed TDEE
$observedTdee = (int)round($avgCalories + $dailyDeficit);

// Sanity bounds
if ($observedTdee < 1000 || $observedTdee > 6000) {
    json_out(['personalizedTdee' => $initialTdee, 'confidence' => 'estimated', 'confidenceDays' => $entryCount]);
    exit;
}

// Step 7 & 8: confidence level and blend weights
if ($entryCount < 28) {
    $confidence       = 'observed';
    $observedFraction = ($entryCount - 7) / 21.0 * 0.70; // ramps 0 → 0.70 over days 7–27
} else {
    $confidence       = 'personalized';
    $observedFraction = 0.80;
}
$initialFraction  = 1.0 - $observedFraction;

$personalizedTdee = (int)round($initialTdee * $initialFraction + $observedTdee * $observedFraction);

json_out([
    'personalizedTdee' => $personalizedTdee,
    'confidence'       => $confidence,
    'confidenceDays'   => $entryCount,
]);
exit;
