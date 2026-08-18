<?php
require_once __DIR__ . '/db.php';
$uid  = requireAuth();
$pdo  = db();
$days = min((int)($_GET['days'] ?? 30), 365);

// Food aggregated by day
$stmt = $pdo->prepare("
    SELECT log_date,
           ROUND(SUM(calories), 0) AS calories,
           ROUND(SUM(carbs),    1) AS carbs,
           ROUND(SUM(fat),      1) AS fat,
           ROUND(SUM(protein),  1) AS protein
    FROM food_entries
    WHERE user_id = ? AND log_date >= CURDATE() - INTERVAL ? DAY
    GROUP BY log_date ORDER BY log_date
");
$stmt->execute([$uid, $days]);
$foodRows = $stmt->fetchAll();

// Exercise aggregated by day
$stmt = $pdo->prepare("
    SELECT log_date, ROUND(SUM(calories), 0) AS calories
    FROM exercise_entries
    WHERE user_id = ? AND log_date >= CURDATE() - INTERVAL ? DAY
    GROUP BY log_date ORDER BY log_date
");
$stmt->execute([$uid, $days]);
$exerciseRows = $stmt->fetchAll();

// Weight entries
$stmt = $pdo->prepare("
    SELECT log_date, weight
    FROM weight_entries
    WHERE user_id = ? AND log_date >= CURDATE() - INTERVAL ? DAY
    ORDER BY log_date
");
$stmt->execute([$uid, $days]);
$weightRows = $stmt->fetchAll();

// Index by date
$food = [];
foreach ($foodRows as $r) {
    $food[$r['log_date']] = [
        'calories' => (float)$r['calories'],
        'carbs'    => (float)$r['carbs'],
        'fat'      => (float)$r['fat'],
        'protein'  => (float)$r['protein'],
    ];
}

$exercise = [];
foreach ($exerciseRows as $r) $exercise[$r['log_date']] = (float)$r['calories'];

$weights = [];
foreach ($weightRows as $r) $weights[$r['log_date']] = (float)$r['weight'];

json_out(['food' => $food, 'exercise' => $exercise, 'weights' => $weights]);
exit;
