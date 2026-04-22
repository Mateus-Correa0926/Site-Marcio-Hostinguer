<?php
/**
 * API de Configurações do Site
 */

function handleSettings($method, $id, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($method) {
        case 'GET':
            if ($id) {
                getSetting($db, $id);
            } else {
                getAllSettings($db);
            }
            break;
        case 'PUT':
            updateSettings($db);
            break;
        case 'POST':
            if ($id === 'bulk') {
                bulkUpdateSettings($db);
            } else {
                createSetting($db);
            }
            break;
        case 'DELETE':
            if (!$id) errorResponse('Chave é obrigatória', 400);
            deleteSetting($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function getAllSettings($db) {
    $stmt = $db->query("SELECT setting_key, setting_value, setting_type FROM site_settings ORDER BY setting_key");
    $rows = $stmt->fetchAll();

    $settings = [];
    foreach ($rows as $row) {
        $settings[$row['setting_key']] = [
            'value' => $row['setting_value'],
            'type' => $row['setting_type']
        ];
    }

    successResponse($settings);
}

function getSetting($db, $key) {
    $stmt = $db->prepare("SELECT setting_key, setting_value, setting_type FROM site_settings WHERE setting_key = ?");
    $stmt->execute([sanitizeString($key)]);
    $setting = $stmt->fetch();

    if (!$setting) errorResponse('Configuração não encontrada', 404);

    successResponse($setting);
}

function updateSettings($db) {
    $data = getRequestBody();

    if (empty($data)) errorResponse('Dados são obrigatórios', 400);

    $stmt = $db->prepare(
        "INSERT INTO site_settings (setting_key, setting_value, setting_type) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_type = VALUES(setting_type)"
    );

    foreach ($data as $key => $item) {
        if (is_array($item) && isset($item['value'])) {
            $stmt->execute([
                sanitizeString($key),
                is_array($item['value']) ? json_encode($item['value']) : $item['value'],
                $item['type'] ?? 'text'
            ]);
        } else {
            $stmt->execute([
                sanitizeString($key),
                is_array($item) ? json_encode($item) : $item,
                'text'
            ]);
        }
    }

    successResponse(null, 'Configurações atualizadas com sucesso');
}

function bulkUpdateSettings($db) {
    $data = getRequestBody();
    if (!isset($data['settings'])) errorResponse('Configurações são obrigatórias', 400);

    $stmt = $db->prepare(
        "UPDATE site_settings SET setting_value = ? WHERE setting_key = ?"
    );

    foreach ($data['settings'] as $key => $value) {
        $stmt->execute([
            is_array($value) ? json_encode($value) : $value,
            sanitizeString($key)
        ]);
    }

    successResponse(null, 'Configurações atualizadas');
}

function createSetting($db) {
    $data = getRequestBody();
    validateRequired($data, ['setting_key', 'setting_value']);

    $stmt = $db->prepare(
        "INSERT INTO site_settings (setting_key, setting_value, setting_type) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
    );
    $stmt->execute([
        sanitizeString($data['setting_key']),
        is_array($data['setting_value']) ? json_encode($data['setting_value']) : $data['setting_value'],
        $data['setting_type'] ?? 'text'
    ]);

    successResponse(null, 'Configuração salva');
}

function deleteSetting($db, $key) {
    $stmt = $db->prepare("DELETE FROM site_settings WHERE setting_key = ?");
    $stmt->execute([sanitizeString($key)]);
    successResponse(null, 'Configuração removida');
}
