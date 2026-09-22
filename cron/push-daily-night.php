<?php
// Run once each evening from cPanel Cron Jobs (CLI only). Sends every active
// "Daily Night" notification defined on the DM's Push Notifications admin
// page (system.html → Push Notifications) to every subscribed user.
//
// This is a different bucket from cron/send-daily-reminder.php's "haven't
// logged food today" reminder (schedule 'daily_unlogged'), which is also
// DM-editable but stays conditional and per-user-timezone rather than a
// plain broadcast — see that script for why it's kept separate.
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../api/push-lib.php';

sendScheduledPushes(db(), 'daily_night');
