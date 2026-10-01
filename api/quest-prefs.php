<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/quest-lib.php';
$uid = requireAuth();
$pdo = db();

if (empty($_SESSION['_quest_schema'])) {
    ensureQuestSchema($pdo);
    $_SESSION['_quest_schema'] = 1;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_out(getQuestPreferences($pdo, $uid));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b      = json_decode(file_get_contents('php://input'), true) ?? [];
    $fields = [];
    $params = [];

    // Partial update, same pattern as api/settings.php — only touches fields
    // actually present in the request, so one preference change can never
    // clobber another.
    if (isset($b['difficulty'])) {
        $fields[] = 'quest_difficulty = ?';
        $params[] = in_array($b['difficulty'], QUEST_DIFFICULTIES, true) ? $b['difficulty'] : 'beginner';
    }

    if (isset($b['lengthMin'])) {
        $len = (int)$b['lengthMin'];
        $fields[] = 'quest_length_min = ?';
        $params[] = in_array($len, [10, 15, 20, 30], true) ? $len : 15;
    }

    if (isset($b['stations'])) {
        $n = (int)$b['stations'];
        $fields[] = 'quest_stations = ?';
        $params[] = in_array($n, [3, 4, 5], true) ? $n : 4;
    }

    if (isset($b['equipment']) && is_array($b['equipment'])) {
        $clean = array_values(array_intersect($b['equipment'], QUEST_EQUIPMENT));
        $fields[] = 'quest_equipment = ?';
        $params[] = implode(',', $clean);
    }

    if (isset($b['spaceOk'])) {
        $fields[] = 'quest_space_ok = ?';
        $params[] = $b['spaceOk'] ? 1 : 0;
    }

    if (isset($b['ackDisclaimer']) && $b['ackDisclaimer']) {
        $fields[] = 'quest_disclaimer_ack_at = NOW()';
    }

    if ($fields) {
        // Changing preferences only affects the next generated quest — if
        // today's is still 'ready' (not yet started), delete it so the next
        // GET regenerates with the new preferences; an active/completed
        // quest is left alone (spec §3).
        $localDate = userLocalDate($pdo, $uid);
        $pdo->prepare("DELETE FROM daily_quests WHERE user_id = ? AND local_date = ? AND status = 'ready'")
            ->execute([$uid, $localDate]);

        $params[] = $uid;
        $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    }

    json_out(getQuestPreferences($pdo, $uid));
    exit;
}

json_err('Method not allowed', 405);
