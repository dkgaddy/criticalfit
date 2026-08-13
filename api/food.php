<?php
require_once __DIR__ . '/db.php';
$uid  = requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $date = $_GET['date'] ?? date('Y-m-d');
    $stmt = db()->prepare(
        'SELECT id, fdc_id as fdcId, name, grams, calories, protein, carbs, fat
         FROM food_entries WHERE user_id = ? AND log_date = ? ORDER BY created_at'
    );
    $stmt->execute([$uid, $date]);
    $rows = array_map(function ($r) {
        return [
            'id'       => (int)$r['id'],
            'fdcId'    => $r['fdcId'] ? (int)$r['fdcId'] : null,
            'name'     => $r['name'],
            'grams'    => $r['grams'] !== null ? (float)$r['grams'] : null,
            'calories' => (float)$r['calories'],
            'protein'  => $r['protein'] !== null ? (float)$r['protein'] : null,
            'carbs'    => $r['carbs'] !== null ? (float)$r['carbs'] : null,
            'fat'      => $r['fat'] !== null ? (float)$r['fat'] : null,
        ];
    }, $stmt->fetchAll());
    json_out($rows);

} elseif ($method === 'POST') {
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    $date = $b['date'] ?? date('Y-m-d');

    $stmt = db()->prepare(
        'INSERT INTO food_entries (user_id, log_date, fdc_id, name, grams, calories, protein, carbs, fat)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        USER_ID,
        $date,
        $b['fdcId']    ?? null,
        $b['name']     ?? '',
        $b['grams']    ?? null,
        $b['calories'] ?? 0,
        $b['protein']  ?? null,
        $b['carbs']    ?? null,
        $b['fat']      ?? null,
    ]);

    json_out(['id' => (int)db()->lastInsertId()]);

} else {
    json_err('Method not allowed', 405);
}
