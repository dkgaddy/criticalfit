<?php
require_once __DIR__ . '/db.php';
$uid = requireAuth();
$pdo = db();

if (empty($_SESSION['_visit_ddl'])) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS visit_log (
            id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id    INT UNSIGNED NOT NULL,
            ip_address VARCHAR(45)  NOT NULL DEFAULT '',
            page       VARCHAR(100) NOT NULL DEFAULT '',
            visited_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user (user_id),
            INDEX idx_date (visited_at)
        )");
    } catch (Exception $e) {}
    $_SESSION['_visit_ddl'] = 1;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_err('Method not allowed', 405); exit;
}

$b    = json_decode(file_get_contents('php://input'), true) ?? [];
$page = substr(preg_replace('/[^a-z0-9\-_]/', '', strtolower($b['page'] ?? 'unknown')), 0, 100);

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ip = trim(explode(',', $ip)[0]);
$ip = substr($ip, 0, 45);

$pdo->prepare('INSERT INTO visit_log (user_id, ip_address, page) VALUES (?, ?, ?)')
    ->execute([$uid, $ip, $page]);

json_out(['logged' => true]);
exit;
