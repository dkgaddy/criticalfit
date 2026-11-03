<?php
// A row in fasting_days means the user marked that date as a fasting day via
// the Journal's "Are you fasting today?" toggle. It decides how a day with no
// rations or activity logged is scored: fasting → the full day's burn counts
// as Life Points (as before); not fasting → Life Points are 0 once the day is
// over, since an empty journal more likely means "forgot to log" than "ate
// nothing". Lazy DDL, same pattern as push_subscriptions/weight_entries.
function ensureFastingTable(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS fasting_days (
        user_id    INT UNSIGNED NOT NULL,
        fast_date  DATE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, fast_date)
    )");
}
