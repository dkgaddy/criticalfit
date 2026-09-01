<?php
require_once dirname(__DIR__) . '/db.php';
require_once dirname(dirname(__DIR__)) . '/vendor/autoload.php';

sessionStart();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['ok' => false, 'error' => 'Method not allowed']); exit;
}

$webAuthn = new lbuchs\WebAuthn\WebAuthn(RP_NAME, RP_ID, ['none']);
try {
    $getArgs = $webAuthn->getGetArgs(
        credentialIds: [],   // empty = discoverable / passkey flow
        timeout: 60,
        requireUserVerification: true
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Login failed. Please try again.']);
    exit;
}

$_SESSION['wa_challenge'] = $webAuthn->getChallenge();

echo json_encode(['ok' => true, 'data' => $getArgs]);
