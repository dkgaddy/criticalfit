<?php
// ============================================================
// Critical Fit — Daily Quests API
//
// Free users still get a real generated quest (so the Journal card shows a
// genuine name/type/length, per spec §8), but every response for them omits
// stations/transitions, and every write action below is Guild-gated
// server-side — never just hidden in the UI.
// ============================================================

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/quest-lib.php';
$uid = requireAuth();
$pdo = db();

if (empty($_SESSION['_quest_schema'])) {
    ensureQuestSchema($pdo);
    $_SESSION['_quest_schema'] = 1;
}

function questUserIsGuild(PDO $pdo, int $uid): bool {
    $stmt = $pdo->prepare('SELECT is_premium FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    return !empty($stmt->fetchColumn());
}

// Shapes a daily_quests row for the client. $full gates whether
// stations/transitions/personal-best/rerolls are included — false for free
// users, who only ever see the name/type/length teaser.
function shapeQuest(PDO $pdo, int $uid, array $row, bool $full): array {
    $out = [
        'id'          => (int)$row['id'],
        'dayType'     => $row['day_type'],
        'name'        => $row['name'],
        'flavor'      => $row['flavor'],
        'durationMin' => (int)$row['duration_min'],
        'status'      => $row['status'],
        'startedAtMs' => $row['started_at'] ? strtotime($row['started_at'] . ' UTC') * 1000 : null,
        'locked'      => !$full,
    ];

    if (!$full) return $out;

    $difficulty = $row['difficulty'];
    $out['difficulty']      = $difficulty;
    $out['rerollsUsed']     = (int)$row['rerolls_used'];
    $out['rerollsRemaining'] = max(0, 2 - (int)$row['rerolls_used']);
    $out['stations'] = array_map(
        fn($id) => resolveStation($id, $difficulty),
        json_decode($row['stations_json'], true) ?: []
    );
    $out['transitions'] = array_map(
        fn($id) => resolveTransition($id, $difficulty),
        json_decode($row['transitions_json'], true) ?: []
    );
    $out['personalBest']   = computePersonalBest($pdo, $uid, $row['day_type'], $difficulty, (int)$row['duration_min']);
    $out['weeklyCampaign'] = computeWeeklyCampaign($pdo, $uid);

    $prefs = getQuestPreferences($pdo, $uid);
    $out['disclaimerAcknowledged'] = $prefs['disclaimerAcknowledged'];

    return $out;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $row  = getOrCreateTodayQuest($pdo, $uid);
    $full = questUserIsGuild($pdo, $uid);
    json_out(shapeQuest($pdo, $uid, $row, $full));
    exit;
}

if ($method === 'POST') {
    if (!questUserIsGuild($pdo, $uid)) {
        json_err('Forbidden', 403); exit;
    }

    $b      = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $b['action'] ?? '';

    $localDate = userLocalDate($pdo, $uid);
    $stmt = $pdo->prepare('SELECT * FROM daily_quests WHERE user_id = ? AND local_date = ?');
    $stmt->execute([$uid, $localDate]);
    $row = $stmt->fetch();
    if (!$row) { json_err('No quest for today — fetch one first'); exit; }

    if ($action === 'reroll') {
        if ($row['status'] !== 'ready') { json_err('Quest already started'); exit; }
        if ((int)$row['rerolls_used'] >= 2) { json_err('No rerolls remaining'); exit; }

        $prefs   = getQuestPreferences($pdo, $uid);
        $avoid   = previousQuestStationIds($pdo, $uid);
        $content = generateQuestContent($uid, $localDate, $row['day_type'], (int)$row['reroll_index'] + 1, $prefs, $avoid);

        $pdo->prepare('
            UPDATE daily_quests SET reroll_index = reroll_index + 1, rerolls_used = rerolls_used + 1,
                name = ?, flavor = ?, difficulty = ?, duration_min = ?, stations_json = ?, transitions_json = ?
            WHERE id = ?
        ')->execute([
            $content['name'], $content['flavor'], $content['difficulty'], $content['durationMin'],
            json_encode($content['stationIds']), json_encode($content['transitionIds']), $row['id'],
        ]);

    } elseif ($action === 'switchDayType') {
        if ($row['status'] !== 'ready') { json_err('Quest already started'); exit; }
        $dayType = $b['dayType'] ?? '';
        if (!in_array($dayType, QUEST_DAY_TYPES, true)) { json_err('Invalid day type'); exit; }

        $prefs   = getQuestPreferences($pdo, $uid);
        $avoid   = previousQuestStationIds($pdo, $uid);
        // Switching doesn't cost a reroll (spec §4), so rerolls_used is left
        // alone; reroll_index resets to 0 since it's seeding a fresh track
        // for this day type, not a reroll of the previous one.
        $content = generateQuestContent($uid, $localDate, $dayType, 0, $prefs, $avoid);

        $pdo->prepare('
            UPDATE daily_quests SET day_type = ?, reroll_index = 0,
                name = ?, flavor = ?, difficulty = ?, duration_min = ?, stations_json = ?, transitions_json = ?
            WHERE id = ?
        ')->execute([
            $dayType, $content['name'], $content['flavor'], $content['difficulty'], $content['durationMin'],
            json_encode($content['stationIds']), json_encode($content['transitionIds']), $row['id'],
        ]);

    } elseif ($action === 'begin') {
        if ($row['status'] !== 'ready') { json_err('Quest already started'); exit; }
        // gmdate(), not SQL NOW() — NOW() is in the DB server's configured
        // timezone, which this app never pins, so a naive read-back would be
        // ambiguous. Writing UTC explicitly means shapeQuest() below can
        // convert it to a Unix ms timestamp unambiguously for the client's
        // timer math.
        $pdo->prepare("UPDATE daily_quests SET status = 'active', started_at = ? WHERE id = ?")->execute([gmdate('Y-m-d H:i:s'), $row['id']]);

    } elseif ($action === 'complete') {
        if ($row['status'] !== 'active') { json_err('Quest is not active'); exit; }

        $rounds        = max(0, (int)($b['rounds'] ?? 0));
        $extraStations = max(0, (int)($b['extraStations'] ?? 0));
        $activeSeconds = max(0, (int)($b['activeSeconds'] ?? 0));
        $partial       = !empty($b['partial']);

        // Same MET-based formula as js/log-activity.js's estimateCalories(),
        // reimplemented server-side (this must be server-authoritative, so
        // it can't just trust a client-submitted calorie total) using the
        // circuit-training METs from spec §6.
        $userStmt = $pdo->prepare('SELECT weight, unit FROM users WHERE id = ?');
        $userStmt->execute([$uid]);
        $u = $userStmt->fetch();
        $weightKg = $u && $u['weight'] ? ($u['unit'] === 'metric' ? (float)$u['weight'] : (float)$u['weight'] * 0.453592) : 75.0;
        $met      = QUEST_MET[$row['difficulty']];
        $calories = (int)round($met * $weightKg * ($activeSeconds / 3600));

        // Logged through the same exercise_entries table api/exercise.php
        // writes to (spec §6's "existing logging path") — not a literal
        // call to that endpoint, since this must happen inside the same
        // request/transaction as the completion record below.
        $pdo->prepare('
            INSERT INTO exercise_entries (user_id, log_date, name, duration_min, calories)
            VALUES (?, ?, ?, ?, ?)
        ')->execute([$uid, $localDate, 'Quest: ' . $row['name'], (int)round($activeSeconds / 60), $calories]);
        $activityId = (int)$pdo->lastInsertId();

        $pdo->prepare('
            INSERT INTO quest_completions
                (user_id, daily_quest_id, day_type, difficulty, duration_min, rounds, extra_stations, active_seconds, activity_id, partial)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            $uid, $row['id'], $row['day_type'], $row['difficulty'], $row['duration_min'],
            $rounds, $extraStations, $activeSeconds, $activityId, $partial ? 1 : 0,
        ]);

        $pdo->prepare("UPDATE daily_quests SET status = 'completed' WHERE id = ?")->execute([$row['id']]);

    } elseif ($action === 'abandon') {
        if ($row['status'] !== 'active') { json_err('Quest is not active'); exit; }
        // Discard — reset to 'ready' so the same quest can be started again.
        $pdo->prepare("UPDATE daily_quests SET status = 'ready', started_at = NULL WHERE id = ?")->execute([$row['id']]);

    } else {
        json_err('Unknown action'); exit;
    }

    $stmt->execute([$uid, $localDate]);
    json_out(shapeQuest($pdo, $uid, $stmt->fetch(), true));
    exit;
}

json_err('Method not allowed', 405);
