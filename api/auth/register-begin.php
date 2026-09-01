<?php
require_once dirname(__DIR__) . '/db.php';
require_once dirname(dirname(__DIR__)) . '/vendor/autoload.php';

sessionStart();
header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405); echo json_encode(['ok' => false, 'error' => 'Method not allowed']); exit;
    }

    $b           = json_decode(file_get_contents('php://input'), true) ?? [];
    $displayName = trim($b['displayName'] ?? '');

    if ($displayName === '') {
        http_response_code(400); echo json_encode(['ok' => false, 'error' => 'Display name required']); exit;
    }

    if (!checkRateLimit(clientIp(), 'register', 5, 3600)) {
        http_response_code(429); echo json_encode(['ok' => false, 'error' => 'Too many registration attempts. Please try again later.']); exit;
    }

    // Create a provisional user row; delete it if registration never completes
    $stmt = db()->prepare(
        'INSERT INTO users (display_name, first_seen) VALUES (?, CURDATE())'
    );
    $stmt->execute([$displayName]);
    $userId = (int)db()->lastInsertId();

    // Pack user ID as 8-byte big-endian for the WebAuthn user handle
    $userHandle = pack('J', $userId);

    $webAuthn = new lbuchs\WebAuthn\WebAuthn(RP_NAME, RP_ID, ['none']);
    $createArgs = $webAuthn->getCreateArgs(
        $userHandle,
        $displayName,
        $displayName,
        60,
        requireResidentKey: true,
        requireUserVerification: true,
        crossPlatformAttachment: false
    );

    // Store ByteBuffer object (not string) so processCreate can compare raw bytes
    $_SESSION['wa_challenge']   = $webAuthn->getChallenge();
    $_SESSION['wa_reg_user_id'] = $userId;

    echo json_encode(['ok' => true, 'data' => $createArgs]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Registration failed. Please try again.']);
}
