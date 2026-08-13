<?php
require_once __DIR__ . '/db.php';
$uid  = requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->prepare('SELECT streak, max_level FROM dragon_progress WHERE user_id = ?');
    $stmt->execute([$uid]);
    $row = $stmt->fetch();
    json_out($row
        ? ['streak' => (int)$row['streak'], 'maxLevel' => (int)$row['max_level']]
        : ['streak' => 0, 'maxLevel' => 0]
    );

} elseif ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true) ?? [];
    db()->prepare(
        'INSERT INTO dragon_progress (user_id, streak, max_level) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE streak=VALUES(streak), max_level=VALUES(max_level)'
    )->execute([$uid, (int)($b['streak'] ?? 0), (int)($b['maxLevel'] ?? 0)]);
    json_out(['saved' => true]);

} else {
    json_err('Method not allowed', 405);
}
