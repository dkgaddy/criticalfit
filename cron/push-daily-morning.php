<?php
// Run once each morning from cPanel Cron Jobs (CLI only). Sends every active
// "Daily Morning" notification defined on the DM's Push Notifications admin
// page (system.html → Push Notifications) to every subscribed user.
//
// This is independent of cron/send-daily-reminder.php, which is a separate,
// conditional "you haven't logged food today" nudge tied to each user's own
// local evening — not something the DM edits here.
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../api/push-lib.php';

sendScheduledPushes(db(), 'daily_morning');
