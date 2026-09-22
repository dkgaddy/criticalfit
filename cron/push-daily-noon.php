<?php
// Run once at midday from cPanel Cron Jobs (CLI only). Sends every active
// "Daily Noon" notification defined on the DM's Push Notifications admin
// page (system.html → Push Notifications) to every subscribed user.
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../api/push-lib.php';

sendScheduledPushes(db(), 'daily_noon');
