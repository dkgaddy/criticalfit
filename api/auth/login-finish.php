<?php
require_once dirname(__DIR__) . '/db.php';
require_once dirname(dirname(__DIR__)) . '/vendor/autoload.php';

sessionStart();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['ok' => false, 'error' => 'Method not allowed']); exit;
}

$challenge = $_SESSION['wa_challenge'] ?? null;
if (!$challenge) {
    http_response_code(400); echo json_encode(['ok' => false, 'error' => 'No pending login']); exit;
}

$b = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    // Look up credential by ID
    $credentialId = base64_encode(base64_decode(strtr($b['rawId'] ?? '', '-_', '+/')));
    $stmt = db()->prepare('SELECT * FROM passkeys WHERE credential_id = ?');
    $stmt->execute([$credentialId]);
    $passkey = $stmt->fetch();

    if (!$passkey) {
        throw new RuntimeException('Passkey not recognised');
    }

    $webAuthn = new lbuchs\WebAuthn\WebAuthn(RP_NAME, RP_ID, ['none']);

    // Browser sends base64url; PHP's base64_decode needs standard base64
    $clientDataJSON    = base64_decode(strtr($b['response']['clientDataJSON']    ?? '', '-_', '+/'));
    $authenticatorData = base64_decode(strtr($b['response']['authenticatorData'] ?? '', '-_', '+/'));
    $signature         = base64_decode(strtr($b['response']['signature']         ?? '', '-_', '+/'));
    $publicKey         = base64_decode($passkey['public_key']);

    $webAuthn->processGet(
        $clientDataJSON,
        $authenticatorData,
        $signature,
        $publicKey,
        $challenge,
        requireUserVerification: true,
        requireUserPresent: true
    );

    // Update sign count + last used
    db()->prepare('UPDATE passkeys SET sign_count = ?, last_used_at = NOW() WHERE id = ?')
        ->execute([$passkey['sign_count'] + 1, $passkey['id']]);

    unset($_SESSION['wa_challenge']);
    $_SESSION['user_id'] = (int)$passkey['user_id'];

    $stmt = db()->prepare('SELECT id, display_name, first_seen FROM users WHERE id = ?');
    $stmt->execute([$passkey['user_id']]);
    $user = $stmt->fetch();

    echo json_encode(['ok' => true, 'data' => $user]);

} catch (Throwable $e) {
    unset($_SESSION['wa_challenge']);
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
