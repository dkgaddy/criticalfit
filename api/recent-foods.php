<?php
require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->prepare(
        'SELECT fdc_id AS fdcId, name, calories, protein, carbs, fat
         FROM recent_foods WHERE user_id = ? ORDER BY used_at DESC LIMIT 20'
    );
    $stmt->execute([USER_ID]);
    $rows = array_map(function ($r) {
        return [
            'fdcId'    => $r['fdcId'] ? (int)$r['fdcId'] : null,
            'name'     => $r['name'],
            'calories' => (float)$r['calories'],
            'protein'  => $r['protein'] !== null ? (float)$r['protein'] : null,
            'carbs'    => $r['carbs']   !== null ? (float)$r['carbs']   : null,
            'fat'      => $r['fat']     !== null ? (float)$r['fat']     : null,
        ];
    }, $stmt->fetchAll());
    json_out($rows);

} elseif ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true) ?? [];
    db()->prepare(
        'INSERT INTO recent_foods (user_id, fdc_id, name, calories, protein, carbs, fat)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE used_at=NOW(), calories=VALUES(calories), protein=VALUES(protein), carbs=VALUES(carbs), fat=VALUES(fat)'
    )->execute([
        USER_ID,
        $b['fdcId']    ?? null,
        $b['name']     ?? '',
        $b['calories'] ?? 0,
        $b['protein']  ?? null,
        $b['carbs']    ?? null,
        $b['fat']      ?? null,
    ]);
    json_out(['saved' => true]);

} else {
    json_err('Method not allowed', 405);
}
