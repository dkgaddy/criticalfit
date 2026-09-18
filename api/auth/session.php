<?php
require_once dirname(__DIR__) . '/db.php';
sessionStart();

header('Content-Type: application/json; charset=utf-8');

$uid = currentUserId();
if (!$uid) {
    echo json_encode(['ok' => true, 'data' => null]);
    exit;
}

if (empty($_SESSION['_tz_migration'])) {
    try { db()->exec('ALTER TABLE users ADD COLUMN timezone VARCHAR(64) NULL'); } catch (PDOException $e) {}
    $_SESSION['_tz_migration'] = 1;
}

// Silently keep each user's IANA timezone current — called on every page
// load via checkAuth(), so this is where per-user "today" logic (e.g. the
// daily reminder cron) gets its data from, instead of guessing one zone
// for everyone.
$tz = $_GET['tz'] ?? '';
if ($tz !== '' && in_array($tz, DateTimeZone::listIdentifiers(), true)) {
    db()->prepare('UPDATE users SET timezone = ? WHERE id = ? AND (timezone IS NULL OR timezone <> ?)')
        ->execute([$tz, $uid, $tz]);
}

$stmt = db()->prepare('SELECT id, display_name, first_seen FROM users WHERE id = ?');
$stmt->execute([$uid]);
$user = $stmt->fetch();

echo json_encode(['ok' => true, 'data' => $user ?: null]);
