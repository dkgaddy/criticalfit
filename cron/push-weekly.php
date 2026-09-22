<?php
// Run once a week (whatever day/time the DM picks in cPanel Cron Jobs, CLI
// only). Sends every active "Weekly" notification defined on the DM's Push
// Notifications admin page (system.html → Push Notifications) to every
// subscribed user.
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../api/push-lib.php';

sendScheduledPushes(db(), 'weekly');
