<?php
require_once __DIR__ . '/db.php';
$uid = requireAuth();
$pdo = db();

// Verify DM access
$stmt = $pdo->prepare('SELECT is_dm FROM users WHERE id = ?');
$stmt->execute([$uid]);
$u = $stmt->fetch();
if (!$u || empty($u['is_dm'])) {
    json_err('Forbidden', 403); exit;
}

// Top 20 users by days logged (food entries = engagement metric)
$topUsers = $pdo->query("
    SELECT
        u.name,
        COALESCE(COUNT(DISTINCT fe.log_date), 0) AS days_logged,
        u.is_premium,
        MAX(vl.visited_at) AS last_login
    FROM users u
    LEFT JOIN food_entries fe ON fe.user_id = u.id
    LEFT JOIN visit_log vl    ON vl.user_id = u.id
    GROUP BY u.id, u.name, u.is_premium
    ORDER BY days_logged DESC
    LIMIT 20
")->fetchAll();

// Recent traffic grouped by date + IP (last 30 days)
$traffic = $pdo->query("
    SELECT
        DATE(vl.visited_at)                                              AS visit_date,
        vl.ip_address,
        COUNT(vl.id)                                                     AS pages_visited,
        MAX(CASE WHEN pk.user_id IS NOT NULL THEN 1 ELSE 0 END)         AS has_passkey
    FROM visit_log vl
    LEFT JOIN passkeys pk ON pk.user_id = vl.user_id
    WHERE vl.visited_at >= NOW() - INTERVAL 30 DAY
    GROUP BY DATE(vl.visited_at), vl.ip_address
    ORDER BY visit_date DESC, pages_visited DESC
    LIMIT 200
")->fetchAll();

$users = array_map(function ($r) {
    return [
        'name'       => $r['name'],
        'daysLogged' => (int)$r['days_logged'],
        'isGuild'    => (bool)$r['is_premium'],
        'lastLogin'  => $r['last_login'],
    ];
}, $topUsers);

$visits = array_map(function ($r) {
    return [
        'date'         => $r['visit_date'],
        'ip'           => $r['ip_address'],
        'pagesVisited' => (int)$r['pages_visited'],
        'hasPasskey'   => (bool)$r['has_passkey'],
    ];
}, $traffic);

json_out(['users' => $users, 'traffic' => $visits]);
exit;
