<?php
require_once __DIR__ . '/db.php';
$uid    = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

function ownsMeal(int $uid, int $mealId): bool {
    $stmt = db()->prepare('SELECT id FROM meals WHERE id = ? AND user_id = ?');
    $stmt->execute([$mealId, $uid]);
    return (bool)$stmt->fetch();
}

if ($method === 'GET') {
    $mealId = (int)($_GET['meal_id'] ?? 0);
    if (!$mealId) { json_err('meal_id required'); exit; }
    if (!ownsMeal($uid, $mealId)) { json_err('Not found', 404); exit; }

    $stmt = db()->prepare(
        'SELECT id, name, fdc_id AS fdcId, calories, protein, carbs, fat, grams,
                serving_desc AS servingDesc
         FROM meal_items WHERE meal_id = ? ORDER BY id'
    );
    $stmt->execute([$mealId]);
    $rows = array_map(function ($r) {
        return [
            'id'          => (int)$r['id'],
            'name'        => $r['name'],
            'fdcId'       => $r['fdcId'] ? (int)$r['fdcId'] : null,
            'calories'    => (float)$r['calories'],
            'protein'     => (float)$r['protein'],
            'carbs'       => (float)$r['carbs'],
            'fat'         => (float)$r['fat'],
            'grams'       => $r['grams'] !== null ? (float)$r['grams'] : null,
            'servingDesc' => $r['servingDesc'],
        ];
    }, $stmt->fetchAll());
    json_out($rows); exit;
}

if ($method === 'POST') {
    $b      = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $b['action'] ?? '';

    if ($action === 'add') {
        $mealId = (int)($b['meal_id'] ?? 0);
        if (!$mealId) { json_err('meal_id required'); exit; }
        if (!ownsMeal($uid, $mealId)) { json_err('Not found', 404); exit; }
        $name = trim($b['name'] ?? '');
        if ($name === '') { json_err('name required'); exit; }

        $stmt = db()->prepare(
            'INSERT INTO meal_items (meal_id, name, fdc_id, calories, protein, carbs, fat, grams, serving_desc)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $mealId,
            $name,
            $b['fdcId']       ?? null,
            (float)($b['calories']    ?? 0),
            (float)($b['protein']     ?? 0),
            (float)($b['carbs']       ?? 0),
            (float)($b['fat']         ?? 0),
            isset($b['grams']) ? (float)$b['grams'] : null,
            $b['serving_desc'] ?? null,
        ]);
        json_out(['id' => (int)db()->lastInsertId()]); exit;
    }

    if ($action === 'remove') {
        $id = (int)($b['id'] ?? 0);
        if (!$id) { json_err('id required'); exit; }
        $stmt = db()->prepare(
            'DELETE mi FROM meal_items mi
             JOIN meals m ON m.id = mi.meal_id
             WHERE mi.id = ? AND m.user_id = ?'
        );
        $stmt->execute([$id, $uid]);
        json_out(null); exit;
    }

    json_err('Unknown action'); exit;
}

json_err('Method not allowed', 405); exit;
