<?php
require_once __DIR__ . '/db.php';
$uid  = requireAuth();
$date = $_GET['date'] ?? date('Y-m-d');
if (!validDate($date)) $date = date('Y-m-d');

$stmt = db()->prepare('
    SELECT
        COALESCE((SELECT SUM(calories) FROM food_entries     WHERE user_id = ? AND log_date = ?), 0) AS calories_in,
        COALESCE((SELECT SUM(calories) FROM exercise_entries WHERE user_id = ? AND log_date = ?), 0) AS calories_out
');
$stmt->execute([$uid, $date, $uid, $date]);
$row = $stmt->fetch();

json_out([
    'caloriesIn'  => (float)$row['calories_in'],
    'caloriesOut' => (float)$row['calories_out'],
]);
