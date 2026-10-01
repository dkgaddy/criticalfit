<?php
// ============================================================
// Critical Fit — Daily Quests generator tests
// Run: php tests/quest-generator.test.php
// ============================================================

require_once __DIR__ . '/../api/quest-lib.php';

$passed = 0;
$failed = 0;

function qtest(string $name, Closure $fn): void {
    global $passed, $failed;
    try {
        $fn();
        echo "  ✓  $name\n";
        $passed++;
    } catch (Throwable $e) {
        echo "  ✗  $name\n";
        echo '     ' . $e->getMessage() . "\n";
        $failed++;
    }
}

function qassert(bool $cond, string $msg): void {
    if (!$cond) throw new Exception($msg);
}

$defaultPrefs = ['difficulty' => 'beginner', 'lengthMin' => 15, 'stations' => 4, 'equipment' => ['bench'], 'spaceOk' => false];
$noEquipPrefs = ['difficulty' => 'beginner', 'lengthMin' => 15, 'stations' => 4, 'equipment' => [], 'spaceOk' => false];

// ---- Determinism ----

qtest('same seed inputs always produce the same quest', function () use ($defaultPrefs) {
    $a = generateQuestContent(10, '2026-10-01', 'upper', 0, $defaultPrefs, []);
    $b = generateQuestContent(10, '2026-10-01', 'upper', 0, $defaultPrefs, []);
    qassert($a === $b, 'two calls with identical inputs diverged');
});

qtest('a different reroll index changes the result', function () use ($defaultPrefs) {
    $a = generateQuestContent(10, '2026-10-01', 'upper', 0, $defaultPrefs, []);
    $b = generateQuestContent(10, '2026-10-01', 'upper', 1, $defaultPrefs, []);
    qassert($a['stationIds'] !== $b['stationIds'] || $a['name'] !== $b['name'], 'reroll produced an identical quest (astronomically unlikely, check the seed)');
});

qtest('a different user id changes the result', function () use ($defaultPrefs) {
    $a = generateQuestContent(10, '2026-10-01', 'upper', 0, $defaultPrefs, []);
    $b = generateQuestContent(11, '2026-10-01', 'upper', 0, $defaultPrefs, []);
    qassert($a['stationIds'] !== $b['stationIds'] || $a['name'] !== $b['name'], 'two different users got an identical quest (astronomically unlikely, check the seed)');
});

// ---- Composition rules (spec §4, acceptance §12) ----

qtest('every circuit has exactly 1 core station, placed second-to-last', function () use ($defaultPrefs) {
    foreach (['upper', 'lower', 'full'] as $dayType) {
        $q = generateQuestContent(1, '2026-10-01', $dayType, 0, $defaultPrefs, []);
        $coreCount = 0;
        foreach ($q['stationIds'] as $id) if (QUEST_EXERCISES[$id]['role'] === 'core') $coreCount++;
        qassert($coreCount === 1, "$dayType day had $coreCount core stations, expected 1");
        $n = count($q['stationIds']);
        qassert(QUEST_EXERCISES[$q['stationIds'][$n - 2]]['role'] === 'core', "$dayType day's core station wasn't second-to-last");
    }
});

qtest('upper day stations are all upper or core', function () use ($defaultPrefs) {
    $q = generateQuestContent(1, '2026-10-01', 'upper', 0, $defaultPrefs, []);
    foreach ($q['stationIds'] as $id) {
        $role = QUEST_EXERCISES[$id]['role'];
        qassert(in_array($role, ['upper', 'core'], true), "found a $id ($role) on an upper day");
    }
});

qtest('lower day stations are all lower or core', function () use ($defaultPrefs) {
    $q = generateQuestContent(1, '2026-10-01', 'lower', 0, $defaultPrefs, []);
    foreach ($q['stationIds'] as $id) {
        qassert(in_array(QUEST_EXERCISES[$id]['role'], ['lower', 'core'], true), "found a non-lower/core station on a lower day: $id");
    }
});

qtest('full day has at least 1 upper and 1 lower station', function () use ($defaultPrefs) {
    for ($trial = 0; $trial < 20; $trial++) {
        $q = generateQuestContent(100 + $trial, '2026-10-01', 'full', 0, $defaultPrefs, []);
        $roles = array_map(fn($id) => QUEST_EXERCISES[$id]['role'], $q['stationIds']);
        qassert(in_array('upper', $roles, true), "trial $trial: no upper station on a full day");
        qassert(in_array('lower', $roles, true), "trial $trial: no lower station on a full day");
    }
});

