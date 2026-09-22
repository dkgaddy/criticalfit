<?php
require_once __DIR__ . '/config.php';
require_once dirname(__DIR__) . '/vendor/autoload.php';

use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

// Sends $payload (array, JSON-encoded) to every push subscription on file for
// $userId. Expired/gone subscriptions (HTTP 404/410) are pruned as they're
// encountered — standard Web Push hygiene, since browsers/OSes silently drop
// subscriptions and never tell the server directly.
function sendPushToUser(PDO $pdo, int $userId, array $payload): void {
    $stmt = $pdo->prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?');
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll();
    if (!$rows) return;

    $webPush = new WebPush([
        'VAPID' => [
            'subject'    => VAPID_SUBJECT,
            'publicKey'  => VAPID_PUBLIC_KEY,
            'privateKey' => VAPID_PRIVATE_KEY,
        ],
    ]);

    $body = json_encode($payload);

    foreach ($rows as $row) {
        $subscription = Subscription::create([
            'endpoint' => $row['endpoint'],
            'keys'     => ['p256dh' => $row['p256dh'], 'auth' => $row['auth']],
        ]);
        $webPush->queueNotification($subscription, $body);
    }

    foreach ($webPush->flush() as $report) {
        if ($report->isSuccess()) continue;
        if ($report->isSubscriptionExpired()) {
            $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
                ->execute([$report->getEndpoint()]);
        }
    }
}

// Sends $payload to every user who has at least one push subscription on
// file. Used for broadcast-style sends: the "Send Now" ad-hoc form and the
// per-schedule cron scripts (cron/push-<schedule>.php). Returns the number
// of users targeted.
function broadcastPush(PDO $pdo, array $payload): int {
    $userIds = $pdo->query('SELECT DISTINCT user_id FROM push_subscriptions')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($userIds as $userId) {
        sendPushToUser($pdo, (int)$userId, $payload);
    }
    return count($userIds);
}

// Creates the push_notifications table if it doesn't exist yet — lazy DDL,
// same pattern as push_subscriptions/weight_entries elsewhere in the app.
// Called from both api/push-admin.php (the DM's management page) and the
// per-schedule cron scripts, so a schedule can fire even before the DM has
// ever opened the admin page.
function ensurePushNotificationsTable(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS push_notifications (
        id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title      VARCHAR(255) NOT NULL,
        message    VARCHAR(500) NOT NULL,
        schedule   ENUM('daily_morning','daily_noon','daily_night','weekly','monthly') NOT NULL,
        active     TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
}

// Sends every active push_notifications row for $schedule to every
// subscribed user. Called by cron/push-<schedule>.php, one per schedule
// bucket (daily_morning, daily_noon, daily_night, weekly, monthly) — each
// cron job just needs to run at the time the DM wants that bucket to fire.
function sendScheduledPushes(PDO $pdo, string $schedule): void {
    ensurePushNotificationsTable($pdo);
    $stmt = $pdo->prepare('SELECT title, message FROM push_notifications WHERE schedule = ? AND active = 1');
    $stmt->execute([$schedule]);
    foreach ($stmt->fetchAll() as $row) {
        broadcastPush($pdo, [
            'title' => $row['title'],
            'body'  => $row['message'],
            'url'   => './index.html',
        ]);
    }
}
