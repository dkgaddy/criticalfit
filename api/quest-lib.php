<?php
// ============================================================
// Critical Fit — Daily Quests: exercise library + generator
// ============================================================
//
// Generation lives entirely server-side (unlike the 27 free-form Activities
// in js/log-activity.js, which are just display data the client POSTs a
// calorie total for). Quests are server-authoritative: the client never
// submits its own station list, so Guild gating and the "same seed always
// gives the same quest" rule both hold regardless of what a client sends.

require_once __DIR__ . '/db.php';

// ---- Exercise library (spec §11) ----
//
// equipment: array of OR-groups. Every group must be satisfied by at least
// one owned item; multiple groups means multiple distinct requirements
// (e.g. Standing Chest Press needs bands AND an anchor). Empty = no
// equipment needed.

const QUEST_EXERCISES = [
    // ---- Upper ----
    'pushups' => [
        'name' => 'Pushups', 'role' => 'upper', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 8, 'intermediate' => 12, 'advanced' => 20],
        'cue' => 'Body in a straight line; chest to just above the floor.',
        'details' => 'Hands slightly wider than shoulders. Keep hips level with shoulders, lower until your chest is a few inches off the floor, then press back up.',
    ],
    'incline_pushups' => [
        'name' => 'Incline Pushups', 'role' => 'upper', 'equipment' => [['bench']], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 10, 'intermediate' => 15, 'advanced' => 20],
        'cue' => 'Hands on the bench; easier than floor pushups.',
        'details' => 'Place hands on a bench or sturdy chair, walk feet back until your body is straight, then lower your chest to the edge and press up.',
    ],
    'decline_pushups' => [
        'name' => 'Decline Pushups', 'role' => 'upper', 'equipment' => [['bench']], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 6, 'intermediate' => 10, 'advanced' => 15],
        'cue' => 'Feet on the bench; harder than floor pushups.',
        'details' => "Place feet on a bench or sturdy chair and hands on the floor. Keep your core tight so your hips don't sag, lower your chest, then press up.",
    ],
    'pike_pushups' => [
        'name' => 'Pike Pushups', 'role' => 'upper', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 5, 'intermediate' => 8, 'advanced' => 12],
        'cue' => 'Hips high, lower your head toward the floor.',
        'details' => 'Start in a downward-dog shape with hips high. Bend your elbows to lower the top of your head toward the floor between your hands, then press back up. Targets the shoulders.',
    ],
    'walking_pushups' => [
        'name' => 'Walking Pushups', 'role' => 'upper', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 6, 'intermediate' => 10, 'advanced' => 14],
        'cue' => 'Pushup, walk sideways, pushup, walk back.',
        'details' => 'Do a standard pushup. At the top, move your left hand and left foot in to center, then move your right hand and right foot out. Do another pushup, then reverse the motion back to where you started. Repeat. Each pushup counts as one rep.',
    ],
    'tricep_dips' => [
        'name' => 'Tricep Dips', 'role' => 'upper', 'equipment' => [['bench']], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 8, 'intermediate' => 12, 'advanced' => 20],
        'cue' => 'Elbows straight back, shoulders down.',
        'details' => 'Sit on the edge of a bench or sturdy chair, hands beside your hips. Slide off the edge, bend your elbows straight back to lower until about 90°, then press up. Bend your knees to make it easier.',
    ],
    'standing_chest_press' => [
        'name' => 'Standing Chest Press', 'role' => 'upper', 'equipment' => [['bands'], ['anchor']], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 12, 'intermediate' => 15, 'advanced' => 20],
        'cue' => 'Press away from your chest; control the return.',
        'details' => "Wrap the band around a post or pole with your back to it, holding a handle in each hand. Walk forward until there's tension, then press both hands straight out in front of your chest and slowly bring them back.",
    ],
    'front_raises' => [
        'name' => 'Front Raises', 'role' => 'upper', 'equipment' => [['bands', 'dumbbells']], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 10, 'intermediate' => 12, 'advanced' => 15],
        'cue' => 'Straight arms forward to shoulder height.',
        'details' => "Stand tall holding dumbbells or a band anchored under your feet. With arms straight, raise them in front of you to shoulder height, then lower slowly. Don't swing.",
    ],
    'lateral_raises' => [
        'name' => 'Lateral Raises', 'role' => 'upper', 'equipment' => [['bands', 'dumbbells']], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 10, 'intermediate' => 12, 'advanced' => 15],
        'cue' => 'Straight arms out to the sides, shoulder height.',
        'details' => 'Stand tall holding dumbbells or a band anchored under your feet. With arms nearly straight, raise them out to your sides to shoulder height, then lower slowly.',
    ],
    'tricep_kickbacks' => [
        'name' => 'Tricep Kickbacks', 'role' => 'upper', 'equipment' => [['dumbbells']], 'needsSpace' => false,
        'unit' => 'reps', 'perSide' => true, 'targets' => ['beginner' => 10, 'intermediate' => 12, 'advanced' => 15],
        'cue' => 'Upper arm still; extend the forearm back.',
        'details' => "Hinge forward with a flat back. Keep your upper arm against your side, elbow bent at 90°, and straighten your arm back until it's fully extended. Return slowly.",
    ],
    'overhead_tricep_ext' => [
        'name' => 'Overhead Tricep Extensions', 'role' => 'upper', 'equipment' => [['dumbbells']], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 10, 'intermediate' => 12, 'advanced' => 15],
        'cue' => 'Elbows point up; lower the weight behind your head.',
        'details' => 'Stand holding one dumbbell overhead with both hands. Keep elbows pointing up and close to your head, lower the weight behind your head, then straighten your arms.',
    ],
    'standing_curls' => [
        'name' => 'Standing Curls', 'role' => 'upper', 'equipment' => [['dumbbells']], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 10, 'intermediate' => 12, 'advanced' => 15],
        'cue' => 'Elbows pinned at your sides; no swinging.',
        'details' => 'Stand with dumbbells at your sides, palms forward. Curl up toward your shoulders keeping your elbows still, then lower slowly.',
    ],
    'one_arm_rows' => [
        'name' => 'One Arm Rows', 'role' => 'upper', 'equipment' => [['dumbbells']], 'needsSpace' => false,
        'unit' => 'reps', 'perSide' => true, 'targets' => ['beginner' => 10, 'intermediate' => 12, 'advanced' => 15],
        'cue' => 'Flat back; pull the elbow toward your hip.',
        'details' => 'Place one hand and knee on a bench (or brace a hand on your knee in a staggered stance). Pull the dumbbell up toward your hip, squeezing your shoulder blade, then lower.',
    ],

    // ---- Lower ----
    'squats' => [
        'name' => 'Squats', 'role' => 'lower', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 15, 'intermediate' => 20, 'advanced' => 30],
        'cue' => 'Sit back, chest up, knees track over toes.',
        'details' => 'Feet shoulder-width apart. Push your hips back and bend your knees until your thighs are about parallel to the floor, then stand up through your heels.',
    ],
    'jump_squats' => [
        'name' => 'Jump Squats', 'role' => 'lower', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 8, 'intermediate' => 12, 'advanced' => 20],
        'cue' => 'Squat, explode up, land softly.',
        'details' => 'Lower into a squat, then jump straight up. Land softly with bent knees and go straight into the next rep.',
    ],
    'wall_sits' => [
        'name' => 'Wall Sits', 'role' => 'lower', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'seconds', 'targets' => ['beginner' => 30, 'intermediate' => 45, 'advanced' => 60],
        'cue' => 'Back flat on the wall, thighs parallel.',
        'details' => 'Slide your back down a wall until your knees are at about 90°, with knees above your ankles. Hold.',
    ],
    'walking_lunges' => [
        'name' => 'Walking Lunges', 'role' => 'lower', 'equipment' => [], 'needsSpace' => true,
        'unit' => 'steps', 'targets' => ['beginner' => 10, 'intermediate' => 16, 'advanced' => 20],
        'cue' => 'Long step, back knee toward the floor.',
        'details' => 'Step forward and lower until both knees are at about 90°, then push up and step through into the next lunge. In a room, go back and forth.',
    ],
    'backward_walking_lunges' => [
        'name' => 'Backward Walking Lunges', 'role' => 'lower', 'equipment' => [], 'needsSpace' => true,
        'unit' => 'steps', 'targets' => ['beginner' => 10, 'intermediate' => 16, 'advanced' => 20],
        'cue' => 'Step back, lower, keep the chest up.',
        'details' => 'Step backward into a lunge, lowering until both knees are at about 90°, then continue stepping backward with the other leg. Go back and forth across the room.',
    ],
    'in_place_lunges' => [
        'name' => 'Alternating In-Place Lunges', 'role' => 'lower', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 10, 'intermediate' => 16, 'advanced' => 24],
        'cue' => 'Step forward, lower, return; switch legs.',
        'details' => 'Step one foot forward, lower until both knees are at about 90°, push back to standing, then alternate legs. Count total reps.',
    ],
    'side_hops' => [
        'name' => 'Side Hops', 'role' => 'lower', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 20, 'intermediate' => 30, 'advanced' => 40],
        'cue' => 'Two feet together, hop side to side.',
        'details' => 'Feet together, hop sideways over an imaginary line, then immediately hop back. Each hop counts. Stay light on the balls of your feet.',
    ],
    'bunny_hops' => [
        'name' => 'Bunny Hops', 'role' => 'lower', 'equipment' => [], 'needsSpace' => true,
        'unit' => 'reps', 'targets' => ['beginner' => 10, 'intermediate' => 15, 'advanced' => 20],
        'cue' => 'Two-foot hops forward and back.',
        'details' => 'Feet together, make small two-footed hops forward. In a room, hop forward a few times, then back. Land softly with bent knees.',
    ],

    // ---- Full body (Full days only) ----
    'wall_sit_press' => [
        'name' => 'Wall Sit + Shoulder Press', 'role' => 'full', 'equipment' => [['dumbbells']], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 8, 'intermediate' => 10, 'advanced' => 12],
        'cue' => 'Hold the wall sit while pressing overhead.',
        'details' => 'Get into a wall sit with a dumbbell in each hand at your shoulders. While holding the wall sit, do the full set of shoulder press reps, pressing straight overhead and lowering back to your shoulders. Stand up only after the last rep.',
    ],
    'burpees' => [
        'name' => 'Burpees', 'role' => 'full', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 5, 'intermediate' => 10, 'advanced' => 15],
        'cue' => 'Squat, kick back, chest down, jump up.',
        'details' => 'Squat and place your hands on the floor, jump your feet back to a plank, lower your chest to the floor, push up, jump your feet back in, then jump up with arms overhead. Step instead of jumping to make it easier.',
    ],
    'bear_crawl' => [
        'name' => 'Bear Crawl', 'role' => 'full', 'equipment' => [], 'needsSpace' => true,
        'unit' => 'seconds', 'targets' => ['beginner' => 20, 'intermediate' => 30, 'advanced' => 45],
        'cue' => 'Knees an inch off the floor, crawl forward.',
        'details' => 'On hands and toes with knees bent and hovering just off the floor, crawl forward by moving opposite hand and foot together. Keep your back flat. Go back and forth across the room.',
    ],
    'crab_walk' => [
        'name' => 'Crab Walk', 'role' => 'full', 'equipment' => [], 'needsSpace' => true,
        'unit' => 'seconds', 'targets' => ['beginner' => 20, 'intermediate' => 30, 'advanced' => 45],
        'cue' => 'Hips up, walk on hands and feet.',
        'details' => 'Sit, place your hands behind you with fingers pointing toward your feet, and lift your hips. Walk on your hands and feet, keeping your hips up. Go back and forth across the room.',
    ],

    // ---- Core ----
    'low_plank' => [
        'name' => 'Low Plank', 'role' => 'core', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'seconds', 'targets' => ['beginner' => 20, 'intermediate' => 40, 'advanced' => 60],
        'cue' => 'On forearms, straight line head to heels.',
        'details' => "Forearms on the floor, elbows under your shoulders. Squeeze your core and glutes so your hips don't sag or pike. Hold.",
    ],
    'crunches' => [
        'name' => 'Crunches', 'role' => 'core', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 15, 'intermediate' => 20, 'advanced' => 30],
        'cue' => 'Lift your shoulders, not your neck.',
        'details' => "Lie on your back, knees bent, hands lightly behind your head. Curl your shoulders off the floor using your abs, then lower. Don't pull on your neck.",
    ],
    'leg_raises' => [
        'name' => 'Leg Raises', 'role' => 'core', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 10, 'intermediate' => 15, 'advanced' => 20],
        'cue' => 'Lower back pressed down; slow lower.',
        'details' => 'Lie on your back, legs straight, hands under your hips. Raise your legs to vertical, then lower slowly without letting your lower back arch off the floor. Bend your knees to make it easier.',
    ],
    'side_plank' => [
        'name' => 'Side Plank', 'role' => 'core', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'seconds', 'perSide' => true, 'targets' => ['beginner' => 15, 'intermediate' => 25, 'advanced' => 40],
        'cue' => 'Straight line, hips lifted.',
        'details' => 'Lie on your side, propped on one forearm with the elbow under your shoulder. Lift your hips so your body forms a straight line. Hold, then switch sides. Drop the bottom knee to make it easier.',
    ],
    'dead_bugs' => [
        'name' => 'Dead Bugs', 'role' => 'core', 'equipment' => [], 'needsSpace' => false,
        'unit' => 'reps', 'targets' => ['beginner' => 10, 'intermediate' => 16, 'advanced' => 20],
        'cue' => 'Opposite arm and leg extend; back stays flat.',
        'details' => 'Lie on your back with arms pointing up and knees bent at 90° above your hips. Slowly extend your opposite arm and leg toward the floor, return, then switch. Keep your lower back pressed down. Count total reps.',
    ],
];

