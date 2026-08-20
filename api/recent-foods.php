<?php
require_once __DIR__ . '/db.php';
$uid  = requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->prepare(
        'SELECT fdc_id AS fdcId, name, calories, protein, carbs, fat, serving_desc, grams_per_serving
         FROM recent_foods WHERE user_id = ? ORDER BY used_at DESC LIMIT 20'
    );
    $stmt->execute([$uid]);
    $rows = array_map(function ($r) {
        $out = [
            'fdcId'    => $r['fdcId'] ? (int)$r['fdcId'] : null,
            'name'     => $r['name'],
            'calories' => (float)$r['calories'],
            'protein'  => $r['protein'] !== null ? (float)$r['protein'] : null,
            'carbs'    => $r['carbs']   !== null ? (float)$r['carbs']   : null,
            'fat'      => $r['fat']     !== null ? (float)$r['fat']     : null,
        ];
        // Include AI serving info when present
        if ($r['serving_desc']) $out['serving_desc'] = $r['serving_desc'];
        if ($r['grams_per_serving']) $out['grams'] = (float)$r['grams_per_serving'];
        return $out;
    }, $stmt->fetchAll());
    json_out($rows);

} elseif ($method === 'POST') {
    $b           = json_decode(file_get_contents('php://input'), true) ?? [];
    $fdcId       = $b['fdcId']        ?? null;
    $servingDesc = $b['serving_desc'] ?? null;
    $grams       = isset($b['grams']) ? (float)$b['grams'] : null;

    if ($fdcId !== null) {
        // USDA food: upsert on (user_id, fdc_id)
        db()->prepare(
            'INSERT INTO recent_foods (user_id, fdc_id, name, calories, protein, carbs, fat, serving_desc, grams_per_serving)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE used_at=NOW(), calories=VALUES(calories), protein=VALUES(protein),
               carbs=VALUES(carbs), fat=VALUES(fat), serving_desc=VALUES(serving_desc), grams_per_serving=VALUES(grams_per_serving)'
        )->execute([
            $uid, $fdcId, $b['name'] ?? '', $b['calories'] ?? 0,
            $b['protein'] ?? null, $b['carbs'] ?? null, $b['fat'] ?? null,
            $servingDesc, $grams,
        ]);
    } else {
        // AI food (no fdcId): upsert on (user_id, name)
        db()->prepare(
            'INSERT INTO recent_foods (user_id, fdc_id, name, calories, protein, carbs, fat, serving_desc, grams_per_serving)
             VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE used_at=NOW(), calories=VALUES(calories), protein=VALUES(protein),
               carbs=VALUES(carbs), fat=VALUES(fat), serving_desc=VALUES(serving_desc), grams_per_serving=VALUES(grams_per_serving)'
        )->execute([
            $uid, $b['name'] ?? '', $b['calories'] ?? 0,
            $b['protein'] ?? null, $b['carbs'] ?? null, $b['fat'] ?? null,
            $servingDesc, $grams,
        ]);
    }
    json_out(['saved' => true]);

} else {
    json_err('Method not allowed', 405);
}
