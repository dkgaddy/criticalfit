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
// There's no shared "schedule" concept here: every notification owns its own
// cron script and delivery logic (simple broadcast, per-user-timezone
// conditional, whatever it needs). This table is purely a management layer —
// the DM can see what exists, edit its copy, and flip it active/inactive.
// schedule_description is free text set by the code that registers the
// notification (see registerPushNotification()), shown read-only in the UI.
function ensurePushNotificationsTable(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS push_notifications (
        id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        slug                 VARCHAR(64) NOT NULL UNIQUE,
        title                VARCHAR(255) NOT NULL,
        message              VARCHAR(500) NOT NULL,
        schedule_description VARCHAR(255) NOT NULL,
        active               TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
        created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
}

// Registers a notification's row the first time its cron script runs, so it
// shows up on the admin page with no manual DB step. No-ops (INSERT IGNORE)
// once the slug exists, so it never clobbers a title/message/active the DM
// has since edited — $title/$message/$scheduleDescription here are only the
// initial defaults.
function registerPushNotification(PDO $pdo, string $slug, string $title, string $message, string $scheduleDescription): void {
    $pdo->prepare(
        'INSERT IGNORE INTO push_notifications (slug, title, message, schedule_description, active) VALUES (?, ?, ?, ?, 1)'
    )->execute([$slug, $title, $message, $scheduleDescription]);
}

// Fetches a notification's current title/message by its internal slug —
// only if the DM has it switched on. Returns null if it's inactive, so
// callers can just skip sending without any extra check.
function activePushNotification(PDO $pdo, string $slug): ?array {
    $stmt = $pdo->prepare('SELECT title, message FROM push_notifications WHERE slug = ? AND active = 1');
    $stmt->execute([$slug]);
    $row = $stmt->fetch();
    return $row ?: null;
}
