<?php
// Run hourly from cPanel's Cron Jobs (CLI), never over HTTP — this script
// isn't meant to be web-reachable at all, but refuse anyway as
// defense-in-depth. Hourly (not once/day) so each user can be nudged at
// their own local evening rather than everyone getting pinged at whatever
// the server's single fixed cron hour happens to translate to in their zone.
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../api/push-lib.php';

const TARGET_LOCAL_HOUR   = 19; // 7 PM in the user's own timezone
const REMINDER_SCHEDULE   = 'daily_unlogged'; // its own bucket — see api/push-admin.php

$pdo = db();
ensurePushNotificationsTable($pdo);

// The title/message (and whether this reminder runs at all) are managed by
// the DM on the Push Notifications admin page like any other notification —
// nothing here is hardcoded. It's tagged with its own schedule slug so it
// never collides with the plain broadcasts in cron/push-daily-night.php etc.,
// which don't carry this reminder's per-user-timezone + "haven't logged yet"
// conditions. Support (rare) multiple active rows of this type: send each.
$remStmt = $pdo->prepare('SELECT title, message FROM push_notifications WHERE schedule = ? AND active = 1');
$remStmt->execute([REMINDER_SCHEDULE]);
$reminders = $remStmt->fetchAll();
if (!$reminders) exit; // nothing active — skip the per-user work below entirely

// Each user's local hour/date is computed from their own IANA timezone
// (captured on every page load by api/auth/session.php), not the server's
// UTC clock or any single fixed zone. Only users currently at
// TARGET_LOCAL_HOUR get checked/sent — since that's true for exactly one
// hour a day per user, no "already sent today" bookkeeping is needed.
$stmt = $pdo->query('SELECT id, timezone FROM users WHERE notifications = 1');
$checkStmt = $pdo->prepare('SELECT 1 FROM food_entries WHERE user_id = ? AND log_date = ? LIMIT 1');

foreach ($stmt->fetchAll() as $row) {
    try {
        $tz = new DateTimeZone($row['timezone'] ?: 'UTC');
    } catch (Exception $e) {
        $tz = new DateTimeZone('UTC');
    }
    $now = new DateTime('now', $tz);
    if ((int)$now->format('G') !== TARGET_LOCAL_HOUR) continue;

    $checkStmt->execute([$row['id'], $now->format('Y-m-d')]);
    if ($checkStmt->fetch()) continue;

    foreach ($reminders as $reminder) {
        sendPushToUser($pdo, (int)$row['id'], [
            'title' => $reminder['title'],
            'body'  => $reminder['message'],
            'url'   => './index.html',
        ]);
    }
}
