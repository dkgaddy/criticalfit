<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/stripe-lib.php';
$uid = requireAuth();
$pdo = db();

$stmt = $pdo->prepare('SELECT stripe_customer_id FROM users WHERE id = ?');
$stmt->execute([$uid]);
$customerId = $stmt->fetchColumn();

if (!$customerId) { json_err('No billing account on file'); exit; }

try {
    $session = stripeClient()->billingPortal->sessions->create([
        'customer'   => $customerId,
        'return_url' => 'https://' . RP_ID . '/profile.html',
    ]);
} catch (\Stripe\Exception\ApiErrorException $e) {
    json_err('Stripe error: ' . $e->getMessage()); exit;
}

json_out(['url' => $session->url]);
exit;
