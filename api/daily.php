<?php
require_once __DIR__ . '/db.php';

$date = $_GET['date'] ?? date('Y-m-d');

$stmt = db()->prepare('
    SELECT
        COALESCE((SELECT SUM(calories) FROM food_entries     WHERE user_id = ? AND log_date = ?), 0) AS calories_in,
        COALESCE((SELECT SUM(calories) FROM exercise_entries WHERE user_id = ? AND log_date = ?), 0) AS calories_out
');
$stmt->execute([USER_ID, $date, USER_ID, $date]);
$row = $stmt->fetch();

json_out([
    'caloriesIn'  => (float)$row['calories_in'],
    'caloriesOut' => (float)$row['calories_out'],
]);
