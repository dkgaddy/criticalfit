<?php
// Run only from cPanel's Cron Jobs (CLI), never over HTTP — this script isn't
// meant to be web-reachable at all, but refuse anyway as defense-in-depth.
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../api/push-lib.php';

$pdo = db();

// Users who've opted in and haven't logged any food today (server-local date
// — not per-user timezone; acceptable at current scale, see plan notes).
$stmt = $pdo->query(
    "SELECT u.id FROM users u
     WHERE u.notifications = 1
       AND NOT EXISTS (
         SELECT 1 FROM food_entries f WHERE f.user_id = u.id AND f.log_date = CURDATE()
       )"
);

foreach ($stmt->fetchAll() as $row) {
    sendPushToUser($pdo, (int)$row['id'], [
        'title' => 'Your dragon is waiting 🐉',
        'body'  => "You haven't logged any rations today.",
        'url'   => './index.html',
    ]);
}
