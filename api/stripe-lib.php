<?php
require_once __DIR__ . '/config.php';
require_once dirname(__DIR__) . '/vendor/autoload.php';

// Single shared Stripe client, configured with our secret key. Every
// Stripe-touching endpoint (checkout, confirm, webhook, portal) includes
// this file rather than constructing its own client.
function stripeClient(): \Stripe\StripeClient {
    static $client;
    if (!$client) $client = new \Stripe\StripeClient(STRIPE_SECRET_KEY);
    return $client;
}

// Applies a confirmed Guild purchase to our DB — the one place both the
// post-checkout confirm endpoint (api/stripe-confirm.php) and the webhook
// handler (api/stripe-webhook.php) call, so the two paths can never disagree
// about what a successful purchase means.
//
// $plan is 'annual' or 'lifetime'. $periodEndsAt is a Unix timestamp for
// annual (the Stripe Subscription's current_period_end), or null for
// lifetime. Buying Lifetime cancels any other active subscription on the
// same Stripe customer — no proration/credit for unused annual time, per
// how upgrades were decided to work.
function applyGuildPurchase(PDO $pdo, int $userId, string $plan, string $stripeCustomerId, ?int $periodEndsAt): void {
    if ($plan === 'annual') {
        // Don't let a stray renewal event downgrade someone who's since
        // upgraded to Lifetime (e.g. a race with our own cancellation call
        // below, or a renewal that was already in flight at upgrade time).
        $stmt = $pdo->prepare('SELECT guild_plan FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        if ($stmt->fetchColumn() === 'lifetime') return;
    }

    $expiresAt = $periodEndsAt ? date('Y-m-d H:i:s', $periodEndsAt) : null;
    $pdo->prepare(
        'UPDATE users SET is_premium = 1, guild_plan = ?, guild_expires_at = ?, stripe_customer_id = ? WHERE id = ?'
    )->execute([$plan, $expiresAt, $stripeCustomerId, $userId]);

    if ($plan === 'lifetime') {
        cancelOtherActiveSubscriptions($stripeCustomerId);
    }
}

// Cancels every active subscription on a Stripe customer immediately (no
// proration) — used when a Lifetime purchase should supersede an existing
// Annual plan. The resulting customer.subscription.deleted webhook is a
// no-op against our DB since revokeGuildAccess() only acts if the user is
// still marked 'annual' at that point.
function cancelOtherActiveSubscriptions(string $stripeCustomerId): void {
    $stripe = stripeClient();
    $subs = $stripe->subscriptions->all(['customer' => $stripeCustomerId, 'status' => 'active', 'limit' => 100]);
    foreach ($subs->data as $sub) {
        $stripe->subscriptions->cancel($sub->id, ['prorate' => false]);
    }
}

// Revokes Guild access — only if the user is still on the plan being
// revoked, so (for example) an annual-cancellation webhook that arrives
// after the user has already upgraded to Lifetime can't clobber it.
function revokeGuildAccess(PDO $pdo, int $userId, string $onlyIfPlan): void {
    $pdo->prepare(
        'UPDATE users SET is_premium = 0, guild_plan = NULL, guild_expires_at = NULL WHERE id = ? AND guild_plan = ?'
    )->execute([$userId, $onlyIfPlan]);
}