qtest('station count matches the stations preference', function () use ($defaultPrefs) {
    foreach ([3, 4, 5] as $n) {
        $prefs = $defaultPrefs; $prefs['stations'] = $n;
        foreach (['upper', 'lower', 'full'] as $dayType) {
            $q = generateQuestContent(1, '2026-10-01', $dayType, 0, $prefs, []);
            qassert(count($q['stationIds']) === $n, "$dayType with $n stations pref produced " . count($q['stationIds']));
            qassert(count($q['transitionIds']) === $n, "$dayType with $n stations pref produced " . count($q['transitionIds']) . ' transitions');
        }
    }
});

// ---- Filtering (spec §4, acceptance §12) ----

qtest('no equipment-requiring exercise appears when the user owns nothing', function () use ($noEquipPrefs) {
    for ($trial = 0; $trial < 30; $trial++) {
        foreach (['upper', 'lower', 'full'] as $dayType) {
            $q = generateQuestContent(200 + $trial, '2026-10-0' . (1 + ($trial % 9)), $dayType, 0, $noEquipPrefs, []);
            foreach ($q['stationIds'] as $id) {
                $needsEquip = !empty(QUEST_EXERCISES[$id]['equipment']);
                qassert(!$needsEquip, "$dayType day (trial $trial) included $id, which needs equipment the user doesn't own");
            }
        }
    }
});

qtest('needsSpace exercises never appear when the space setting is off', function () use ($noEquipPrefs) {
    for ($trial = 0; $trial < 30; $trial++) {
        foreach (['upper', 'lower', 'full'] as $dayType) {
            $q = generateQuestContent(300 + $trial, '2026-10-0' . (1 + ($trial % 9)), $dayType, 0, $noEquipPrefs, []);
            foreach ($q['stationIds'] as $id) {
                qassert(empty(QUEST_EXERCISES[$id]['needsSpace']), "$dayType day (trial $trial) included space-needing $id with space off");
            }
        }
    }
});

qtest('"bands or dumbbells" exercises qualify with either alone', function () {
    $bandsOnly = ['difficulty' => 'beginner', 'lengthMin' => 15, 'stations' => 4, 'equipment' => ['bands'], 'spaceOk' => false];
    $pool = questFilterPool(['upper'], $bandsOnly['equipment'], false);
    qassert(in_array('front_raises', $pool, true), 'front_raises should qualify with bands alone');
    qassert(in_array('lateral_raises', $pool, true), 'lateral_raises should qualify with bands alone');
    qassert(!in_array('tricep_kickbacks', $pool, true), 'tricep_kickbacks needs dumbbells specifically, bands alone should not qualify it');
});

qtest('an exercise needing bands AND an anchor requires both, not either', function () {
    $bandsOnly  = questFilterPool(['upper'], ['bands'], false);
    $anchorOnly = questFilterPool(['upper'], ['anchor'], false);
    $both       = questFilterPool(['upper'], ['bands', 'anchor'], false);
    qassert(!in_array('standing_chest_press', $bandsOnly, true), 'standing_chest_press should not qualify with bands alone');
    qassert(!in_array('standing_chest_press', $anchorOnly, true), 'standing_chest_press should not qualify with anchor alone');
    qassert(in_array('standing_chest_press', $both, true), 'standing_chest_press should qualify with both bands and anchor');
});

qtest('never fails to generate even with no equipment and no space (upper has 3 options)', function () {
    $pool = questFilterPool(['upper'], [], false);
    qassert(count($pool) >= 3, 'expected at least 3 equipment-free upper exercises, got ' . count($pool));
});

qtest('generation never throws even when stations requested exceeds the filtered pool', function () use ($noEquipPrefs) {
    // 5 stations on an upper day with no equipment: pool has only 3 free
    // exercises (pushups, pike_pushups, walking_pushups) for 4 needed slots —
    // must allow repeats rather than fail.
    $prefs = $noEquipPrefs; $prefs['stations'] = 5;
    $q = generateQuestContent(1, '2026-10-01', 'upper', 0, $prefs, []);
    qassert(count($q['stationIds']) === 5, 'expected 5 stations even with a small pool');
});

// ---- Cardio transitions ----

qtest('no cardio transition repeats immediately within a round', function () use ($defaultPrefs) {
    for ($trial = 0; $trial < 30; $trial++) {
        $prefs = $defaultPrefs; $prefs['stations'] = 5;
        $q = generateQuestContent(400 + $trial, '2026-10-01', 'upper', 0, $prefs, []);
        for ($i = 1; $i < count($q['transitionIds']); $i++) {
            qassert($q['transitionIds'][$i] !== $q['transitionIds'][$i - 1], "trial $trial: adjacent repeat at index $i");
        }
    }
});

// ---- Rounding out ----

printf("\n%d passed, %d failed\n", $passed, $failed);
exit($failed > 0 ? 1 : 0);
