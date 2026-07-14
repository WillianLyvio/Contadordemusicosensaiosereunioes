<?php
declare(strict_types=1);

/**
 * Retorna uma conexao PDO com o PostgreSQL do Neon.
 *
 * A credencial deve ser fornecida por DATABASE_URL. O arquivo .env e lido
 * apenas como conveniencia no desenvolvimento e nunca deve ser versionado.
 */
function database(): PDO
{
    static $connection = null;

    if ($connection instanceof PDO) {
        return $connection;
    }

    $root = dirname(__DIR__);
    loadLocalEnvironment($root . DIRECTORY_SEPARATOR . '.env.local');
    loadLocalEnvironment($root . DIRECTORY_SEPARATOR . '.env');
    $databaseUrl = getenv('DATABASE_URL') ?: '';

    if ($databaseUrl === '') {
        throw new RuntimeException('A variavel DATABASE_URL nao foi configurada.');
    }

    if (!extension_loaded('pdo_pgsql')) {
        throw new RuntimeException('A extensao pdo_pgsql do PHP nao esta habilitada.');
    }

    $parts = parse_url($databaseUrl);
    if ($parts === false || ($parts['scheme'] ?? '') !== 'postgresql') {
        throw new RuntimeException('DATABASE_URL deve ser uma URL postgresql valida.');
    }

    $host = $parts['host'] ?? '';
    $port = (int) ($parts['port'] ?? 5432);
    $dbname = ltrim($parts['path'] ?? '', '/');
    $user = isset($parts['user']) ? rawurldecode($parts['user']) : '';
    $password = isset($parts['pass']) ? rawurldecode($parts['pass']) : '';

    if ($host === '' || $dbname === '' || $user === '') {
        throw new RuntimeException('DATABASE_URL nao contem host, banco e usuario.');
    }

    $dsn = sprintf(
        'pgsql:host=%s;port=%d;dbname=%s;sslmode=require',
        $host,
        $port,
        $dbname
    );

    $connection = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $connection;
}

function loadLocalEnvironment(string $path): void
{
    if (!is_file($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        [$name, $value] = array_map('trim', explode('=', $line, 2));
        if ($name === '' || getenv($name) !== false) {
            continue;
        }

        $value = trim($value, "\"'");
        putenv($name . '=' . $value);
        $_ENV[$name] = $value;
    }
}
