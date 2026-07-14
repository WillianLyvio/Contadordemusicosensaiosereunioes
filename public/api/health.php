<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'database.php';
    database()->query('SELECT 1')->fetchColumn();
    echo json_encode(['ok' => true, 'database' => 'connected']);
} catch (Throwable $error) {
    http_response_code(503);
    echo json_encode([
        'ok' => false,
        'database' => 'unavailable',
        'message' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
