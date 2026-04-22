<?php
/**
 * API do Fallback Pool — assets genéricos que preenchem slots vazios
 */

function handleFallbackPool($method, $id, $action, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($method) {
        case 'GET':
            if ($id) {
                getFallbackItem($db, $id);
            } else {
                getFallbackList($db);
            }
            break;
        case 'POST':
            createFallback($db);
            break;
        case 'PUT':
            if ($id === 'reorder') {
                reorderFallbacks($db);
            } elseif ($id) {
                updateFallback($db, $id);
            }
            break;
        case 'DELETE':
            if (!$id) errorResponse('ID é obrigatório', 400);
            deleteFallback($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function getFallbackList($db) {
    $slotType = getQueryParam('slot_type');

    $where = [];
    $params = [];

    if ($slotType) {
        $where[] = 'fp.slot_type = ?';
        $params[] = $slotType;
    }

    $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare(
        "SELECT fp.*, m.file_path, m.file_type, m.mime_type, m.thumbnail_path, m.original_name,
                m.provider, m.provider_id, m.width, m.height, m.tags
         FROM fallback_pool fp
         JOIN media m ON fp.media_id = m.id
         $whereClause
         ORDER BY fp.slot_type ASC, fp.priority ASC"
    );
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    foreach ($items as &$item) {
        if ($item['file_path']) $item['url'] = UPLOAD_URL . $item['file_path'];
        if ($item['thumbnail_path']) $item['thumbnail_url'] = UPLOAD_URL . $item['thumbnail_path'];
        if ($item['tags']) $item['tags'] = json_decode($item['tags'], true);
    }

    successResponse($items);
}

function getFallbackItem($db, $id) {
    $stmt = $db->prepare(
        "SELECT fp.*, m.file_path, m.file_type, m.thumbnail_path, m.original_name
         FROM fallback_pool fp
         JOIN media m ON fp.media_id = m.id
         WHERE fp.id = ?"
    );
    $stmt->execute([$id]);
    $item = $stmt->fetch();

    if (!$item) errorResponse('Fallback não encontrado', 404);

    if ($item['file_path']) $item['url'] = UPLOAD_URL . $item['file_path'];
    if ($item['thumbnail_path']) $item['thumbnail_url'] = UPLOAD_URL . $item['thumbnail_path'];

    successResponse($item);
}

function createFallback($db) {
    $data = getRequestBody();
    validateRequired($data, ['media_id', 'slot_type']);

    $stmtMax = $db->prepare("SELECT MAX(priority) as m FROM fallback_pool WHERE slot_type = ?");
    $stmtMax->execute([sanitizeString($data['slot_type'])]);
    $maxPriority = $stmtMax->fetch()['m'] ?? 0;

    $stmt = $db->prepare(
        "INSERT INTO fallback_pool (media_id, slot_type, priority, is_active)
         VALUES (?, ?, ?, ?)"
    );
    $stmt->execute([
        (int)$data['media_id'],
        sanitizeString($data['slot_type']),
        $maxPriority + 1,
        (int)($data['is_active'] ?? 1)
    ]);

    // Also mark the media as fallback
    $stmt = $db->prepare("UPDATE media SET is_fallback = 1 WHERE id = ?");
    $stmt->execute([(int)$data['media_id']]);

    successResponse(['id' => $db->lastInsertId()], 'Fallback adicionado', 201);
}

function updateFallback($db, $id) {
    $data = getRequestBody();
    $fields = [];
    $values = [];

    if (isset($data['slot_type'])) {
        $fields[] = 'slot_type = ?';
        $values[] = sanitizeString($data['slot_type']);
    }
    if (isset($data['priority'])) {
        $fields[] = 'priority = ?';
        $values[] = (int)$data['priority'];
    }
    if (isset($data['is_active'])) {
        $fields[] = 'is_active = ?';
        $values[] = (int)$data['is_active'];
    }
    if (isset($data['media_id'])) {
        $fields[] = 'media_id = ?';
        $values[] = (int)$data['media_id'];
    }

    if (empty($fields)) errorResponse('Nenhum campo para atualizar', 400);

    $values[] = $id;
    $stmt = $db->prepare("UPDATE fallback_pool SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($values);

    successResponse(null, 'Fallback atualizado');
}

function reorderFallbacks($db) {
    $data = getRequestBody();
    if (!isset($data['order'])) errorResponse('Ordem é obrigatória', 400);

    $stmt = $db->prepare("UPDATE fallback_pool SET priority = ? WHERE id = ?");
    foreach ($data['order'] as $i => $fbId) {
        $stmt->execute([$i, (int)$fbId]);
    }

    successResponse(null, 'Ordem atualizada');
}

function deleteFallback($db, $id) {
    // Get media_id before deleting
    $stmt = $db->prepare("SELECT media_id FROM fallback_pool WHERE id = ?");
    $stmt->execute([$id]);
    $item = $stmt->fetch();

    $stmt = $db->prepare("DELETE FROM fallback_pool WHERE id = ?");
    $stmt->execute([$id]);

    // Check if media is still used in other fallbacks
    if ($item) {
        $stmt = $db->prepare("SELECT COUNT(*) as cnt FROM fallback_pool WHERE media_id = ?");
        $stmt->execute([$item['media_id']]);
        if ($stmt->fetch()['cnt'] == 0) {
            // No longer in fallback pool, unmark
            $stmt = $db->prepare("UPDATE media SET is_fallback = 0 WHERE id = ?");
            $stmt->execute([$item['media_id']]);
        }
    }

    successResponse(null, 'Fallback removido');
}
