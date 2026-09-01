<?php
require_once __DIR__ . '/db.php';
$uid = requireAuth();
$pdo = db();

if (empty($_SESSION['_weight_ddl'])) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS weight_entries (
            id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id    INT UNSIGNED NOT NULL,
            weight     DECIMAL(6,2) NOT NULL,
            unit       VARCHAR(10) NOT NULL DEFAULT 'imperial',
            log_date   DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_date (user_id, log_date)
        )");
    } catch (Exception $e) {}
    $_SESSION['_weight_ddl'] = 1;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['date'])) {
        $date = $_GET['date'];
        if (!validDate($date)) { json_out(null); exit; }
        $stmt = $pdo->prepare(
            'SELECT log_date, weight, unit FROM weight_entries WHERE user_id = ? AND log_date = ?'
        );
        $stmt->execute([$uid, $date]);
        $row = $stmt->fetch();
        json_out($row ? ['date' => $row['log_date'], 'weight' => (float)$row['weight'], 'unit' => $row['unit']] : null);
        exit;
    }
    $days = min((int)($_GET['days'] ?? 90), 365);
    $stmt = $pdo->prepare(
        'SELECT log_date, weight, unit FROM weight_entries
         WHERE user_id = ? ORDER BY log_date ASC LIMIT ?'
    );
    $stmt->execute([$uid, $days]);
    json_out($stmt->fetchAll());
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b      = json_decode(file_get_contents('php://input'), true) ?? [];
    $weight = round((float)($b['weight'] ?? 0), 2);
    $unit   = ($b['unit'] ?? 'imperial') === 'metric' ? 'metric' : 'imperial';
    $date   = $b['date'] ?? date('Y-m-d');
    if (!validDate($date)) $date = date('Y-m-d');

    if ($weight <= 0) { json_err('Invalid weight'); exit; }

    $pdo->prepare(
        'INSERT INTO weight_entries (user_id, weight, unit, log_date) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE weight = VALUES(weight), unit = VALUES(unit)'
    )->execute([$uid, $weight, $unit, $date]);

    $pdo->prepare('UPDATE users SET weight = ? WHERE id = ?')
        ->execute([$weight, $uid]);

    // Recalculate BMR/TDEE (Mifflin-St Jeor) from the new weight so the
    // profile doesn't go stale until the user happens to revisit it.
    $stmt = $pdo->prepare(
        'SELECT gender, age, activity, height_ft, height_in, height_cm FROM users WHERE id = ?'
    );
    $stmt->execute([$uid]);
    $u = $stmt->fetch();

    if ($u && $u['age'] && $u['gender']) {
        $weightKg = $unit === 'metric' ? $weight : $weight * 0.453592;
        $heightCm = $u['height_cm']
            ? (float)$u['height_cm']
            : ((float)$u['height_ft'] * 12 + (float)$u['height_in']) * 2.54;

        if ($weightKg > 0 && $heightCm > 0) {
            $base = 10 * $weightKg + 6.25 * $heightCm - 5 * (int)$u['age'];
            $bmr  = (int)round($u['gender'] === 'male' ? $base + 5 : $base - 161);

            $MULTS = ['sedentary' => 1.200, 'light' => 1.375, 'moderate' => 1.550, 'active' => 1.725];
            $tdee  = (int)round($bmr * ($MULTS[$u['activity']] ?? 1.200));

            $pdo->prepare('UPDATE users SET bmr = ?, tdee = ? WHERE id = ?')
                ->execute([$bmr, $tdee, $uid]);
        }
    }

    json_out(['logged' => true, 'weight' => $weight, 'unit' => $unit]);
    exit;
}

json_err('Method not allowed', 405);
exit;
