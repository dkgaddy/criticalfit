<?php
require_once __DIR__ . '/config.php';

function db(): PDO {
    static $pdo;
    if ($pdo) return $pdo;
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

function sessionStart(): void {
    if (session_status() !== PHP_SESSION_NONE) return;
    $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 86400 * 30,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function currentUserId(): ?int {
    sessionStart();
    return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
}

function requireAuth(): int {
    $uid = currentUserId();
    if (!$uid) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Not authenticated']);
        exit;
    }
    // Expire sessions after 30 days of inactivity (measured from last use, not login)
    if (time() - ($_SESSION['_last_activity'] ?? time()) > 86400 * 30) {
        session_unset();
        session_destroy();
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Session expired']);
        exit;
    }
    $_SESSION['_last_activity'] = time();
    return $uid;
}

function json_out(mixed $data): void {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'data' => $data]);
}

function json_err(string $msg, int $code = 400): void {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
}

// Always use REMOTE_ADDR — X-Forwarded-For is client-spoofable on shared hosting
function clientIp(): string {
    return substr($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', 0, 45);
}

// Validates YYYY-MM-DD and confirms the date is a real calendar date
function validDate(string $date): bool {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return false;
    [$y, $m, $d] = explode('-', $date);
    return checkdate((int)$m, (int)$d, (int)$y);
}

// Simple DB-backed rate limiter. Returns false when the limit is exceeded.
function checkRateLimit(string $ip, string $action, int $max, int $windowSecs): bool {
    static $ready = false;
    if (!$ready) {
        try {
            db()->exec('CREATE TABLE IF NOT EXISTS auth_attempts (
                id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                ip           VARCHAR(45)  NOT NULL,
                action       VARCHAR(20)  NOT NULL,
                attempted_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_lookup (ip, action, attempted_at)
            )');
        } catch (Exception $e) {}
        $ready = true;
    }
    $cutoff = date('Y-m-d H:i:s', time() - $windowSecs);
    $stmt = db()->prepare(
        'SELECT COUNT(*) FROM auth_attempts WHERE ip = ? AND action = ? AND attempted_at >= ?'
    );
    $stmt->execute([$ip, $action, $cutoff]);
    if ((int)$stmt->fetchColumn() >= $max) return false;
    db()->prepare('INSERT INTO auth_attempts (ip, action) VALUES (?, ?)')->execute([$ip, $action]);
    // Probabilistic cleanup to keep the table small
    if (rand(1, 50) === 1) {
        db()->exec("DELETE FROM auth_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 1 DAY)");
    }
    return true;
}