// Cardio pool — transitions only, never drawn as stations. Duration is fixed
// by difficulty (spec §11), not per-exercise, so no targets here.
const QUEST_CARDIO = [
    'mountain_climbers' => [
        'name' => 'Mountain Climbers',
        'cue' => 'Plank position, drive the knees fast.',
        'details' => 'From a high plank, drive one knee toward your chest, then quickly switch legs in a running motion. Keep hips level.',
    ],
    'high_knees' => [
        'name' => 'High Knees',
        'cue' => 'Knees to hip height, quick feet.',
        'details' => 'Run in place, driving your knees up to hip height and pumping your arms.',
    ],
    'running_in_place' => [
        'name' => 'Running in Place',
        'cue' => 'Light, quick steps.',
        'details' => 'Jog in place on the balls of your feet at a steady, quick pace.',
    ],
    'jumping_jacks' => [
        'name' => 'Jumping Jacks',
        'cue' => 'Arms and legs out and in together.',
        'details' => 'Jump your feet out wide while raising your arms overhead, then jump back together with arms at your sides. Step side to side to make it easier.',
    ],
];

const QUEST_TRANSITION_SECONDS = ['beginner' => 20, 'intermediate' => 30, 'advanced' => 40];

// MET values for the auto-logged Activity (spec §6). No "Circuit Training"
// activity exists yet in js/log-activity.js's ACTIVITY_LIST (checked during
// §0 research — closest neighbors are CrossFit 8.0/12.0 and HIIT 8.0/10.0/12.0,
// neither literally a circuit-training entry), so there's nothing to
// reconcile here.
const QUEST_MET = ['beginner' => 4.3, 'intermediate' => 6.0, 'advanced' => 8.0];

