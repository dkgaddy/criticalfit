<?php
require_once __DIR__ . '/db.php';
$uid    = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->prepare(
        'SELECT m.id, m.name,
                COUNT(mi.id)                  AS item_count,
                COALESCE(SUM(mi.calories), 0) AS total_calories,
                COALESCE(SUM(mi.protein),  0) AS total_protein,
                COALESCE(SUM(mi.carbs),    0) AS total_carbs,
                COALESCE(SUM(mi.fat),      0) AS total_fat
         FROM meals m
         LEFT JOIN meal_items mi ON mi.meal_id = m.id
         WHERE m.user_id = ?
         GROUP BY m.id
         ORDER BY m.name'
    );
    $stmt->execute([$uid]);
    $rows = array_map(function ($r) {
        return [
            'id'            => (int)$r['id'],
            'name'          => $r['name'],
            'itemCount'     => (int)$r['item_count'],
            'totalCalories' => (int)round((float)$r['total_calories']),
            'totalProtein'  => round((float)$r['total_protein'], 1),
            'totalCarbs'    => round((float)$r['total_carbs'],   1),
            'totalFat'      => round((float)$r['total_fat'],     1),
        ];
    }, $stmt->fetchAll());
    json_out($rows); exit;
}

if ($method === 'POST') {
    $b      = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $b['action'] ?? '';

    if ($action === 'create') {
        $name = trim($b['name'] ?? '');
        if ($name === '') { json_err('Name required'); exit; }
        $stmt = db()->prepare('INSERT INTO meals (user_id, name) VALUES (?, ?)');
        $stmt->execute([$uid, $name]);
        json_out(['id' => (int)db()->lastInsertId()]); exit;
    }

    if ($action === 'update') {
        $id   = (int)($b['id']   ?? 0);
        $name = trim($b['name'] ?? '');
        if (!$id || $name === '') { json_err('id and name required'); exit; }
        $stmt = db()->prepare('UPDATE meals SET name = ? WHERE id = ? AND user_id = ?');
        $stmt->execute([$name, $id, $uid]);
        json_out(null); exit;
    }

    if ($action === 'delete') {
        $id = (int)($b['id'] ?? 0);
        if (!$id) { json_err('id required'); exit; }
        $check = db()->prepare('SELECT id FROM meals WHERE id = ? AND user_id = ?');
        $check->execute([$id, $uid]);
        if (!$check->fetch()) { json_err('Not found', 404); exit; }
        db()->prepare('DELETE FROM meal_items WHERE meal_id = ?')->execute([$id]);
        db()->prepare('DELETE FROM meals WHERE id = ?')->execute([$id]);
        json_out(null); exit;
    }

    if ($action === 'log') {
        $id   = (int)($b['id']   ?? 0);
        $date = $b['date'] ?? date('Y-m-d');
        if (!$id) { json_err('id required'); exit; }
        $check = db()->prepare('SELECT id FROM meals WHERE id = ? AND user_id = ?');
        $check->execute([$id, $uid]);
        if (!$check->fetch()) { json_err('Not found', 404); exit; }
        $stmt = db()->prepare(
            'INSERT INTO food_entries (user_id, log_date, fdc_id, name, grams, calories, protein, carbs, fat)
             SELECT ?, ?, fdc_id, name, grams, calories, protein, carbs, fat
             FROM meal_items WHERE meal_id = ?'
        );
        $stmt->execute([$uid, $date, $id]);
        json_out(['logged' => $stmt->rowCount()]); exit;
    }

    json_err('Unknown action'); exit;
}

json_err('Method not allowed', 405); exit;
