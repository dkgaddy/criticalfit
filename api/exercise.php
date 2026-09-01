<?php
require_once __DIR__ . '/db.php';
$uid  = requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $date = $_GET['date'] ?? date('Y-m-d');
    if (!validDate($date)) $date = date('Y-m-d');
    $stmt = db()->prepare(
        'SELECT id, name, duration_min as duration, calories
         FROM exercise_entries WHERE user_id = ? AND log_date = ? ORDER BY created_at'
    );
    $stmt->execute([$uid, $date]);
    $rows = array_map(function ($r) {
        return [
            'id'       => (int)$r['id'],
            'name'     => $r['name'],
            'duration' => $r['duration'] !== null ? (int)$r['duration'] : null,
            'calories' => (float)$r['calories'],
        ];
    }, $stmt->fetchAll());
    json_out($rows);

} elseif ($method === 'POST') {
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    $date = $b['date'] ?? date('Y-m-d');
    if (!validDate($date)) $date = date('Y-m-d');

    $stmt = db()->prepare(
        'INSERT INTO exercise_entries (user_id, log_date, name, duration_min, calories)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $uid,
        $date,
        $b['name']     ?? '',
        $b['duration'] ?? null,
        $b['calories'] ?? 0,
    ]);

    json_out(['id' => (int)db()->lastInsertId()]);

} else {
    json_err('Method not allowed', 405);
}
