<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap.php';

try {
    $admin = requireAdmin();
    $db = database();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $users = $db->query(
            'SELECT id, username, name, role FROM users WHERE active = TRUE ORDER BY name, username'
        )->fetchAll();
        jsonResponse(['ok' => true, 'users' => array_map('publicUser', $users)]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['ok' => false, 'message' => 'Método não permitido.'], 405);
    }

    $body = jsonBody();
    $action = (string) ($body['action'] ?? 'save');
    $username = strtolower(trim((string) ($body['username'] ?? '')));

    if ($action === 'delete') {
        if ($username === $admin['username']) {
            jsonResponse(['ok' => false, 'message' => 'Não é possível excluir o usuário logado.'], 400);
        }
        $statement = $db->prepare('UPDATE users SET active = FALSE, updated_at = NOW() WHERE username = :username');
        $statement->execute(['username' => $username]);
        jsonResponse(['ok' => true]);
    }

    $originalUsername = strtolower(trim((string) ($body['originalUsername'] ?? $username)));
    $name = trim((string) ($body['name'] ?? ''));
    $role = ($body['role'] ?? '') === 'administrador' ? 'administrador' : 'contador';
    $password = (string) ($body['password'] ?? '');

    if (!preg_match('/^[a-z0-9._-]{3,80}$/', $username) || $name === '') {
        jsonResponse(['ok' => false, 'message' => 'Dados do usuário inválidos.'], 400);
    }

    $existingStatement = $db->prepare('SELECT id, password_hash FROM users WHERE username = :username');
    $existingStatement->execute(['username' => $originalUsername]);
    $existing = $existingStatement->fetch();
    if (!$existing && $password === '') {
        jsonResponse(['ok' => false, 'message' => 'Informe a senha do novo usuário.'], 400);
    }

    $passwordHash = $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : $existing['password_hash'];
    if ($existing) {
        $statement = $db->prepare(
            'UPDATE users SET username = :username, password_hash = :password_hash, name = :name,
             role = :role, active = TRUE, updated_at = NOW() WHERE id = :id'
        );
        $statement->execute([
            'id' => $existing['id'], 'username' => $username, 'password_hash' => $passwordHash,
            'name' => $name, 'role' => $role,
        ]);
    } else {
        $statement = $db->prepare(
            'INSERT INTO users (username, password_hash, name, role) VALUES (:username, :password_hash, :name, :role)'
        );
        $statement->execute([
            'username' => $username, 'password_hash' => $passwordHash, 'name' => $name, 'role' => $role,
        ]);
    }

    jsonResponse(['ok' => true]);
} catch (PDOException $error) {
    if ($error->getCode() === '23505') {
        jsonResponse(['ok' => false, 'message' => 'Já existe um usuário com este login.'], 409);
    }
    apiFailure($error);
} catch (Throwable $error) {
    apiFailure($error);
}
