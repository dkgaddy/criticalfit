<?php
require_once __DIR__ . '/db.php';
$uid = requireAuth();
$pdo = db();

$pdo->exec("CREATE TABLE IF NOT EXISTS weight_entries (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    weight     DECIMAL(6,2) NOT NULL,
    unit       VARCHAR(10) NOT NULL DEFAULT 'imperial',
    log_date   DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_date (user_id, log_date)
)");

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $days = min((int)($_GET['days'] ?? 90), 365);
    $stmt = $pdo->prepare(
        'SELECT log_date, weight, unit FROM weight_entries
         WHERE user_id = ? ORDER BY log_date ASC LIMIT ?'
    );
    $stmt->execute([$uid, $days]);
    json_out($stmt->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b      = json_decode(file_get_contents('php://input'), true) ?? [];
    $weight = round((float)($b['weight'] ?? 0), 2);
    $unit   = ($b['unit'] ?? 'imperial') === 'metric' ? 'metric' : 'imperial';
    $date   = $b['date'] ?? date('Y-m-d');

    if ($weight <= 0) json_err('Invalid weight');

    $pdo->prepare(
        'INSERT INTO weight_entries (user_id, weight, unit, log_date) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE weight = VALUES(weight), unit = VALUES(unit)'
    )->execute([$uid, $weight, $unit, $date]);

    $pdo->prepare('UPDATE users SET weight = ? WHERE id = ?')
        ->execute([$weight, $uid]);

    json_out(['logged' => true, 'weight' => $weight, 'unit' => $unit]);
}

json_err('Method not allowed', 405);
