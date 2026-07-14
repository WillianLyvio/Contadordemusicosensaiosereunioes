<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $user = $_SESSION['user'] ?? null;
        jsonResponse(['ok' => true, 'user' => is_array($user) ? $user : null]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $_SESSION = [];
        session_destroy();
        jsonResponse(['ok' => true]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['ok' => false, 'message' => 'Método não permitido.'], 405);
    }

    $body = jsonBody();
    $username = strtolower(trim((string) ($body['username'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    $statement = database()->prepare(
        'SELECT id, username, password_hash, name, role FROM users WHERE username = :username AND active = TRUE'
    );
    $statement->execute(['username' => $username]);
    $user = $statement->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['ok' => false, 'message' => 'Usuário ou senha inválidos.'], 401);
    }

    session_regenerate_id(true);
    $_SESSION['user'] = publicUser($user);
    jsonResponse(['ok' => true, 'user' => $_SESSION['user']]);
} catch (Throwable $error) {
    apiFailure($error);
}
