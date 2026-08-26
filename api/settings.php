<?php
require_once __DIR__ . '/db.php';
$uid = requireAuth();

const VALID_THEMES = ['forest', 'dragons-fire', 'royal-sash', 'bog-of-carbohydrates', 'dungeons-and-dumbells', 'fatburn-forest', 'lake-nightrun', 'mount-protein', 'recovery-tavern'];
const VALID_TRACKS = [
    'HammeringHearts.mp3',
    'MistyTaverns.mp3',
    'PipeSmoke.mp3',
    'RowingTheLoch.mp3',
    'SpinningElves.mp3',
];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = db()->prepare('SELECT theme, music, notifications FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $row = $stmt->fetch();
    json_out([
        'theme'         => $row['theme']  ?? 'forest',
        'music'         => $row['music']  ?? null,
        'notifications' => !empty($row['notifications']),
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b      = json_decode(file_get_contents('php://input'), true) ?? [];
    $fields = [];
    $params = [];

    if (isset($b['theme'])) {
        $fields[] = 'theme = ?';
        $params[] = in_array($b['theme'], VALID_THEMES) ? $b['theme'] : 'forest';
    }

    if (array_key_exists('music', $b)) {
        $track    = $b['music'] ?: null;
        $fields[] = 'music = ?';
        $params[] = ($track && in_array($track, VALID_TRACKS)) ? $track : null;
    }

    if (isset($b['notifications'])) {
        $fields[] = 'notifications = ?';
        $params[] = $b['notifications'] ? 1 : 0;
    }

    if ($fields) {
        $params[] = $uid;
        db()->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')
             ->execute($params);
    }

    json_out(['saved' => true]);
    exit;
}

json_err('Method not allowed', 405);
