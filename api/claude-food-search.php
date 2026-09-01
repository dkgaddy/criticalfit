<?php
require_once __DIR__ . '/db.php';
$uid = requireAuth();

$stmt = db()->prepare('SELECT is_premium FROM users WHERE id = ?');
$stmt->execute([$uid]);
$row = $stmt->fetch();
if (!$row || !$row['is_premium']) {
    json_err('Guild membership required', 403);
    exit;
}

$query = trim($_GET['query'] ?? '');
if (strlen($query) < 2) {
    json_err('Query too short');
    exit;
}
if (strlen($query) > 100) {
    json_err('Query too long');
    exit;
}

// Allowlist: letters, numbers, spaces, and punctuation that appear in food names.
// Strips anything else so injected instructions cannot reach the model.
$query = trim(preg_replace('/[^\p{L}\p{N}\s\-\'\.,&()\/]/u', '', $query));
if (strlen($query) < 2) {
    json_err('Query too short');
    exit;
}

// System prompt holds all instructions; user turn holds only the sanitized query.
// Separating them is the strongest available defence against prompt injection.
$system = <<<SYS
You are a precise nutrition database. When given a food name, return 6-8 relevant food items as a JSON array.

Include popular restaurant menu items and branded products when relevant (e.g. if asked for "whopper" return "Burger King Whopper" with real published nutrition data; if asked for "big mac" return "McDonald's Big Mac", etc.).

Each object must have exactly these fields:
- "name": specific food name (e.g. "Burger King Whopper", "Lay's Classic Chips (1 oz bag)", "Chicken Breast, grilled")
- "serving_desc": natural serving (e.g. "1 burger (291g)", "1 oz bag (28g)", "4 oz (113g)", "1 cup (240ml)")
- "grams": serving weight in grams as a number
- "calories": kcal per serving as a number
- "protein": protein grams per serving as a number
- "carbs": total carbohydrate grams per serving as a number
- "fat": total fat grams per serving as a number

Use published nutrition facts where known. Return ONLY a valid JSON array with no markdown, no commentary, and no code fences.
SYS;

$payload = json_encode([
    'model'      => 'claude-haiku-4-5-20251001',
    'max_tokens' => 1024,
    'system'     => $system,
    'messages'   => [['role' => 'user', 'content' => $query]],
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: '          . ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_POSTFIELDS => $payload,
]);

$raw      = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$raw || $httpCode !== 200) {
    json_err('AI service unavailable', 502);
    exit;
}

$resp  = json_decode($raw, true);
$text  = $resp['content'][0]['text'] ?? '';

// Strip any accidental markdown fences
$text = preg_replace('/^```[a-z]*\n?/m', '', $text);
$text = preg_replace('/^```$/m', '', $text);

$foods = json_decode(trim($text), true);
if (!is_array($foods)) {
    json_err('Failed to parse AI response', 502);
    exit;
}

$out = [];
foreach ($foods as $f) {
    if (!isset($f['name'], $f['calories'])) continue;
    $out[] = [
        'fdcId'        => null,
        'name'         => (string)($f['name']         ?? 'Unknown'),
        'brand'        => null,
        'serving_desc' => (string)($f['serving_desc'] ?? ''),
        'grams'        => max(1, (float)($f['grams']   ?? 100)),
        'calories'     => max(0, (float)($f['calories'] ?? 0)),
        'protein'      => max(0, (float)($f['protein']  ?? 0)),
        'carbs'        => max(0, (float)($f['carbs']    ?? 0)),
        'fat'          => max(0, (float)($f['fat']      ?? 0)),
    ];
}

json_out($out);
exit;
