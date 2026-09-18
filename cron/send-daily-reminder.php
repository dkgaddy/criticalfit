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

// Users who've opted in and haven't logged any food today. The server clock
// is UTC; the app itself has no per-user timezone field, so this uses a
// single fixed zone (Central) rather than the server's date — CURDATE()
// would be wrong here because a Central-evening cron run lands right at (or
// past) the UTC day rollover, making "today" on the server actually
// tomorrow from the user's perspective.
$today = (new DateTime('now', new DateTimeZone('America/Chicago')))->format('Y-m-d');

$stmt = $pdo->prepare(
    "SELECT u.id FROM users u
     WHERE u.notifications = 1
       AND NOT EXISTS (
         SELECT 1 FROM food_entries f WHERE f.user_id = u.id AND f.log_date = ?
       )"
);
$stmt->execute([$today]);

foreach ($stmt->fetchAll() as $row) {
    sendPushToUser($pdo, (int)$row['id'], [
        'title' => 'Your dragon is waiting 🐉',
        'body'  => "You haven't logged any rations today.",
        'url'   => './index.html',
    ]);
}
