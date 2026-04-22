<?php
/**
 * Helper de Respostas da API
 */

function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function successResponse($data = null, $message = 'Sucesso', $statusCode = 200) {
    jsonResponse([
        'success' => true,
        'message' => $message,
        'data' => $data
    ], $statusCode);
}

function errorResponse($message = 'Erro interno', $statusCode = 400, $errors = null) {
    $response = [
        'success' => false,
        'message' => $message
    ];
    if ($errors) {
        $response['errors'] = $errors;
    }
    jsonResponse($response, $statusCode);
}

function paginatedResponse($data, $total, $page, $perPage) {
    jsonResponse([
        'success' => true,
        'data' => $data,
        'pagination' => [
            'total' => (int)$total,
            'page' => (int)$page,
            'per_page' => (int)$perPage,
            'total_pages' => ceil($total / $perPage)
        ]
    ]);
}

function getRequestBody() {
    $body = file_get_contents('php://input');
    return json_decode($body, true) ?? [];
}

function getQueryParam($key, $default = null) {
    return $_GET[$key] ?? $default;
}

function validateRequired($data, $fields) {
    $missing = [];
    foreach ($fields as $field) {
        if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
            $missing[] = $field;
        }
    }
    if (!empty($missing)) {
        errorResponse('Campos obrigatórios faltando: ' . implode(', ', $missing), 422);
    }
}

function sanitizeString($str) {
    return htmlspecialchars(strip_tags(trim($str)), ENT_QUOTES, 'UTF-8');
}

function generateSlug($text) {
    $text = mb_strtolower($text, 'UTF-8');
    // Tratar acentos
    $text = preg_replace('/[áàãâä]/u', 'a', $text);
    $text = preg_replace('/[éèêë]/u', 'e', $text);
    $text = preg_replace('/[íìîï]/u', 'i', $text);
    $text = preg_replace('/[óòõôö]/u', 'o', $text);
    $text = preg_replace('/[úùûü]/u', 'u', $text);
    $text = preg_replace('/[ç]/u', 'c', $text);
    $text = preg_replace('/[ñ]/u', 'n', $text);
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/[\s-]+/', '-', $text);
    return trim($text, '-');
}
