<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'database.php';

try {
    $schema = file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . 'schema.sql');
    if ($schema === false) {
        throw new RuntimeException('Nao foi possivel ler database/schema.sql.');
    }

    database()->exec($schema);
    importInitialUsers(database(), dirname(__DIR__) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'users.json');
    fwrite(STDOUT, "Schema aplicado com sucesso.\n");
} catch (Throwable $error) {
    fwrite(STDERR, 'Falha na migracao: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}

function importInitialUsers(PDO $database, string $path): void
{
    if (!is_file($path)) {
        return;
    }

    $packet = json_decode((string) file_get_contents($path), true);
    $users = is_array($packet) ? ($packet['users'] ?? $packet) : [];
    if (!is_array($users)) {
        return;
    }

    $statement = $database->prepare(
        'INSERT INTO users (username, password_hash, name, role)
         VALUES (:username, :password_hash, :name, :role)
         ON CONFLICT (username) DO NOTHING'
    );

    foreach ($users as $user) {
        $username = strtolower(trim((string) ($user['username'] ?? '')));
        $password = (string) ($user['password'] ?? '');
        if (!preg_match('/^[a-z0-9._-]{3,80}$/', $username) || $password === '') {
            continue;
        }

        $statement->execute([
            'username' => $username,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'name' => trim((string) ($user['name'] ?? $username)) ?: $username,
            'role' => ($user['role'] ?? '') === 'administrador' ? 'administrador' : 'contador',
        ]);
    }
}
