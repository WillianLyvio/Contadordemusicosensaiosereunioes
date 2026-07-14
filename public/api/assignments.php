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
    if (($body['action'] ?? '') === 'reserve') {
        $user = currentUser();
        $deviceId = trim((string)($body['deviceId'] ?? ''));
        if ($groups === [] || $deviceId === '') jsonResponse(['ok'=>false,'message'=>'Selecione ao menos um grupo.'], 400);
        $placeholders = implode(',', array_fill(0, count($groups), '?'));
        $check = $db->prepare("SELECT ga.group_id AS \"groupId\",u.name AS \"userName\" FROM group_assignments ga JOIN users u ON u.id=ga.user_id WHERE ga.event_key=? AND ga.group_id IN ($placeholders) AND NOT (ga.user_id=? AND ga.device_id=?)");
        $check->execute([$key,...$groups,$user['id'],$deviceId]);
        $conflicts = $check->fetchAll();
        if ($conflicts !== []) jsonResponse(['ok'=>false,'message'=>'Um ou mais grupos já estão em contagem.','conflicts'=>$conflicts],409);
        $db->prepare('DELETE FROM group_assignments WHERE user_id=? AND device_id=?')->execute([$user['id'],$deviceId]);
        $insert = $db->prepare("INSERT INTO group_assignments(event_key,group_id,user_id,device_id,device_name,expires_at) VALUES(?,?,?,?,?,NOW()+INTERVAL '5 minutes') ON CONFLICT(event_key,group_id) DO NOTHING");
        foreach ($groups as $group) $insert->execute([$key,$group,$user['id'],$deviceId,trim((string)($body['deviceName'] ?? ''))]);
        jsonResponse(['ok'=>true]);
    }
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
