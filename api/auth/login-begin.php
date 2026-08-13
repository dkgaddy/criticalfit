<?php
require_once dirname(__DIR__) . '/db.php';
require_once dirname(dirname(__DIR__)) . '/vendor/autoload.php';

sessionStart();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['ok' => false, 'error' => 'Method not allowed']); exit;
}

$webAuthn  = new lbuchs\WebAuthn\WebAuthn(RP_NAME, RP_ID, ['none']);
$getArgs   = $webAuthn->getGetArgs(
    allowCredentials: [],   // empty = discoverable / passkey flow
    timeout: 60,
    userVerificationType: 'required'
);

$_SESSION['wa_challenge'] = (string)$webAuthn->getChallenge();

echo json_encode(['ok' => true, 'data' => $getArgs]);
