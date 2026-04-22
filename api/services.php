<?php
/**
 * API de Serviços
 */

function handleServices($method, $id, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($method) {
        case 'GET':
            if ($id) {
                getService($db, $id);
            } else {
                getServicesList($db, $currentUser);
            }
            break;
        case 'POST':
            createService($db);
            break;
        case 'PUT':
            if (!$id) errorResponse('ID do serviço é obrigatório', 400);
            updateService($db, $id);
            break;
        case 'DELETE':
            if (!$id) errorResponse('ID do serviço é obrigatório', 400);
            deleteService($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function getServicesList($db, $currentUser) {
    $where = !$currentUser ? "WHERE s.is_active = 1" : "";

    $sql = "SELECT s.*, m.file_path as image_path
            FROM services s
            LEFT JOIN media m ON s.image_id = m.id
            $where
            ORDER BY s.position ASC";

    $stmt = $db->query($sql);
    $services = $stmt->fetchAll();

    foreach ($services as &$service) {
        if ($service['image_path']) {
            $service['image_url'] = UPLOAD_URL . $service['image_path'];
        }
        $service['features'] = json_decode($service['features'], true);
    }

    successResponse($services);
}

function getService($db, $id) {
    $stmt = $db->prepare(
        "SELECT s.*, m.file_path as image_path FROM services s LEFT JOIN media m ON s.image_id = m.id WHERE s.id = ?"
    );
    $stmt->execute([$id]);
    $service = $stmt->fetch();

    if (!$service) errorResponse('Serviço não encontrado', 404);

    if ($service['image_path']) {
        $service['image_url'] = UPLOAD_URL . $service['image_path'];
    }
    $service['features'] = json_decode($service['features'], true);

    successResponse($service);
}

function createService($db) {
    $data = getRequestBody();
    validateRequired($data, ['title']);

    $maxPos = $db->query("SELECT MAX(position) as m FROM services")->fetch()['m'] ?? 0;

    $stmt = $db->prepare(
        "INSERT INTO services (title, description, short_description, icon, image_id, price_from, price_label, features, position, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        sanitizeString($data['title']),
        $data['description'] ?? '',
        sanitizeString($data['short_description'] ?? ''),
        sanitizeString($data['icon'] ?? ''),
        $data['image_id'] ?? null,
        $data['price_from'] ?? null,
        sanitizeString($data['price_label'] ?? ''),
        json_encode($data['features'] ?? []),
        $maxPos + 1,
        (int)($data['is_active'] ?? 1)
    ]);

    successResponse(['id' => $db->lastInsertId()], 'Serviço criado com sucesso', 201);
}

function updateService($db, $id) {
    $data = getRequestBody();
    $fields = [];
    $values = [];

    foreach (['title', 'short_description', 'icon', 'price_label'] as $f) {
        if (isset($data[$f])) {
            $fields[] = "$f = ?";
            $values[] = sanitizeString($data[$f]);
        }
    }
    if (isset($data['description'])) {
        $fields[] = 'description = ?';
        $values[] = $data['description'];
    }
    if (isset($data['image_id'])) {
        $fields[] = 'image_id = ?';
        $values[] = $data['image_id'] ?: null;
    }
    if (isset($data['price_from'])) {
        $fields[] = 'price_from = ?';
        $values[] = $data['price_from'];
    }
    if (isset($data['features'])) {
        $fields[] = 'features = ?';
        $values[] = json_encode($data['features']);
    }
    if (isset($data['position'])) {
        $fields[] = 'position = ?';
        $values[] = (int)$data['position'];
    }
    if (isset($data['is_active'])) {
        $fields[] = 'is_active = ?';
        $values[] = (int)$data['is_active'];
    }

    if (empty($fields)) errorResponse('Nenhum campo para atualizar', 400);

    $values[] = $id;
    $stmt = $db->prepare("UPDATE services SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($values);

    successResponse(null, 'Serviço atualizado com sucesso');
}

function deleteService($db, $id) {
    $stmt = $db->prepare("DELETE FROM services WHERE id = ?");
    $stmt->execute([$id]);
    successResponse(null, 'Serviço excluído com sucesso');
}
