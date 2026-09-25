<?php
// Server-to-server only — Stripe never sends a session cookie, so this can't
// use requireAuth(). Authenticity comes entirely from the signature check
// below, verified against STRIPE_WEBHOOK_SECRET (the value tied to whichever
// mode — sandbox or live — this endpoint is currently configured for in
// api/config.php).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/stripe-lib.php';

$payload   = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

try {
    $event = \Stripe\Webhook::constructEvent($payload, $sigHeader, STRIPE_WEBHOOK_SECRET);
} catch (\Exception $e) {
    http_response_code(400);
    exit;
}

$pdo    = db();
$stripe = stripeClient();

switch ($event->type) {

    case 'checkout.session.completed': {
        $session = $event->data->object;
        $userId  = (int)($session->client_reference_id ?? 0);
        if (!$userId) break;

        if ($session->mode === 'payment') {
            if ($session->payment_status !== 'paid') break; // e.g. a delayed payment method still pending
            applyGuildPurchase($pdo, $userId, 'lifetime', $session->customer, null);
        } else {
            // Annual — pull the Subscription for its current_period_end.
            // invoice.paid (below) keeps this fresh on every renewal.
            $subscription = $stripe->subscriptions->retrieve($session->subscription);
            applyGuildPurchase($pdo, $userId, 'annual', $session->customer, $subscription->current_period_end);
        }
        break;
    }

    case 'invoice.paid': {
        $invoice = $event->data->object;
        if (!$invoice->subscription) break; // not a subscription invoice

        $subscription = $stripe->subscriptions->retrieve($invoice->subscription);
        $userId = (int)($subscription->metadata->user_id ?? 0);
        if (!$userId) break;

        applyGuildPurchase($pdo, $userId, 'annual', $invoice->customer, $subscription->current_period_end);
        break;
    }

    case 'customer.subscription.deleted': {
        $subscription = $event->data->object;
        $userId = (int)($subscription->metadata->user_id ?? 0);
        if ($userId) revokeGuildAccess($pdo, $userId, 'annual');
        break;
    }

    case 'charge.refunded': {
        $charge = $event->data->object;
        // Only act on a full refund — a partial goodwill refund shouldn't
        // pull someone's membership.
        if ($charge->amount_refunded < $charge->amount) break;
        if (!$charge->customer) break;

        $stmt = $pdo->prepare('SELECT id, guild_plan FROM users WHERE stripe_customer_id = ?');
        $stmt->execute([$charge->customer]);
        $user = $stmt->fetch();
        if ($user && $user['guild_plan']) revokeGuildAccess($pdo, (int)$user['id'], $user['guild_plan']);
        break;
    }
}

http_response_code(200);
echo json_encode(['received' => true]);
exit;
