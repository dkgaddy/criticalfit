<?php
require_once __DIR__ . '/db.php';
$uid = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_err('Method not allowed', 405);
}

$pdo = db();

// One-time schema migration — silently no-ops after the first run
try { $pdo->exec('ALTER TABLE dragon_progress ADD COLUMN current_level INT NOT NULL DEFAULT 0'); } catch (PDOException $e) {}
try { $pdo->exec('ALTER TABLE dragon_progress ADD COLUMN last_check_date DATE NULL'); } catch (PDOException $e) {}

// Stage definitions — must mirror DRAGON_STAGES in js/app.js
$STAGES = [
    ['level' => 0, 'title' => 'Hatchling',     'days' => 0],
    ['level' => 1, 'title' => 'Wyrmling',       'days' => 1],
    ['level' => 2, 'title' => 'Drake',          'days' => 15],
    ['level' => 3, 'title' => 'Guardian',       'days' => 30],
    ['level' => 4, 'title' => 'Elder Dragon',   'days' => 45],
    ['level' => 5, 'title' => 'Ancient Dragon', 'days' => 60],
];

// 1. Total distinct days where user logged anything
$stmt = $pdo->prepare("
    SELECT COUNT(DISTINCT log_date) AS total
    FROM (
        SELECT log_date FROM food_entries     WHERE user_id = ?
        UNION
        SELECT log_date FROM exercise_entries WHERE user_id = ?
    ) combined
");
$stmt->execute([$uid, $uid]);
$totalLoggedDays = (int) $stmt->fetchColumn();

// 2. Most recent logged date
$stmt = $pdo->prepare("
    SELECT MAX(log_date) AS last_date
    FROM (
        SELECT log_date FROM food_entries     WHERE user_id = ?
        UNION
        SELECT log_date FROM exercise_entries WHERE user_id = ?
    ) combined
");
$stmt->execute([$uid, $uid]);
$lastActivityDate = $stmt->fetchColumn() ?: null;

// Use client-supplied local date to avoid server timezone mismatch
$clientToday = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['today'] ?? '')
    ? $_GET['today']
    : date('Y-m-d');

$daysSinceLast = $lastActivityDate
    ? (int) date_diff(date_create($lastActivityDate), date_create($clientToday))->days
    : 9999;

// 3. Earned level — purely from total logged days
$earnedLevel = 0;
foreach ($STAGES as $s) {
    if ($totalLoggedDays >= $s['days']) $earnedLevel = $s['level'];
}

// 4. Effective level — 15+ consecutive days inactive drops one level
$effectiveLevel = ($daysSinceLast > 15)
    ? max(0, $earnedLevel - 1)
    : $earnedLevel;

// 5. Load previously stored level
$stmt = $pdo->prepare('SELECT current_level FROM dragon_progress WHERE user_id = ?');
$stmt->execute([$uid]);
$row         = $stmt->fetch();
$storedLevel = $row !== false ? (int) $row['current_level'] : -1; // -1 = first ever load

// 6. Detect and persist level change
$promoted = false;
$demoted  = false;

if ($effectiveLevel !== $storedLevel) {
    $promoted = $storedLevel >= 0 && $effectiveLevel > $storedLevel;
    $demoted  = $storedLevel >= 0 && $effectiveLevel < $storedLevel;

    $pdo->prepare("
        INSERT INTO dragon_progress (user_id, current_level, last_check_date)
        VALUES (?, ?, CURDATE())
        ON DUPLICATE KEY UPDATE
            current_level   = VALUES(current_level),
            last_check_date = VALUES(last_check_date)
    ")->execute([$uid, $effectiveLevel]);
}

// 7. Days until next promotion
$nextStage = null;
foreach ($STAGES as $s) {
    if ($s['level'] === $effectiveLevel + 1) { $nextStage = $s; break; }
}
$daysToNext = $nextStage ? max(0, $nextStage['days'] - $totalLoggedDays) : null;

json_out([
    'currentLevel'     => $effectiveLevel,
    'totalLoggedDays'  => $totalLoggedDays,
    'lastActivityDate' => $lastActivityDate,
    'daysSinceLast'    => $daysSinceLast,
    'earnedLevel'      => $earnedLevel,
    'promoted'         => $promoted,
    'demoted'          => $demoted,
    'daysToNext'       => $daysToNext,
]);
