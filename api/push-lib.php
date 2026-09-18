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
