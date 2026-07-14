<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap.php';

try {
    $user = currentUser();
    $db = database();
    ensureEventFinalizationSchema($db);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = jsonBody();
        $event = is_array($body['event'] ?? null) ? $body['event'] : [];
        $deviceId = trim((string) ($body['deviceId'] ?? ''));
        $deviceName = trim((string) ($body['deviceName'] ?? ''));
        $counts = is_array($body['counts'] ?? null) ? $body['counts'] : [];
        $eventKey = eventKey($event);

        if ($deviceId === '' || empty($event['date']) || empty($event['type'])) {
            jsonResponse(['ok' => false, 'message' => 'Evento ou aparelho inválido.'], 400);
        }

        $db->beginTransaction();
        $eventStatement = $db->prepare(
            'INSERT INTO events
             (event_key, name, event_type, event_date, location, regional_leader, elder, region, created_by)
             VALUES (:event_key, :name, :event_type, :event_date, :location, :regional_leader, :elder, :region, :created_by)
             ON CONFLICT (event_key) DO UPDATE SET
               name = EXCLUDED.name, location = EXCLUDED.location,
               regional_leader = EXCLUDED.regional_leader, elder = EXCLUDED.elder,
               region = EXCLUDED.region, updated_at = NOW()
             RETURNING id,status'
        );
        $eventStatement->execute([
            'event_key' => $eventKey,
            'name' => trim((string) ($event['name'] ?? 'Contagem de Músicos e Organistas')),
            'event_type' => (string) $event['type'],
            'event_date' => (string) $event['date'],
            'location' => trim((string) ($event['local'] ?? '')),
            'regional_leader' => trim((string) ($event['regionalLeader'] ?? '')),
            'elder' => trim((string) ($event['elder'] ?? '')),
            'region' => trim((string) ($event['region'] ?? '')),
            'created_by' => $user['id'],
        ]);
        $storedEvent = $eventStatement->fetch();
        $eventId = (int) $storedEvent['id'];
        if (($storedEvent['status'] ?? '') === 'finalizado') {
            $db->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Este evento foi finalizado. A contagem está bloqueada.', 'status' => 'finalizado'], 409);
        }

        $countStatement = $db->prepare(
            'INSERT INTO device_counts
             (event_id, device_id, device_name, counts, recorded_by, client_updated_at)
             VALUES (:event_id, :device_id, :device_name, CAST(:counts AS jsonb), :recorded_by, :client_updated_at)
             ON CONFLICT (event_id, device_id) DO UPDATE SET
               device_name = EXCLUDED.device_name, counts = EXCLUDED.counts,
               recorded_by = EXCLUDED.recorded_by, client_updated_at = EXCLUDED.client_updated_at,
               updated_at = NOW()'
        );
        $countStatement->execute([
            'event_id' => $eventId,
            'device_id' => $deviceId,
            'device_name' => $deviceName,
            'counts' => json_encode($counts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'recorded_by' => $user['id'],
            'client_updated_at' => (string) ($body['updatedAt'] ?? gmdate('c')),
        ]);
        $db->prepare(
            "UPDATE group_assignments SET expires_at=NOW()+INTERVAL '5 minutes', updated_at=NOW()
             WHERE event_key=:event_key AND user_id=:user_id AND device_id=:device_id"
        )->execute(['event_key' => $eventKey, 'user_id' => $user['id'], 'device_id' => $deviceId]);
        $db->commit();
        jsonResponse(['ok' => true, 'eventKey' => $eventKey]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        jsonResponse(['ok' => false, 'message' => 'Método não permitido.'], 405);
    }

    $event = [
        'name' => (string) ($_GET['name'] ?? ''),
        'type' => (string) ($_GET['type'] ?? ''),
        'date' => (string) ($_GET['date'] ?? ''),
        'local' => (string) ($_GET['local'] ?? ''),
    ];
    $eventKey = eventKey($event);
    $eventStatement = $db->prepare('SELECT status,finalized_at FROM events WHERE event_key=:event_key');
    $eventStatement->execute(['event_key' => $eventKey]);
    $storedEvent = $eventStatement->fetch() ?: ['status' => 'em_andamento', 'finalized_at' => null];
    $statement = $db->prepare(
        'SELECT dc.device_id, dc.device_name, dc.counts, dc.client_updated_at,
                u.username, u.name AS user_name
         FROM device_counts dc
         JOIN events e ON e.id = dc.event_id
         LEFT JOIN users u ON u.id = dc.recorded_by
         WHERE e.event_key = :event_key
         ORDER BY dc.updated_at DESC'
    );
    $statement->execute(['event_key' => $eventKey]);
    $devices = array_map(static function (array $row): array {
        return [
            'deviceId' => $row['device_id'],
            'deviceName' => $row['device_name'],
            'counts' => is_array($row['counts']) ? $row['counts'] : json_decode((string) $row['counts'], true),
            'updatedAt' => $row['client_updated_at'],
            'username' => $row['username'],
            'userName' => $row['user_name'],
        ];
    }, $statement->fetchAll());
    jsonResponse(['ok' => true, 'eventKey' => $eventKey, 'devices' => $devices,
        'status' => $storedEvent['status'], 'finalizedAt' => $storedEvent['finalized_at']]);
} catch (Throwable $error) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    apiFailure($error);
}

function eventKey(array $event): string
{
    $parts = [
        trim(strtolower((string) ($event['date'] ?? ''))),
        trim(strtolower((string) ($event['type'] ?? ''))),
        trim(strtolower((string) ($event['name'] ?? ''))),
        trim(strtolower((string) ($event['local'] ?? ''))),
    ];
    return hash('sha256', implode('|', $parts));
}
