<?php
require_once dirname(__DIR__) . '/db.php';
sessionStart();

header('Content-Type: application/json; charset=utf-8');

$uid = currentUserId();
if (!$uid) {
    echo json_encode(['ok' => true, 'data' => null]);
    exit;
}

$stmt = db()->prepare('SELECT id, display_name, first_seen FROM users WHERE id = ?');
$stmt->execute([$uid]);
$user = $stmt->fetch();

echo json_encode(['ok' => true, 'data' => $user ?: null]);
