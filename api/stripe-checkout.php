<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/stripe-lib.php';
$uid = requireAuth();
$pdo = db();

$b    = json_decode(file_get_contents('php://input'), true) ?? [];
$plan = $b['plan'] ?? '';

if (!in_array($plan, ['annual', 'lifetime'], true)) {
    json_err('Invalid plan'); exit;
}

$stmt = $pdo->prepare('SELECT stripe_customer_id, guild_plan FROM users WHERE id = ?');
$stmt->execute([$uid]);
$user = $stmt->fetch();

if ($user && $user['guild_plan'] === 'lifetime') {
    json_err('Already a Lifetime Guild member'); exit;
}

$isAnnual = $plan === 'annual';

$params = [
    'mode'                => $isAnnual ? 'subscription' : 'payment',
    'line_items'          => [[
        'price'    => $isAnnual ? STRIPE_PRICE_ID_ANNUAL : STRIPE_PRICE_ID_LIFETIME,
        'quantity' => 1,
    ]],
    'client_reference_id' => (string)$uid,
    'success_url'         => 'https://' . RP_ID . '/profile.html?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    'cancel_url'          => 'https://' . RP_ID . '/profile.html?checkout=cancelled',
];

if (!empty($user['stripe_customer_id'])) {
    // Reuse the same Stripe customer across purchases (e.g. an annual member
    // later buying Lifetime) instead of creating a new one each time.
    $params['customer'] = $user['stripe_customer_id'];
} elseif (!$isAnnual) {
    // One-time payments don't create a Customer by default; subscriptions
    // always do, so this is only needed on the lifetime/payment branch.
    $params['customer_creation'] = 'always';
}

if ($isAnnual) {
    // Tags the Subscription itself with our user id, since later lifecycle
    // events (invoice.paid, customer.subscription.deleted) carry the
    // subscription/customer, not this checkout session.
    $params['subscription_data'] = ['metadata' => ['user_id' => (string)$uid]];
}

try {
    $session = stripeClient()->checkout->sessions->create($params);
} catch (\Stripe\Exception\ApiErrorException $e) {
    json_err('Stripe error: ' . $e->getMessage()); exit;
}

json_out(['url' => $session->url]);
exit;
