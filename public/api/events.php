<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap.php';

try {
    $user = currentUser();
    $db = database();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $date = trim((string) ($_GET['date'] ?? ''));
        $sql = "SELECT e.id, e.event_key AS \"eventKey\", e.name, e.event_type AS type,
                       e.event_date::text AS date, e.location AS local,
                       e.regional_leader AS \"regionalLeader\", e.elder, e.region,
                       e.created_at AS \"createdAt\", u.name AS \"createdBy\",
                       COUNT(dc.id)::int AS \"deviceCount\"
                FROM events e LEFT JOIN users u ON u.id=e.created_by
                LEFT JOIN device_counts dc ON dc.event_id=e.id";
        $params = [];
        if ($date !== '') {
            $sql .= ' WHERE e.event_date=:date';
            $params['date'] = $date;
        } elseif (($_GET['upcoming'] ?? '') === '1') {
            $sql .= ' WHERE e.event_date >= CURRENT_DATE';
        }
        $direction = (($_GET['upcoming'] ?? '') === '1') ? 'ASC' : 'DESC';
        $sql .= " GROUP BY e.id,u.name ORDER BY e.event_date $direction,e.created_at DESC";
        $statement = $db->prepare($sql);
        $statement->execute($params);
        jsonResponse(['ok' => true, 'events' => $statement->fetchAll()]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['ok' => false, 'message' => 'Método não permitido.'], 405);
    if (!in_array($user['role'], ['administrador', 'supervisor'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Somente Administrador ou Supervisor pode criar eventos.'], 403);
    }
    $body = jsonBody();
    $event = is_array($body['event'] ?? null) ? $body['event'] : [];
    $originalEventKey = trim((string) ($body['originalEventKey'] ?? ''));
    $types = ['Reunião de encarregados e instrutores', 'Ensaio Regional', 'Exames musicais'];
    if (empty($event['name']) || empty($event['date']) || !in_array($event['type'] ?? '', $types, true)) {
        jsonResponse(['ok' => false, 'message' => 'Preencha nome, tipo e data do evento.'], 400);
    }
    $key = eventKeyForEvents($event);
    if ($originalEventKey !== '') {
        $db->beginTransaction();
        $conflict = $db->prepare('SELECT 1 FROM events WHERE event_key=:key AND event_key<>:original');
        $conflict->execute(['key' => $key, 'original' => $originalEventKey]);
        if ($conflict->fetchColumn()) {
            $db->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Já existe outro evento com esses mesmos dados.'], 409);
        }
        $statement = $db->prepare(
            'UPDATE events SET event_key=:key,name=:name,event_type=:type,event_date=:date,location=:local,
               regional_leader=:leader,elder=:elder,region=:region,updated_at=NOW()
             WHERE event_key=:original AND event_date >= CURRENT_DATE AND CAST(:new_date_check AS date) >= CURRENT_DATE
             RETURNING id'
        );
        $statement->execute([
            'key'=>$key, 'name'=>trim((string)$event['name']), 'type'=>$event['type'], 'date'=>$event['date'],
            'local'=>trim((string)($event['local'] ?? '')), 'leader'=>trim((string)($event['regionalLeader'] ?? '')),
            'elder'=>trim((string)($event['elder'] ?? '')), 'region'=>trim((string)($event['region'] ?? '')),
            'original'=>$originalEventKey, 'new_date_check'=>$event['date'],
        ]);
        $eventId = $statement->fetchColumn();
        if ($eventId === false) {
            $db->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Somente eventos que ainda não aconteceram podem ser editados.'], 409);
        }
        $assignment = $db->prepare('UPDATE group_assignments SET event_key=:key,updated_at=NOW() WHERE event_key=:original');
        $assignment->execute(['key' => $key, 'original' => $originalEventKey]);
        $db->commit();
        jsonResponse(['ok'=>true,'eventKey'=>$key,'id'=>(int)$eventId,'updated'=>true]);
    }
    $statement = $db->prepare(
        'INSERT INTO events (event_key,name,event_type,event_date,location,regional_leader,elder,region,created_by)
         VALUES (:key,:name,:type,:date,:local,:leader,:elder,:region,:user_id)
         ON CONFLICT (event_key) DO UPDATE SET name=EXCLUDED.name,location=EXCLUDED.location,
           regional_leader=EXCLUDED.regional_leader,elder=EXCLUDED.elder,region=EXCLUDED.region,updated_at=NOW()
         RETURNING id'
    );
    $statement->execute([
        'key'=>$key, 'name'=>trim((string)$event['name']), 'type'=>$event['type'], 'date'=>$event['date'],
        'local'=>trim((string)($event['local'] ?? '')), 'leader'=>trim((string)($event['regionalLeader'] ?? '')),
        'elder'=>trim((string)($event['elder'] ?? '')), 'region'=>trim((string)($event['region'] ?? '')),
        'user_id'=>$user['id'],
    ]);
    jsonResponse(['ok'=>true,'eventKey'=>$key,'id'=>(int)$statement->fetchColumn()]);
} catch (Throwable $error) {
    apiFailure($error);
}

function eventKeyForEvents(array $event): string
{
    return hash('sha256', implode('|', array_map(static fn($v): string => strtolower(trim((string)$v)), [
        $event['date'] ?? '', $event['type'] ?? '', $event['name'] ?? '', $event['local'] ?? '',
    ])));
}