const QUEST_NAMES = [
    'upper' => [
        ['name' => 'Siege of the Iron Gate',       'flavor' => "The gate won't lift itself."],
        ['name' => 'Shieldwall at Dawn',            'flavor' => 'Brace, push, hold the line.'],
        ['name' => "The Blacksmith's Trial",        'flavor' => 'Hammer, anvil, repeat.'],
        ['name' => 'Raising the Drawbridge',        'flavor' => 'Heavy chains, strong arms.'],
        ['name' => 'Storming the Battlements',      'flavor' => 'Up the walls, over the top.'],
        ['name' => "The Archer's Draw",              'flavor' => 'Steady shoulders, true aim.'],
        ['name' => 'Forge of the Mountain King',    'flavor' => 'Iron is shaped in fire.'],
        ['name' => 'Hold the Line',                  'flavor' => 'The wall stands because you do.'],
    ],
    'lower' => [
        ['name' => 'March of the Mountain Pass',    'flavor' => 'The summit is earned one step at a time.'],
        ['name' => 'Through the Bog',                'flavor' => 'Lift your knees or lose your boots.'],
        ['name' => 'The Long Road to Fatburn Forest', 'flavor' => 'The trail never ends, only your excuses.'],
        ['name' => 'Climb of Mount Protein',         'flavor' => 'Every ledge makes you stronger.'],
        ['name' => 'Flight from the Troll Bridge',   'flavor' => 'Run now, rest later.'],
        ['name' => "Ranger's Pursuit",                'flavor' => 'The quarry is fast. Be faster.'],
        ['name' => 'Stairs of the Endless Tower',    'flavor' => 'Count the steps, not the floors.'],
        ['name' => 'Crossing the Frozen River',      'flavor' => 'Light feet, strong legs.'],
    ],
    'full' => [
        ['name' => 'Dungeons and Dumbbells',         'flavor' => 'Every room holds a trial.'],
        ['name' => "The Dragon's Proving Grounds",   'flavor' => 'Your dragon is watching.'],
        ['name' => 'Ambush at Lake Nightrun',        'flavor' => 'No warning. No mercy.'],
        ['name' => 'Trial of the Ancient Wyrm',      'flavor' => 'Only the relentless pass.'],
        ['name' => 'Night Watch at the Keep',        'flavor' => 'Stay sharp until dawn.'],
        ['name' => 'Raid on the Goblin Camp',        'flavor' => 'Hit hard, move fast.'],
        ['name' => 'The Gauntlet',                    'flavor' => 'Run it. Survive it.'],
        ['name' => 'Tournament of Champions',        'flavor' => 'The crowd wants a hero.'],
    ],
];

