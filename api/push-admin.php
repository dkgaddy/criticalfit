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

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $pdo->query('SELECT id, title, message, schedule_description, active FROM push_notifications ORDER BY title')->fetchAll();
    json_out(array_map(function ($r) {
        return [
            'id'                  => (int)$r['id'],
            'title'               => $r['title'],
            'message'             => $r['message'],
            'scheduleDescription' => $r['schedule_description'],
            'active'              => (bool)$r['active'],
        ];
    }, $rows));
    exit;
}

if ($method === 'POST') {
    $b      = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $b['action'] ?? '';

    // Notifications themselves (slug + schedule/delivery logic) are added by
    // a code change, not this page — the DM can only edit the copy and flip
    // active/inactive on notifications that already exist.
    if ($action === 'update') {
        $id      = (int)($b['id'] ?? 0);
        $title   = trim($b['title']   ?? '');
        $message = trim($b['message'] ?? '');
        $active  = !empty($b['active']) ? 1 : 0;

        if (!$id) { json_err('id required'); exit; }
        if ($title === '' || $message === '') { json_err('Title and message required'); exit; }

        $pdo->prepare('UPDATE push_notifications SET title = ?, message = ?, active = ? WHERE id = ?')
            ->execute([$title, $message, $active, $id]);
        json_out(null); exit;
    }

    if ($action === 'setActive') {
        $id     = (int)($b['id'] ?? 0);
        $active = !empty($b['active']) ? 1 : 0;
        if (!$id) { json_err('id required'); exit; }
        $pdo->prepare('UPDATE push_notifications SET active = ? WHERE id = ?')->execute([$active, $id]);
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
