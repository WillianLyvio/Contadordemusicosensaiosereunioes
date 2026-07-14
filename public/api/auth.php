<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $user = $_SESSION['user'] ?? null;
        jsonResponse(['ok' => true, 'user' => is_array($user) ? $user : null]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $sessionUser = $_SESSION['user'] ?? null;
        if (is_array($sessionUser) && !empty($sessionUser['id'])) {
            database()->prepare('DELETE FROM group_assignments WHERE user_id = :user_id')
                ->execute(['user_id' => $sessionUser['id']]);
        }
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

    $groups = array_values(array_unique(array_filter(
        is_array($body['countGroups'] ?? null) ? $body['countGroups'] : [],
        static fn ($group): bool => preg_match('/^[a-z0-9_]{2,40}$/', (string) $group) === 1
    )));
    $event = is_array($body['event'] ?? null) ? $body['event'] : [];
    $deviceId = trim((string) ($body['deviceId'] ?? ''));
    if ($user['role'] === 'contador' && ($groups === [] || $deviceId === '')) {
        jsonResponse(['ok' => false, 'message' => 'Selecione ao menos um grupo para contagem.'], 400);
    }
    if ($groups !== [] && $deviceId !== '') {
        reserveGroups(database(), $user, $event, $groups, $deviceId, trim((string) ($body['deviceName'] ?? '')));
    }

    session_regenerate_id(true);
    $_SESSION['user'] = publicUser($user);
    jsonResponse(['ok' => true, 'user' => $_SESSION['user']]);
} catch (Throwable $error) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) $db->rollBack();
    try {
        $connection = database();
        if ($connection->inTransaction()) $connection->rollBack();
    } catch (Throwable) {
        // Mantém o erro original.
    }
    apiFailure($error);
}

function reserveGroups(PDO $db, array $user, array $event, array $groups, string $deviceId, string $deviceName): void
{
    $key = hash('sha256', implode('|', array_map(
        static fn ($value): string => strtolower(trim((string) $value)),
        [$event['date'] ?? '', $event['type'] ?? '', $event['name'] ?? '', $event['local'] ?? '']
    )));
    $db->exec('DELETE FROM group_assignments WHERE expires_at <= NOW()');
    $placeholders = implode(',', array_fill(0, count($groups), '?'));
    $conflict = $db->prepare(
        "SELECT ga.group_id, u.name FROM group_assignments ga JOIN users u ON u.id=ga.user_id
         WHERE ga.event_key=? AND ga.group_id IN ($placeholders) AND NOT (ga.user_id=? AND ga.device_id=?)"
    );
    $conflict->execute([$key, ...$groups, $user['id'], $deviceId]);
    $occupied = $conflict->fetchAll();
    if ($occupied !== []) {
        $labels = implode(', ', array_map(static fn ($row): string => $row['group_id'] . ' (' . $row['name'] . ')', $occupied));
        jsonResponse(['ok' => false, 'message' => 'Grupo(s) já em uso: ' . $labels, 'conflicts' => $occupied], 409);
    }
    $db->prepare('DELETE FROM group_assignments WHERE user_id=? AND device_id=? AND event_key=?')
        ->execute([$user['id'], $deviceId, $key]);
    $insert = $db->prepare(
        "INSERT INTO group_assignments (event_key,group_id,user_id,device_id,device_name,expires_at)
         VALUES (?,?,?,?,?,NOW() + INTERVAL '5 minutes')
         ON CONFLICT (event_key,group_id) DO UPDATE SET user_id=EXCLUDED.user_id,device_id=EXCLUDED.device_id,
         device_name=EXCLUDED.device_name,expires_at=EXCLUDED.expires_at,updated_at=NOW()"
    );
    foreach ($groups as $group) $insert->execute([$key, $group, $user['id'], $deviceId, $deviceName]);
}
