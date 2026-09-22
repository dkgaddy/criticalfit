<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/push-lib.php';
$uid = requireAuth();
$pdo = db();

// Verify DM access
$stmt = $pdo->prepare('SELECT is_dm FROM users WHERE id = ?');
$stmt->execute([$uid]);
$u = $stmt->fetch();
if (!$u || empty($u['is_dm'])) {
    json_err('Forbidden', 403); exit;
}

if (empty($_SESSION['_push_notif_ddl'])) {
    try { ensurePushNotificationsTable($pdo); } catch (Exception $e) {}
    $_SESSION['_push_notif_ddl'] = 1;
}

const SCHEDULES = ['daily_morning', 'daily_noon', 'daily_night', 'weekly', 'monthly'];

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $pdo->query('SELECT id, title, message, schedule, active FROM push_notifications ORDER BY schedule, title')->fetchAll();
    json_out(array_map(function ($r) {
        return [
            'id'       => (int)$r['id'],
            'title'    => $r['title'],
            'message'  => $r['message'],
            'schedule' => $r['schedule'],
            'active'   => (bool)$r['active'],
        ];
    }, $rows));
    exit;
}

if ($method === 'POST') {
    $b      = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $b['action'] ?? '';

    if ($action === 'create' || $action === 'update') {
        $title    = trim($b['title']   ?? '');
        $message  = trim($b['message'] ?? '');
        $schedule = $b['schedule'] ?? '';
        $active   = !empty($b['active']) ? 1 : 0;

        if ($title === '' || $message === '') { json_err('Title and message required'); exit; }
        if (!in_array($schedule, SCHEDULES, true)) { json_err('Invalid schedule'); exit; }

        if ($action === 'create') {
            $pdo->prepare('INSERT INTO push_notifications (title, message, schedule, active) VALUES (?, ?, ?, ?)')
                ->execute([$title, $message, $schedule, $active]);
            json_out(['id' => (int)$pdo->lastInsertId()]); exit;
        }

        $id = (int)($b['id'] ?? 0);
        if (!$id) { json_err('id required'); exit; }
        $pdo->prepare('UPDATE push_notifications SET title = ?, message = ?, schedule = ?, active = ? WHERE id = ?')
            ->execute([$title, $message, $schedule, $active, $id]);
        json_out(null); exit;
    }

    if ($action === 'setActive') {
        $id     = (int)($b['id'] ?? 0);
        $active = !empty($b['active']) ? 1 : 0;
        if (!$id) { json_err('id required'); exit; }
        $pdo->prepare('UPDATE push_notifications SET active = ? WHERE id = ?')->execute([$active, $id]);
        json_out(null); exit;
    }

    if ($action === 'delete') {
        $id = (int)($b['id'] ?? 0);
        if (!$id) { json_err('id required'); exit; }
        $pdo->prepare('DELETE FROM push_notifications WHERE id = ?')->execute([$id]);
        json_out(null); exit;
    }

    if ($action === 'sendNow') {
        $title   = trim($b['title']   ?? '') ?: 'Critical Fit';
        $message = trim($b['message'] ?? '');
        if ($message === '') { json_err('Message required'); exit; }
        $sent = broadcastPush($pdo, ['title' => $title, 'body' => $message, 'url' => './index.html']);
        json_out(['sent' => $sent]); exit;
    }

    json_err('Unknown action'); exit;
}

json_err('Method not allowed', 405); exit;
