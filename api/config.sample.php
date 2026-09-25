<?php
// Copy this file to config.php and fill in real values.
// config.php is gitignored and must never be committed.
define('USDA_API_KEY',       'PASTE_YOUR_USDA_API_KEY_HERE');
define('ANTHROPIC_API_KEY', 'PASTE_YOUR_ANTHROPIC_API_KEY_HERE');
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_db_name');
define('DB_USER', 'your_db_user');
define('DB_PASS', 'your_db_password');
define('RP_NAME',   'Critical Fit');
define('RP_ID',     'criticalfitapp.com');
define('RP_ORIGIN', 'https://criticalfitapp.com');

// Generate with vendor/bin/web-push-vapid-gen (see minishlink/web-push docs)
define('VAPID_PUBLIC_KEY',  'PASTE_YOUR_VAPID_PUBLIC_KEY_HERE');
define('VAPID_PRIVATE_KEY', 'PASTE_YOUR_VAPID_PRIVATE_KEY_HERE');
define('VAPID_SUBJECT',     'mailto:you@example.com');

// Stripe (Guild Membership billing) — see Stripe Dashboard → Developers
define('STRIPE_SECRET_KEY',        'PASTE_YOUR_STRIPE_SECRET_KEY_HERE');
define('STRIPE_WEBHOOK_SECRET',    'PASTE_YOUR_STRIPE_WEBHOOK_SIGNING_SECRET_HERE');
define('STRIPE_PRICE_ID_ANNUAL',   'PASTE_YOUR_STRIPE_ANNUAL_PRICE_ID_HERE');
define('STRIPE_PRICE_ID_LIFETIME', 'PASTE_YOUR_STRIPE_LIFETIME_PRICE_ID_HERE');
