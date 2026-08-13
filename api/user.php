<?php
require_once __DIR__ . '/db.php';
$uid  = requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $row = $stmt->fetch();
    if (!$row) { json_out(null); exit; }

    json_out([
        'name'       => $row['name'],
        'gender'     => $row['gender'],
        'age'        => $row['age'] !== null ? (int)$row['age'] : null,
        'unit'       => $row['unit'],
        'activity'   => $row['activity'],
        'weight'     => $row['weight'] !== null ? (float)$row['weight'] : null,
        'goalWeight' => $row['goal_weight'] !== null ? (float)$row['goal_weight'] : null,
        'ft'         => $row['height_ft'] !== null ? (int)$row['height_ft'] : null,
        'in'         => $row['height_in'] !== null ? (int)$row['height_in'] : null,
        'cm'         => $row['height_cm'] !== null ? (float)$row['height_cm'] : null,
        'bmr'        => $row['bmr'] !== null ? (int)$row['bmr'] : null,
        'tdee'       => $row['tdee'] !== null ? (int)$row['tdee'] : null,
        'dailyGoal'  => $row['daily_goal'] !== null ? (int)$row['daily_goal'] : null,
    ]);

} elseif ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true) ?? [];

    $sql = 'INSERT INTO users
              (id, name, gender, age, unit, activity, weight, goal_weight, height_ft, height_in, height_cm, bmr, tdee, daily_goal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              name=VALUES(name), gender=VALUES(gender), age=VALUES(age),
              unit=VALUES(unit), activity=VALUES(activity),
              weight=VALUES(weight), goal_weight=VALUES(goal_weight),
              height_ft=VALUES(height_ft), height_in=VALUES(height_in), height_cm=VALUES(height_cm),
              bmr=VALUES(bmr), tdee=VALUES(tdee), daily_goal=VALUES(daily_goal)';

    db()->prepare($sql)->execute([
        $uid,
        $b['name']       ?? null,
        $b['gender']     ?? 'male',
        $b['age']        ?? null,
        $b['unit']       ?? 'imperial',
        $b['activity']   ?? 'sedentary',
        $b['weight']     ?? null,
        $b['goalWeight'] ?? null,
        $b['ft']         ?? null,
        $b['in']         ?? null,
        $b['cm']         ?? null,
        $b['bmr']        ?? null,
        $b['tdee']       ?? null,
        $b['dailyGoal']  ?? null,
    ]);

    json_out(['saved' => true]);

} else {
    json_err('Method not allowed', 405);
}
