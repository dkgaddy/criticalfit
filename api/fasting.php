<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/fasting-lib.php';
$uid = requireAuth();
$pdo = db();
ensureFastingTable($pdo);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_err('Method not allowed', 405);
    exit;
}

$b    = json_decode(file_get_contents('php://input'), true) ?? [];
$date = $b['date'] ?? '';
if (!validDate($date)) { json_err('Invalid date'); exit; }

if (!empty($b['fasting'])) {
    $pdo->prepare('INSERT IGNORE INTO fasting_days (user_id, fast_date) VALUES (?, ?)')
        ->execute([$uid, $date]);
} else {
    $pdo->prepare('DELETE FROM fasting_days WHERE user_id = ? AND fast_date = ?')
        ->execute([$uid, $date]);
}

json_out(['fasting' => !empty($b['fasting'])]);
exit;
