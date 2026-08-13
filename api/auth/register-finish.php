<?php
require_once dirname(__DIR__) . '/db.php';
require_once dirname(dirname(__DIR__)) . '/vendor/autoload.php';

sessionStart();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['ok' => false, 'error' => 'Method not allowed']); exit;
}

$challenge = $_SESSION['wa_challenge']   ?? null;
$userId    = $_SESSION['wa_reg_user_id'] ?? null;

if (!$challenge || !$userId) {
    http_response_code(400); echo json_encode(['ok' => false, 'error' => 'No pending registration']); exit;
}

$b = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    $webAuthn = new lbuchs\WebAuthn\WebAuthn(RP_NAME, RP_ID, ['none']);

    $clientDataJSON    = base64_decode($b['response']['clientDataJSON']);
    $attestationObject = base64_decode($b['response']['attestationObject']);

    $data = $webAuthn->processCreate(
        $clientDataJSON,
        $attestationObject,
        $challenge,
        requireUserVerification: true,
        requireUserPresent: true
    );

    // Store credential
    $stmt = db()->prepare(
        'INSERT INTO passkeys (user_id, credential_id, public_key, sign_count, device_name)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        base64_encode($data->credentialId),
        base64_encode($data->publicKey),
        $data->signCount,
        $b['deviceName'] ?? null,
    ]);

    // Start session
    unset($_SESSION['wa_challenge'], $_SESSION['wa_reg_user_id']);
    $_SESSION['user_id'] = $userId;

    $stmt = db()->prepare('SELECT id, display_name, first_seen FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    echo json_encode(['ok' => true, 'data' => $user]);

} catch (Throwable $e) {
    // Clean up provisional user on failure
    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
    unset($_SESSION['wa_challenge'], $_SESSION['wa_reg_user_id']);
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
