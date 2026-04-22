<?php
/**
 * API de Project Slots — posições nomeadas do layout
 */

function handleProjectSlots($method, $id, $action, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($method) {
        case 'GET':
            if ($id) {
                getSlotsByProject($db, $id);
            }
            break;
        case 'POST':
            if (!$id) errorResponse('project_id é obrigatório', 400);
            saveProjectSlots($db, $id);
            break;
        case 'PUT':
            if (!$id) errorResponse('slot_id é obrigatório', 400);
            updateSlot($db, $id);
            break;
        case 'DELETE':
            if (!$id) errorResponse('slot_id é obrigatório', 400);
            deleteSlot($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

/**
 * GET /api/project-slots/{project_id}
 * Returns all slots for a project, with fallback resolution
 */
function getSlotsByProject($db, $projectId) {
    $withFallback = getQueryParam('fallback', '1') === '1';

    // Get all explicit slots
    $stmt = $db->prepare(
        "SELECT ps.*, m.file_path, m.file_type, m.mime_type, m.thumbnail_path, m.original_name,
                m.provider, m.provider_id, m.width, m.height
         FROM project_slots ps
         LEFT JOIN media m ON ps.media_id = m.id
         WHERE ps.project_id = ?
         ORDER BY ps.slot_key ASC, ps.position ASC"
    );
    $stmt->execute([$projectId]);
    $slots = $stmt->fetchAll();

    // Build map
    $slotMap = [];
    foreach ($slots as &$slot) {
        if ($slot['file_path']) {
            $slot['url'] = UPLOAD_URL . $slot['file_path'];
        }
        if ($slot['thumbnail_path']) {
            $slot['thumbnail_url'] = UPLOAD_URL . $slot['thumbnail_path'];
        }
        $slotMap[$slot['slot_key']][] = $slot;
    }

    // If fallback is requested, fill empty slots from fallback_pool
    if ($withFallback) {
        $definedSlots = [
            'hero_video' => 'video',
            'hero_couple_image' => 'image',
            'teaser_video' => 'video',
            'gallery_1' => 'image',
            'gallery_2' => 'image',
            'gallery_3' => 'image',
            'gallery_4' => 'image',
            'gallery_5' => 'image',
            'gallery_6' => 'image',
            'gallery_7' => 'image',
            'gallery_8' => 'image',
            'closing_landscape' => 'image',
            'featured_publication_logo' => 'image',
        ];

        foreach ($definedSlots as $key => $type) {
            if (empty($slotMap[$key])) {
                $fallback = getFallbackForSlot($db, $key, $type);
                if ($fallback) {
                    $fallback['is_fallback_fill'] = true;
                    $fallback['slot_key'] = $key;
                    $slotMap[$key][] = $fallback;
                }
            }
        }
    }

    successResponse($slotMap);
}

/**
 * Fallback resolution: find a matching asset from the pool
 */
function getFallbackForSlot($db, $slotKey, $slotType) {
    // First try exact slot_type match
    $stmt = $db->prepare(
        "SELECT fp.id as fallback_id, fp.slot_type, fp.priority,
                m.id as media_id, m.file_path, m.file_type, m.mime_type, m.thumbnail_path,
                m.provider, m.provider_id, m.width, m.height, m.original_name
         FROM fallback_pool fp
         JOIN media m ON fp.media_id = m.id
         WHERE fp.slot_type = ? AND fp.is_active = 1
         ORDER BY fp.priority ASC
         LIMIT 1"
    );
    $stmt->execute([$slotKey]);
    $result = $stmt->fetch();

    if ($result) {
        if ($result['file_path']) $result['url'] = UPLOAD_URL . $result['file_path'];
        if ($result['thumbnail_path']) $result['thumbnail_url'] = UPLOAD_URL . $result['thumbnail_path'];
        return $result;
    }

    // Fallback to generic type match (e.g. gallery_image → any image fallback)
    $genericType = strpos($slotKey, 'gallery_') === 0 ? 'gallery_image' : $slotKey;
    if ($genericType !== $slotKey) {
        $stmt->execute([$genericType]);
        $result = $stmt->fetch();

        if ($result) {
            if ($result['file_path']) $result['url'] = UPLOAD_URL . $result['file_path'];
            if ($result['thumbnail_path']) $result['thumbnail_url'] = UPLOAD_URL . $result['thumbnail_path'];
            return $result;
        }
    }

    return null;
}

/**
 * POST /api/project-slots/{project_id}
 * Bulk save slots for a project (replaces all slots for given keys)
 */
function saveProjectSlots($db, $projectId) {
    $data = getRequestBody();

    if (!isset($data['slots']) || !is_array($data['slots'])) {
        errorResponse('Campo "slots" é obrigatório', 400);
    }

    $db->beginTransaction();
    try {
        foreach ($data['slots'] as $slot) {
            $slotKey = sanitizeString($slot['slot_key'] ?? '');
            if (!$slotKey) continue;

            // Delete existing slot for this key+position
            $position = (int)($slot['position'] ?? 0);
            $stmt = $db->prepare(
                "DELETE FROM project_slots WHERE project_id = ? AND slot_key = ? AND position = ?"
            );
            $stmt->execute([$projectId, $slotKey, $position]);

            // Insert new if media_id is provided
            $mediaId = $slot['media_id'] ?? null;
            if ($mediaId) {
                $stmt = $db->prepare(
                    "INSERT INTO project_slots (project_id, slot_key, media_id, position, custom_caption)
                     VALUES (?, ?, ?, ?, ?)"
                );
                $stmt->execute([
                    $projectId,
                    $slotKey,
                    (int)$mediaId,
                    $position,
                    sanitizeString($slot['custom_caption'] ?? '')
                ]);
            }
        }
        $db->commit();
        successResponse(null, 'Slots salvos com sucesso');
    } catch (Exception $e) {
        $db->rollBack();
        errorResponse('Erro ao salvar slots: ' . $e->getMessage(), 500);
    }
}

/**
 * PUT /api/project-slots/{slot_id}
 */
function updateSlot($db, $slotId) {
    $data = getRequestBody();
    $fields = [];
    $values = [];

    if (isset($data['media_id'])) {
        $fields[] = 'media_id = ?';
        $values[] = $data['media_id'] ?: null;
    }
    if (isset($data['custom_caption'])) {
        $fields[] = 'custom_caption = ?';
        $values[] = sanitizeString($data['custom_caption']);
    }
    if (isset($data['position'])) {
        $fields[] = 'position = ?';
        $values[] = (int)$data['position'];
    }

    if (empty($fields)) errorResponse('Nenhum campo para atualizar', 400);

    $values[] = $slotId;
    $stmt = $db->prepare("UPDATE project_slots SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($values);

    successResponse(null, 'Slot atualizado');
}

/**
 * DELETE /api/project-slots/{slot_id}
 */
function deleteSlot($db, $slotId) {
    $stmt = $db->prepare("DELETE FROM project_slots WHERE id = ?");
    $stmt->execute([$slotId]);
    successResponse(null, 'Slot removido');
}