const QUEST_DAY_TYPES    = ['upper', 'lower', 'full'];
const QUEST_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const QUEST_EQUIPMENT    = ['dumbbells', 'bands', 'bench', 'anchor'];

// ---- Schema (lazy migration, same pattern as dragon_progress/timezone) ----

function ensureQuestSchema(PDO $pdo): void {
    try { $pdo->exec("ALTER TABLE users ADD COLUMN quest_difficulty ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner'"); } catch (PDOException $e) {}
    try { $pdo->exec('ALTER TABLE users ADD COLUMN quest_length_min TINYINT UNSIGNED NOT NULL DEFAULT 15'); } catch (PDOException $e) {}
    try { $pdo->exec('ALTER TABLE users ADD COLUMN quest_stations TINYINT UNSIGNED NOT NULL DEFAULT 4'); } catch (PDOException $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN quest_equipment VARCHAR(255) NOT NULL DEFAULT 'bench'"); } catch (PDOException $e) {}
    try { $pdo->exec('ALTER TABLE users ADD COLUMN quest_space_ok TINYINT(1) UNSIGNED NOT NULL DEFAULT 0'); } catch (PDOException $e) {}
    try { $pdo->exec('ALTER TABLE users ADD COLUMN quest_disclaimer_ack_at DATETIME NULL'); } catch (PDOException $e) {}

    $pdo->exec("CREATE TABLE IF NOT EXISTS daily_quests (
        id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id          INT UNSIGNED NOT NULL,
        local_date       DATE NOT NULL,
        day_type         ENUM('upper','lower','full') NOT NULL,
        reroll_index     INT UNSIGNED NOT NULL DEFAULT 0,
        rerolls_used     TINYINT UNSIGNED NOT NULL DEFAULT 0,
        name             VARCHAR(255) NOT NULL,
        flavor           VARCHAR(255) NOT NULL,
        difficulty       ENUM('beginner','intermediate','advanced') NOT NULL,
        duration_min     TINYINT UNSIGNED NOT NULL,
        stations_json    TEXT NOT NULL,
        transitions_json TEXT NOT NULL,
        status           ENUM('ready','active','completed','abandoned') NOT NULL DEFAULT 'ready',
        started_at       DATETIME NULL,
        created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_date (user_id, local_date)
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS quest_completions (
        id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id          INT UNSIGNED NOT NULL,
        daily_quest_id   INT UNSIGNED NOT NULL,
        day_type         ENUM('upper','lower','full') NOT NULL,
        difficulty       ENUM('beginner','intermediate','advanced') NOT NULL,
        duration_min     TINYINT UNSIGNED NOT NULL,
        rounds           INT UNSIGNED NOT NULL DEFAULT 0,
        extra_stations   INT UNSIGNED NOT NULL DEFAULT 0,
        active_seconds   INT UNSIGNED NOT NULL DEFAULT 0,
        activity_id      INT UNSIGNED NULL,
        activity_deleted TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
        partial          TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
        completed_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_type_diff_dur (user_id, day_type, difficulty, duration_min),
        INDEX idx_user_completed (user_id, completed_at)
    )");
}

// ---- Preferences ----

function getQuestPreferences(PDO $pdo, int $uid): array {
    $stmt = $pdo->prepare('SELECT quest_difficulty, quest_length_min, quest_stations, quest_equipment, quest_space_ok, quest_disclaimer_ack_at FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $row = $stmt->fetch();
    $equipment = $row && $row['quest_equipment'] !== '' ? explode(',', $row['quest_equipment']) : [];
    return [
        'difficulty'              => $row['quest_difficulty']  ?? 'beginner',
        'lengthMin'                => (int)($row['quest_length_min'] ?? 15),
        'stations'                 => (int)($row['quest_stations']   ?? 4),
        'equipment'                => $equipment,
        'spaceOk'                  => !empty($row['quest_space_ok']),
        'disclaimerAcknowledged'  => !empty($row['quest_disclaimer_ack_at']),
    ];
}

// ---- User's local "today", same approach as cron/send-daily-reminder.php ----

function userLocalDate(PDO $pdo, int $uid): string {
    $stmt = $pdo->prepare('SELECT timezone FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $tzName = $stmt->fetchColumn();
    try {
        $tz = new DateTimeZone($tzName ?: 'UTC');
    } catch (Exception $e) {
        $tz = new DateTimeZone('UTC');
    }
    return (new DateTime('now', $tz))->format('Y-m-d');
}

// ---- Seeded RNG (mulberry32-style, masked to 32 bits throughout since PHP
// ints don't wrap like JS's uint32 arithmetic) ----

function questSeededRng(int $seed): \Closure {
    $state = $seed & 0xFFFFFFFF;
    return function () use (&$state): float {
        $state = ($state + 0x6D2B79F5) & 0xFFFFFFFF;
        $t = $state;
        $t = (($t ^ ($t >> 15)) * (1 | $t)) & 0xFFFFFFFF;
        $t = ($t + ((($t ^ ($t >> 7)) * (61 | $t)) & 0xFFFFFFFF)) & 0xFFFFFFFF;
        $t ^= $t >> 14;
        return ($t & 0xFFFFFFFF) / 4294967296.0;
    };
}

function questSeedFor(int $userId, string $localDate, string $dayType, int $rerollIndex): int {
    return crc32($userId . '|' . $localDate . '|' . $dayType . '|' . $rerollIndex);
}

// Fisher-Yates using the seeded RNG, so ordering is as deterministic as
// picking.
function questShuffle(array $arr, \Closure $rng): array {
    for ($i = count($arr) - 1; $i > 0; $i--) {
        $j = (int)floor($rng() * ($i + 1));
        [$arr[$i], $arr[$j]] = [$arr[$j], $arr[$i]];
    }
    return $arr;
}

// ---- Filtering (spec §4) ----

function questExerciseQualifies(array $exercise, array $ownedEquipment, bool $spaceOk): bool {
    if (!empty($exercise['needsSpace']) && !$spaceOk) return false;
    foreach ($exercise['equipment'] as $group) {
        if (!array_intersect($group, $ownedEquipment)) return false;
    }
    return true;
}

function questFilterPool(array $roles, array $ownedEquipment, bool $spaceOk): array {
    $pool = [];
    foreach (QUEST_EXERCISES as $id => $ex) {
        if (in_array($ex['role'], $roles, true) && questExerciseQualifies($ex, $ownedEquipment, $spaceOk)) {
            $pool[] = $id;
        }
    }
    return $pool;
}

// Picks $count ids from $pool (no immediate repeats of $pool itself; repeats
// across exhaustion passes are allowed, per spec, so generation never fails
// even for a no-equipment, no-chair, no-space user). $avoid is tried first
// to keep exercises out of the pick (soft: previous quest's stations).
function questPickN(array $pool, int $count, \Closure $rng, array $avoid = []): array {
    if (empty($pool)) return []; // should never happen per spec guarantees, but don't crash
    $picked    = [];
    $remaining = $pool;
    $softAvoid = $avoid;

    while (count($picked) < $count) {
        $candidates = array_values(array_diff($remaining, $softAvoid));
        if (empty($candidates)) {
            // Pool (minus soft-avoid) exhausted — drop the soft-avoid
            // constraint before resorting to repeats.
            $candidates = $remaining;
            $softAvoid  = [];
        }
        if (empty($candidates)) {
            // Pool itself exhausted — refill and allow repeats.
            $remaining  = $pool;
            $candidates = $pool;
        }
        $idx = (int)floor($rng() * count($candidates));
        $pick = $candidates[$idx];
        $picked[] = $pick;
        $remaining = array_values(array_diff($remaining, [$pick]));
    }
    return $picked;
}

function questPickCardioTransitions(int $count, \Closure $rng): array {
    $ids = array_keys(QUEST_CARDIO);
    $out = [];
    $prev = null;
    for ($i = 0; $i < $count; $i++) {
        $candidates = count($ids) > 1 ? array_values(array_diff($ids, [$prev])) : $ids;
        $pick = $candidates[(int)floor($rng() * count($candidates))];
        $out[] = $pick;
        $prev = $pick;
    }
    return $out;
}

// ---- Composition (spec §4) ----

function questComposeStations(string $dayType, int $n, array $ownedEquipment, bool $spaceOk, \Closure $rng, array $avoidIds): array {
    $corePool = questFilterPool(['core'], $ownedEquipment, $spaceOk);
    $core     = questPickN($corePool, 1, $rng, $avoidIds)[0];

    $others = [];
    if ($dayType === 'upper') {
        $pool   = questFilterPool(['upper'], $ownedEquipment, $spaceOk);
        $others = questPickN($pool, $n - 1, $rng, $avoidIds);
    } elseif ($dayType === 'lower') {
        $pool   = questFilterPool(['lower'], $ownedEquipment, $spaceOk);
        $others = questPickN($pool, $n - 1, $rng, $avoidIds);
    } else { // full
        $upperPool = questFilterPool(['upper'], $ownedEquipment, $spaceOk);
        $lowerPool = questFilterPool(['lower'], $ownedEquipment, $spaceOk);
        $allPool   = questFilterPool(['upper', 'lower', 'full'], $ownedEquipment, $spaceOk);

        $guaranteedUpper = questPickN($upperPool, 1, $rng, $avoidIds)[0];
        $guaranteedLower = questPickN($lowerPool, 1, $rng, $avoidIds)[0];
        $others = [$guaranteedUpper, $guaranteedLower];

        $remainingCount = ($n - 1) - 2;
        if ($remainingCount > 0) {
            $rest   = questPickN($allPool, $remainingCount, $rng, array_merge($avoidIds, $others));
            $others = array_merge($others, $rest);
        }
        $others = questShuffle($others, $rng);
    }

    // Core sits second-to-last (spec §4); everything else stays in pick order.
    $stations = $others;
    array_splice($stations, max(0, count($stations) - 1), 0, [$core]);
    return $stations;
}

// ---- Naming ----

function questPickName(string $dayType, \Closure $rng): array {
    $pool = QUEST_NAMES[$dayType];
    return $pool[(int)floor($rng() * count($pool))];
}

// ---- Full generation (pure given its inputs — no DB access) ----

function generateQuestContent(int $userId, string $localDate, string $dayType, int $rerollIndex, array $prefs, array $avoidStationIds): array {
    $seed = questSeedFor($userId, $localDate, $dayType, $rerollIndex);
    $rng  = questSeededRng($seed);

    $n = $prefs['stations'];
    $stationIds    = questComposeStations($dayType, $n, $prefs['equipment'], $prefs['spaceOk'], $rng, $avoidStationIds);
    $transitionIds = questPickCardioTransitions($n, $rng);
    $named         = questPickName($dayType, $rng);

    return [
        'dayType'      => $dayType,
        'rerollIndex'  => $rerollIndex,
        'name'         => $named['name'],
        'flavor'       => $named['flavor'],
        'difficulty'   => $prefs['difficulty'],
        'durationMin'  => $prefs['lengthMin'],
        'stationIds'    => $stationIds,
        'transitionIds' => $transitionIds,
    ];
}

// Expands exercise ids into full display data for a given difficulty —
// called at read time so copy edits to the static library apply to
// historical quests too, instead of freezing a snapshot in the DB.
function resolveStation(string $exerciseId, string $difficulty): array {
    $ex = QUEST_EXERCISES[$exerciseId];
    return [
        'exerciseId' => $exerciseId,
        'name'       => $ex['name'],
        'role'       => $ex['role'],
        'unit'       => $ex['unit'],
        'target'     => $ex['targets'][$difficulty],
        'perSide'    => !empty($ex['perSide']),
        'cue'        => $ex['cue'],
        'details'    => $ex['details'],
    ];
}

function resolveTransition(string $exerciseId, string $difficulty): array {
    $ex = QUEST_CARDIO[$exerciseId];
    return [
        'exerciseId' => $exerciseId,
        'name'       => $ex['name'],
        'unit'       => 'seconds',
        'target'     => QUEST_TRANSITION_SECONDS[$difficulty],
        'cue'        => $ex['cue'],
        'details'    => $ex['details'],
    ];
}

// ---- Day type rotation (spec §4) ----

function nextDayType(PDO $pdo, int $uid): string {
    $stmt = $pdo->prepare('SELECT day_type FROM quest_completions WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1');
    $stmt->execute([$uid]);
    $last = $stmt->fetchColumn();
    if (!$last) return 'upper'; // new users start with Upper
    $idx = array_search($last, QUEST_DAY_TYPES, true);
    return QUEST_DAY_TYPES[($idx + 1) % count(QUEST_DAY_TYPES)];
}

// Previous completed quest's station exercise ids, to softly avoid repeating.
function previousQuestStationIds(PDO $pdo, int $uid): array {
    $stmt = $pdo->prepare('
        SELECT dq.stations_json
        FROM quest_completions qc
        JOIN daily_quests dq ON dq.id = qc.daily_quest_id
        WHERE qc.user_id = ?
        ORDER BY qc.completed_at DESC LIMIT 1
    ');
    $stmt->execute([$uid]);
    $json = $stmt->fetchColumn();
    return $json ? (json_decode($json, true) ?: []) : [];
}

// ---- Get-or-create today's quest row ----

function getOrCreateTodayQuest(PDO $pdo, int $uid): array {
    ensureQuestSchema($pdo);
    $localDate = userLocalDate($pdo, $uid);

    $stmt = $pdo->prepare('SELECT * FROM daily_quests WHERE user_id = ? AND local_date = ?');
    $stmt->execute([$uid, $localDate]);
    $row = $stmt->fetch();
    if ($row) return $row;

    $prefs    = getQuestPreferences($pdo, $uid);
    $dayType  = nextDayType($pdo, $uid);
    $avoid    = previousQuestStationIds($pdo, $uid);
    $content  = generateQuestContent($uid, $localDate, $dayType, 0, $prefs, $avoid);

    $pdo->prepare('
        INSERT INTO daily_quests
            (user_id, local_date, day_type, reroll_index, rerolls_used, name, flavor, difficulty, duration_min, stations_json, transitions_json, status)
        VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, \'ready\')
    ')->execute([
        $uid, $localDate, $dayType, $content['name'], $content['flavor'], $content['difficulty'],
        $content['durationMin'], json_encode($content['stationIds']), json_encode($content['transitionIds']),
    ]);

    $stmt->execute([$uid, $localDate]);
    return $stmt->fetch();
}

// ---- Personal best & weekly campaign (spec §7) ----

function computePersonalBest(PDO $pdo, int $uid, string $dayType, string $difficulty, int $durationMin): ?array {
    $stmt = $pdo->prepare('
        SELECT rounds, extra_stations FROM quest_completions
        WHERE user_id = ? AND day_type = ? AND difficulty = ? AND duration_min = ?
        ORDER BY rounds DESC, extra_stations DESC LIMIT 1
    ');
    $stmt->execute([$uid, $dayType, $difficulty, $durationMin]);
    $row = $stmt->fetch();
    return $row ? ['rounds' => (int)$row['rounds'], 'extraStations' => (int)$row['extra_stations']] : null;
}

// Monday-start week in the user's own local timezone.
function computeWeeklyCampaign(PDO $pdo, int $uid): array {
    $stmt = $pdo->prepare('SELECT timezone FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    try {
        $tz = new DateTimeZone($stmt->fetchColumn() ?: 'UTC');
    } catch (Exception $e) {
        $tz = new DateTimeZone('UTC');
    }
    $now    = new DateTime('now', $tz);
    $isoDow = (int)$now->format('N'); // 1 (Mon) .. 7 (Sun)
    $monday = (clone $now)->modify('-' . ($isoDow - 1) . ' days');

    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM quest_completions
        WHERE user_id = ? AND partial = 0 AND completed_at >= ?
    ");
    $stmt->execute([$uid, $monday->format('Y-m-d 00:00:00')]);
    return ['completed' => (int)$stmt->fetchColumn(), 'target' => 3];
}
