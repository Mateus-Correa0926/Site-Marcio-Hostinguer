<?php
/**
 * API de Mídia (imagens e vídeos)
 */

function handleMedia($method, $id, $action, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($method) {
        case 'GET':
            if ($id && $action === 'download') {
                downloadMedia($db, $id);
            } elseif ($id) {
                getMediaItem($db, $id);
            } else {
                getMediaList($db);
            }
            break;
        case 'POST':
            if ($action === 'upload' || !$id) {
                uploadMedia($db);
            }
            break;
        case 'PUT':
            if (!$id) errorResponse('ID da mídia é obrigatório', 400);
            updateMedia($db, $id);
            break;
        case 'DELETE':
            if (!$id) errorResponse('ID da mídia é obrigatório', 400);
            deleteMedia($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function getMediaList($db) {
    $type = getQueryParam('type');
    $folder = getQueryParam('folder');
    $search = getQueryParam('search');
    $page = (int)(getQueryParam('page', 1));
    $perPage = (int)(getQueryParam('per_page', 30));
    $offset = ($page - 1) * $perPage;

    $where = [];
    $params = [];

    if ($type) {
        $where[] = "file_type = ?";
        $params[] = $type;
    }
    if ($folder) {
        $where[] = "folder = ?";
        $params[] = $folder;
    }
    if ($search) {
        $where[] = "(original_name LIKE ? OR alt_text LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

    // Contar total
    $countStmt = $db->prepare("SELECT COUNT(*) as total FROM media $whereClause");
    $countStmt->execute($params);
    $total = $countStmt->fetch()['total'];

    // Buscar itens
    $sql = "SELECT * FROM media $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?";
    $params[] = $perPage;
    $params[] = $offset;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    // Adicionar URLs completas
    foreach ($items as &$item) {
        $item['url'] = UPLOAD_URL . $item['file_path'];
        if ($item['thumbnail_path']) {
            $item['thumbnail_url'] = UPLOAD_URL . $item['thumbnail_path'];
        }
    }

    paginatedResponse($items, $total, $page, $perPage);
}

function getMediaItem($db, $id) {
    $stmt = $db->prepare("SELECT * FROM media WHERE id = ?");
    $stmt->execute([$id]);
    $item = $stmt->fetch();

    if (!$item) errorResponse('Mídia não encontrada', 404);

    $item['url'] = UPLOAD_URL . $item['file_path'];
    if ($item['thumbnail_path']) {
        $item['thumbnail_url'] = UPLOAD_URL . $item['thumbnail_path'];
    }

    successResponse($item);
}

function uploadMedia($db) {
    if (empty($_FILES['file']) && empty($_FILES['files'])) {
        errorResponse('Nenhum arquivo enviado', 400);
    }

    $folder = sanitizeString($_POST['folder'] ?? 'general');
    $altText = sanitizeString($_POST['alt_text'] ?? '');

    $results = [];

    if (!empty($_FILES['files'])) {
        // Upload múltiplo
        $uploadResults = FileUploader::uploadMultiple($_FILES['files'], $folder);
    } else {
        // Upload único
        $uploadResults = [FileUploader::upload($_FILES['file'], $folder)];
    }

    foreach ($uploadResults as $upload) {
        if (isset($upload['error'])) {
            $results[] = ['error' => $upload['error']];
            continue;
        }

        $stmt = $db->prepare(
            "INSERT INTO media (filename, original_name, file_path, file_type, mime_type, file_size, width, height, thumbnail_path, alt_text, folder) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $upload['filename'],
            $upload['original_name'],
            $upload['file_path'],
            $upload['file_type'],
            $upload['mime_type'],
            $upload['file_size'],
            $upload['width'] ?? null,
            $upload['height'] ?? null,
            $upload['thumbnail_path'] ?? null,
            $altText,
            $folder
        ]);

        $mediaId = $db->lastInsertId();

        $results[] = [
            'id' => $mediaId,
            'filename' => $upload['filename'],
            'original_name' => $upload['original_name'],
            'file_type' => $upload['file_type'],
            'url' => UPLOAD_URL . $upload['file_path'],
            'thumbnail_url' => isset($upload['thumbnail_path']) ? UPLOAD_URL . $upload['thumbnail_path'] : null
        ];
    }

    successResponse($results, 'Upload realizado com sucesso', 201);
}

function updateMedia($db, $id) {
    $data = getRequestBody();

    $fields = [];
    $values = [];

    if (isset($data['alt_text'])) {
        $fields[] = 'alt_text = ?';
        $values[] = sanitizeString($data['alt_text']);
    }
    if (isset($data['folder'])) {
        $fields[] = 'folder = ?';
        $values[] = sanitizeString($data['folder']);
    }
    if (isset($data['tags'])) {
        $fields[] = 'tags = ?';
        $values[] = is_array($data['tags']) ? json_encode($data['tags']) : $data['tags'];
    }
    if (isset($data['is_fallback'])) {
        $fields[] = 'is_fallback = ?';
        $values[] = (int)$data['is_fallback'];
    }
    if (isset($data['provider'])) {
        $fields[] = 'provider = ?';
        $values[] = sanitizeString($data['provider']);
    }
    if (isset($data['provider_id'])) {
        $fields[] = 'provider_id = ?';
        $values[] = sanitizeString($data['provider_id']);
    }

    if (empty($fields)) {
        errorResponse('Nenhum campo para atualizar', 400);
    }

    $values[] = $id;
    $sql = "UPDATE media SET " . implode(', ', $fields) . " WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute($values);

    successResponse(null, 'Mídia atualizada com sucesso');
}

function deleteMedia($db, $id) {
    $stmt = $db->prepare("SELECT file_path, thumbnail_path FROM media WHERE id = ?");
    $stmt->execute([$id]);
    $media = $stmt->fetch();

    if (!$media) errorResponse('Mídia não encontrada', 404);

    // Remover arquivos do disco
    FileUploader::delete($media['file_path']);

    // Remover do banco
    $stmt = $db->prepare("DELETE FROM media WHERE id = ?");
    $stmt->execute([$id]);

    successResponse(null, 'Mídia excluída com sucesso');
}

function downloadMedia($db, $id) {
    $stmt = $db->prepare("SELECT * FROM media WHERE id = ?");
    $stmt->execute([$id]);
    $media = $stmt->fetch();

    if (!$media) errorResponse('Mídia não encontrada', 404);

    $filePath = UPLOAD_DIR . $media['file_path'];
    if (!file_exists($filePath)) errorResponse('Arquivo não encontrado no disco', 404);

    header('Content-Type: ' . $media['mime_type']);
    header('Content-Disposition: attachment; filename="' . $media['original_name'] . '"');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit();
}
