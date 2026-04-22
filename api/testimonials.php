<?php
/**
 * API de Depoimentos
 */

function handleTestimonials($method, $id, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($method) {
        case 'GET':
            if ($id) {
                getTestimonial($db, $id);
            } else {
                getTestimonials($db, $currentUser);
            }
            break;
        case 'POST':
            createTestimonial($db);
            break;
        case 'PUT':
            if (!$id) errorResponse('ID é obrigatório', 400);
            updateTestimonial($db, $id);
            break;
        case 'DELETE':
            if (!$id) errorResponse('ID é obrigatório', 400);
            deleteTestimonial($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function getTestimonials($db, $currentUser) {
    $where = !$currentUser ? "WHERE t.is_active = 1" : "";

    $stmt = $db->query(
        "SELECT t.*, p.title as project_title, p.slug as project_slug 
         FROM testimonials t 
         LEFT JOIN projects p ON t.project_id = p.id 
         $where 
         ORDER BY t.position ASC"
    );
    successResponse($stmt->fetchAll());
}

function getTestimonial($db, $id) {
    $stmt = $db->prepare("SELECT * FROM testimonials WHERE id = ?");
    $stmt->execute([$id]);
    $item = $stmt->fetch();
    if (!$item) errorResponse('Depoimento não encontrado', 404);
    successResponse($item);
}

function createTestimonial($db) {
    $data = getRequestBody();
    validateRequired($data, ['client_name', 'content']);

    $maxPos = $db->query("SELECT MAX(position) as m FROM testimonials")->fetch()['m'] ?? 0;

    $stmt = $db->prepare(
        "INSERT INTO testimonials (client_name, content, video_url, rating, project_id, is_active, position) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        sanitizeString($data['client_name']),
        sanitizeString($data['content']),
        sanitizeString($data['video_url'] ?? ''),
        (int)($data['rating'] ?? 5),
        $data['project_id'] ?? null,
        (int)($data['is_active'] ?? 1),
        $maxPos + 1
    ]);

    successResponse(['id' => $db->lastInsertId()], 'Depoimento criado', 201);
}

function updateTestimonial($db, $id) {
    $data = getRequestBody();
    $fields = [];
    $values = [];

    foreach (['client_name', 'content', 'video_url'] as $f) {
        if (isset($data[$f])) {
            $fields[] = "$f = ?";
            $values[] = sanitizeString($data[$f]);
        }
    }
    if (isset($data['rating'])) { $fields[] = 'rating = ?'; $values[] = (int)$data['rating']; }
    if (isset($data['project_id'])) { $fields[] = 'project_id = ?'; $values[] = $data['project_id'] ?: null; }
    if (isset($data['is_active'])) { $fields[] = 'is_active = ?'; $values[] = (int)$data['is_active']; }
    if (isset($data['position'])) { $fields[] = 'position = ?'; $values[] = (int)$data['position']; }

    if (empty($fields)) errorResponse('Nenhum campo para atualizar', 400);
    $values[] = $id;

    $stmt = $db->prepare("UPDATE testimonials SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($values);

    successResponse(null, 'Depoimento atualizado');
}

function deleteTestimonial($db, $id) {
    $stmt = $db->prepare("DELETE FROM testimonials WHERE id = ?");
    $stmt->execute([$id]);
    successResponse(null, 'Depoimento excluído');
}
