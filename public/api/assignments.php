<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['ok' => false, 'message' => 'Método não permitido.'], 405);
    }
    $body = jsonBody();
    $event = is_array($body['event'] ?? null) ? $body['event'] : [];
    $groups = is_array($body['countGroups'] ?? null) ? array_values($body['countGroups']) : [];
    $key = hash('sha256', implode('|', array_map(
        static fn ($value): string => strtolower(trim((string) $value)),
        [$event['date'] ?? '', $event['type'] ?? '', $event['name'] ?? '', $event['local'] ?? '']
    )));
    $db = database();
    $db->exec('DELETE FROM group_assignments WHERE expires_at <= NOW()');
    if ($groups === []) jsonResponse(['ok' => true, 'conflicts' => []]);
    $placeholders = implode(',', array_fill(0, count($groups), '?'));
    $statement = $db->prepare(
        "SELECT ga.group_id AS \"groupId\", u.name AS \"userName\", ga.device_name AS \"deviceName\"
         FROM group_assignments ga JOIN users u ON u.id=ga.user_id
         WHERE ga.event_key=? AND ga.group_id IN ($placeholders)"
    );
    $statement->execute([$key, ...$groups]);
    jsonResponse(['ok' => true, 'conflicts' => $statement->fetchAll()]);
} catch (Throwable $error) {
    apiFailure($error);
}
