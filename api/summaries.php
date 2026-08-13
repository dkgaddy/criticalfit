<?php
require_once __DIR__ . '/db.php';
$uid  = requireAuth();

$days  = min((int)($_GET['days'] ?? 14), 90);
$start = date('Y-m-d', strtotime("-{$days} days"));

$stmt = db()->prepare(
    'SELECT log_date, SUM(calories) AS total FROM food_entries
     WHERE user_id = ? AND log_date >= ? GROUP BY log_date'
);
$stmt->execute([$uid, $start]);
$foodTotals = [];
foreach ($stmt->fetchAll() as $r) {
    $foodTotals[$r['log_date']] = (float)$r['total'];
}

$stmt = db()->prepare(
    'SELECT log_date, SUM(calories) AS total FROM exercise_entries
     WHERE user_id = ? AND log_date >= ? GROUP BY log_date'
);
$stmt->execute([$uid, $start]);
$exTotals = [];
foreach ($stmt->fetchAll() as $r) {
    $exTotals[$r['log_date']] = (float)$r['total'];
}

$result = [];
for ($i = $days - 1; $i >= 0; $i--) {
    $date     = date('Y-m-d', strtotime("-{$i} days"));
    $result[] = [
        'date'        => $date,
        'caloriesIn'  => $foodTotals[$date] ?? 0.0,
        'caloriesOut' => $exTotals[$date]   ?? 0.0,
    ];
}

json_out($result);
