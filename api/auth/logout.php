<?php
require_once dirname(__DIR__) . '/db.php';
sessionStart();

header('Content-Type: application/json; charset=utf-8');

$_SESSION = [];
session_destroy();

echo json_encode(['ok' => true]);
