<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Metodo nao permitido.']);
    exit;
}

$usersFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'users.json';
$rawBody = file_get_contents('php://input') ?: '';
$payload = json_decode($rawBody, true);

if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'JSON invalido.']);
    exit;
}

$currentPacket = readUsersPacket($usersFile);
$currentUsers = normalizeUsers($currentPacket['users'] ?? []);
$adminUsername = normalizeUsername((string)($payload['adminUsername'] ?? ''));
$adminPassword = (string)($payload['adminPassword'] ?? '');

$isAuthorized = false;
foreach ($currentUsers as $user) {
    if (
        $user['username'] === $adminUsername
        && $user['password'] === $adminPassword
        && $user['role'] === 'administrador'
    ) {
        $isAuthorized = true;
        break;
    }
}

if (!$isAuthorized) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'message' => 'Senha do administrador invalida.']);
    exit;
}

$nextUsers = normalizeUsers($payload['users'] ?? []);
if (count($nextUsers) === 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Lista de usuarios vazia.']);
    exit;
}

$hasAdmin = false;
foreach ($nextUsers as $user) {
    if ($user['role'] === 'administrador') {
        $hasAdmin = true;
        break;
    }
}

if (!$hasAdmin) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Mantenha pelo menos um administrador.']);
    exit;
}

$packet = [
    'schemaVersion' => 1,
    'updatedAt' => gmdate('c'),
    'users' => $nextUsers,
];

$encoded = json_encode($packet, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($encoded === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Falha ao gerar JSON.']);
    exit;
}

if (file_put_contents($usersFile, $encoded . PHP_EOL, LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Nao foi possivel gravar data/users.json.']);
    exit;
}

echo json_encode(['ok' => true, 'users' => $nextUsers], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

function readUsersPacket(string $usersFile): array
{
    if (!is_file($usersFile)) {
        return ['users' => []];
    }

    $content = file_get_contents($usersFile);
    if ($content === false) {
        return ['users' => []];
    }

    $packet = json_decode($content, true);
    return is_array($packet) ? $packet : ['users' => []];
}

function normalizeUsers($users): array
{
    if (!is_array($users)) {
        return [];
    }

    $byUsername = [];
    foreach ($users as $user) {
        if (!is_array($user)) {
            continue;
        }

        $username = normalizeUsername((string)($user['username'] ?? ''));
        $password = (string)($user['password'] ?? '');
        $name = trim((string)($user['name'] ?? $username));
        $role = ($user['role'] ?? '') === 'administrador' ? 'administrador' : 'contador';

        if ($username === '' || $password === '' || !preg_match('/^[a-z0-9._-]{3,}$/', $username)) {
            continue;
        }

        $byUsername[$username] = [
            'username' => $username,
            'password' => $password,
            'name' => $name !== '' ? $name : $username,
            'role' => $role,
        ];
    }

    return array_values($byUsername);
}

function normalizeUsername(string $username): string
{
    return strtolower(trim($username));
}
