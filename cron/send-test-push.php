<?php
// One-off manual test: sends a test push to every subscribed user, bypassing
// the "logged today" / local-evening checks in send-daily-reminder.php. Run
// by hand from the CLI when verifying push notifications end to end, e.g.:
//   php cron/send-test-push.php
// Optional first arg overrides the message body.
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../api/push-lib.php';

$message = $argv[1] ?? 'This is a Critical Fit test!';

$pdo = db();
$userIds = $pdo->query('SELECT DISTINCT user_id FROM push_subscriptions')->fetchAll(PDO::FETCH_COLUMN);

foreach ($userIds as $userId) {
    sendPushToUser($pdo, (int)$userId, [
        'title' => 'Critical Fit',
        'body'  => $message,
        'url'   => './index.html',
    ]);
    echo "Sent to user $userId\n";
}
