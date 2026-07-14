<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'database.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('contador_musicos_session');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 12,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function jsonResponse(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonBody(): array
{
    $body = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($body)) {
        jsonResponse(['ok' => false, 'message' => 'JSON inválido.'], 400);
    }
    return $body;
}

function currentUser(): array
{
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user) || empty($user['id'])) {
        jsonResponse(['ok' => false, 'message' => 'Sessão expirada.'], 401);
    }
    return $user;
}

function requireAdmin(): array
{
    $user = currentUser();
    if (($user['role'] ?? '') !== 'administrador') {
        jsonResponse(['ok' => false, 'message' => 'Acesso permitido apenas para administrador.'], 403);
    }
    return $user;
}

function publicUser(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'name' => $user['name'],
        'role' => $user['role'],
    ];
}

function apiFailure(Throwable $error): never
{
    error_log($error->__toString());
    jsonResponse(['ok' => false, 'message' => 'Não foi possível acessar o banco de dados.'], 503);
}

function ensureEventFinalizationSchema(PDO $database): void
{
    static $ready = false;
    if ($ready) return;
    $database->exec("ALTER TABLE events ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'em_andamento'");
    $database->exec('ALTER TABLE events ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ');
    $database->exec('ALTER TABLE events ADD COLUMN IF NOT EXISTS finalized_by BIGINT REFERENCES users(id)');
    $ready = true;
}
