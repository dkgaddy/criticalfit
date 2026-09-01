<?php
require_once __DIR__ . '/db.php';
$uid = requireAuth();

header('Content-Type: application/json; charset=utf-8');

$query    = trim($_GET['query'] ?? '');
$pageSize = min((int)($_GET['pageSize'] ?? 50), 50);

if (strlen($query) < 2) {
    echo json_encode(['foods' => []]);
    exit;
}

$url = 'https://api.nal.usda.gov/fdc/v1/foods/search?' . http_build_query([
    'query'    => $query,
    'api_key'  => USDA_API_KEY,
    'pageSize' => $pageSize,
    'dataType' => 'Foundation,SR Legacy,Survey (FNDDS),Branded',
]);

$ctx      = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true]]);
$raw      = @file_get_contents($url, false, $ctx);
$httpCode = isset($http_response_header)
    ? (int)substr($http_response_header[0], 9, 3)
    : 0;

if ($raw === false || $httpCode >= 400) {
    http_response_code(502);
    echo json_encode(['error' => 'USDA API unavailable', 'code' => $httpCode]);
    exit;
}

$data = json_decode($raw, true);

// Nutrient IDs we care about
const NUT_CALORIES = 1008;
const NUT_PROTEIN  = 1003;
const NUT_FAT      = 1004;
const NUT_CARBS    = 1005;

$foods = [];
foreach ($data['foods'] ?? [] as $f) {
    // Index nutrients by ID
    $nuts = [];
    foreach ($f['foodNutrients'] ?? [] as $n) {
        $nuts[(int)$n['nutrientId']] = (float)$n['value'];
    }

    $calories = round($nuts[NUT_CALORIES] ?? 0);
    if ($calories === 0) continue; // skip foods with no calorie data

    $foods[] = [
        'fdcId'   => (int)$f['fdcId'],
        'name'    => $f['description'],
        'brand'   => $f['brandOwner'] ?? '',
        'calories'=> $calories,
        'protein' => round($nuts[NUT_PROTEIN] ?? 0, 1),
        'fat'     => round($nuts[NUT_FAT]     ?? 0, 1),
        'carbs'   => round($nuts[NUT_CARBS]   ?? 0, 1),
    ];
}

// Check rate-limit headers and pass them through for monitoring
foreach ($http_response_header ?? [] as $h) {
    if (stripos($h, 'X-RateLimit') === 0) header($h);
}

echo json_encode(['foods' => $foods]);
