<?php
require_once __DIR__ . '/db.php';
$uid = requireAuth();
$pdo = db();

if (empty($_SESSION['_push_ddl'])) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS push_subscriptions (
            id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id    INT UNSIGNED NOT NULL,
            endpoint   VARCHAR(512) NOT NULL,
            p256dh     VARCHAR(255) NOT NULL,
            auth       VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_endpoint (endpoint(255)),
            INDEX idx_user (user_id)
        )");
    } catch (Exception $e) {}
    $_SESSION['_push_ddl'] = 1;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b        = json_decode(file_get_contents('php://input'), true) ?? [];
    $endpoint = trim($b['endpoint'] ?? '');
    $p256dh   = trim($b['keys']['p256dh'] ?? '');
    $auth     = trim($b['keys']['auth'] ?? '');

    if ($endpoint === '' || $p256dh === '' || $auth === '') {
        json_err('Invalid subscription');
        exit;
    }

    $pdo->prepare(
        'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)'
    )->execute([$uid, $endpoint, $p256dh, $auth]);

    json_out(['subscribed' => true]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $endpoint = $_GET['endpoint'] ?? '';
    if ($endpoint === '') { json_err('Invalid endpoint'); exit; }

    $pdo->prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
        ->execute([$uid, $endpoint]);

    json_out(['deleted' => true]);
    exit;
}

json_err('Method not allowed', 405);
exit;
