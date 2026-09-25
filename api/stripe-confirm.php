<?php
// Called by the browser right after Stripe redirects back from a successful
// Checkout — the fast path so the UI updates immediately instead of waiting
// on the webhook (api/stripe-webhook.php), which remains the durable source
// of truth for everything that happens after this (renewals, cancellations).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/stripe-lib.php';
$uid = requireAuth();
$pdo = db();

$sessionId = $_GET['session_id'] ?? '';
if ($sessionId === '') { json_err('session_id required'); exit; }

try {
    $session = stripeClient()->checkout->sessions->retrieve($sessionId, ['expand' => ['subscription']]);
} catch (\Stripe\Exception\ApiErrorException $e) {
    json_err('Stripe error: ' . $e->getMessage()); exit;
}

// Make sure this session actually belongs to the logged-in user — otherwise
// anyone could pass an arbitrary session_id and have it applied to their
// own account.
if ((int)$session->client_reference_id !== $uid) {
    json_err('Forbidden', 403); exit;
}

if ($session->status !== 'complete') {
    json_out(['applied' => false]); exit;
}

$plan      = $session->mode === 'subscription' ? 'annual' : 'lifetime';
$periodEnd = $session->mode === 'subscription' ? $session->subscription->current_period_end : null;

applyGuildPurchase($pdo, $uid, $plan, $session->customer, $periodEnd);

json_out(['applied' => true, 'plan' => $plan]);
exit;
