<?php
/**
 * API de Projetos (Portfólio)
 */

function handleProjects($method, $id, $action, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($method) {
        case 'GET':
            if ($action === 'featured') {
                getFeaturedProjects($db);
            } elseif ($id) {
                getProject($db, $id, $currentUser);
            } else {
                getProjects($db, $currentUser);
            }
            break;
        case 'POST':
            createProject($db);
            break;
        case 'PUT':
            if (!$id) errorResponse('ID do projeto é obrigatório', 400);
            if ($action === 'reorder') {
                reorderProjects($db);
            } else {
                updateProject($db, $id);
            }
            break;
        case 'DELETE':
            if (!$id) errorResponse('ID do projeto é obrigatório', 400);
            deleteProject($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function getProjects($db, $currentUser) {
    $onlyPublished = !$currentUser;
    $page = (int)(getQueryParam('page', 1));
    $perPage = (int)(getQueryParam('per_page', 20));
    $offset = ($page - 1) * $perPage;

    $where = $onlyPublished ? "WHERE p.is_published = 1" : "";

    $countStmt = $db->query("SELECT COUNT(*) as total FROM projects p $where");
    $total = $countStmt->fetch()['total'];

    $sql = "SELECT p.*, m.file_path as thumbnail_path, m.file_type as thumb_type
            FROM projects p
            LEFT JOIN media m ON p.thumbnail_id = m.id
            $where
            ORDER BY p.position ASC, p.created_at DESC
            LIMIT ? OFFSET ?";

    $stmt = $db->prepare($sql);
    $stmt->execute([$perPage, $offset]);
    $projects = $stmt->fetchAll();

    foreach ($projects as &$project) {
        if ($project['thumbnail_path']) {
            $project['thumbnail_url'] = UPLOAD_URL . $project['thumbnail_path'];
        }
        $project['gallery'] = json_decode($project['gallery'], true);
    }

    paginatedResponse($projects, $total, $page, $perPage);
}

function getProject($db, $id, $currentUser) {
    $field = is_numeric($id) ? 'p.id' : 'p.slug';
    $sql = "SELECT p.*, m.file_path as thumbnail_path
            FROM projects p
            LEFT JOIN media m ON p.thumbnail_id = m.id
            WHERE $field = ?";

    if (!$currentUser) {
        $sql .= " AND p.is_published = 1";
    }

    $stmt = $db->prepare($sql);
    $stmt->execute([$id]);
    $project = $stmt->fetch();

    if (!$project) errorResponse('Projeto não encontrado', 404);

    if ($project['thumbnail_path']) {
        $project['thumbnail_url'] = UPLOAD_URL . $project['thumbnail_path'];
    }
    $project['gallery'] = json_decode($project['gallery'], true);

    // Buscar depoimentos do projeto
    $stmt = $db->prepare("SELECT * FROM testimonials WHERE project_id = ? AND is_active = 1 ORDER BY position ASC");
    $stmt->execute([$project['id']]);
    $project['testimonials'] = $stmt->fetchAll();

    // Buscar slots do projeto com fallback
    $stmt = $db->prepare(
        "SELECT ps.*, m.file_path, m.file_type, m.mime_type, m.thumbnail_path,
                m.provider, m.provider_id, m.width, m.height, m.original_name
         FROM project_slots ps
         LEFT JOIN media m ON ps.media_id = m.id
         WHERE ps.project_id = ?
         ORDER BY ps.slot_key ASC, ps.position ASC"
    );
    $stmt->execute([$project['id']]);
    $slots = $stmt->fetchAll();
    $project['slots'] = [];
    foreach ($slots as &$slot) {
        if ($slot['file_path']) $slot['url'] = UPLOAD_URL . $slot['file_path'];
        if ($slot['thumbnail_path']) $slot['thumbnail_url'] = UPLOAD_URL . $slot['thumbnail_path'];
        $project['slots'][$slot['slot_key']][] = $slot;
    }

    successResponse($project);
}

function getFeaturedProjects($db) {
    $limit = (int)(getQueryParam('limit', 6));

    $sql = "SELECT p.*, m.file_path as thumbnail_path
            FROM projects p
            LEFT JOIN media m ON p.thumbnail_id = m.id
            WHERE p.is_published = 1 AND p.is_featured = 1
            ORDER BY p.position ASC
            LIMIT ?";

    $stmt = $db->prepare($sql);
    $stmt->execute([$limit]);
    $projects = $stmt->fetchAll();

    foreach ($projects as &$project) {
        if ($project['thumbnail_path']) {
            $project['thumbnail_url'] = UPLOAD_URL . $project['thumbnail_path'];
        }
        $project['gallery'] = json_decode($project['gallery'], true);
    }

    successResponse($projects);
}

function createProject($db) {
    $data = getRequestBody();
    validateRequired($data, ['title']);

    $slug = generateSlug($data['title']);
    $stmt = $db->prepare("SELECT id FROM projects WHERE slug = ?");
    $stmt->execute([$slug]);
    if ($stmt->fetch()) {
        $slug .= '-' . time();
    }

    $stmt = $db->prepare(
        "INSERT INTO projects (title, slug, couple_names, description, location, section_title, about_title, about_text, featured_on, featured_logo_id, project_date, video_url, video_embed, thumbnail_id, gallery, is_featured, is_published, published_at, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    $maxPos = $db->query("SELECT MAX(position) as m FROM projects")->fetch()['m'] ?? 0;
    $isPublished = (int)($data['is_published'] ?? 0);

    $stmt->execute([
        sanitizeString($data['title']),
        $slug,
        sanitizeString($data['couple_names'] ?? ''),
        $data['description'] ?? '',
        sanitizeString($data['location'] ?? ''),
        sanitizeString($data['section_title'] ?? 'FEATURED FILMS'),
        sanitizeString($data['about_title'] ?? 'ABOUT THE WEDDING'),
        $data['about_text'] ?? '',
        sanitizeString($data['featured_on'] ?? ''),
        $data['featured_logo_id'] ?? null,
        $data['project_date'] ?? null,
        sanitizeString($data['video_url'] ?? ''),
        $data['video_embed'] ?? '',
        $data['thumbnail_id'] ?? null,
        json_encode($data['gallery'] ?? []),
        (int)($data['is_featured'] ?? 0),
        $isPublished,
        $isPublished ? date('Y-m-d H:i:s') : null,
        $maxPos + 1
    ]);

    successResponse(['id' => $db->lastInsertId(), 'slug' => $slug], 'Projeto criado com sucesso', 201);
}

function updateProject($db, $id) {
    $data = getRequestBody();

    $fields = [];
    $values = [];

    $stringFields = ['title', 'couple_names', 'description', 'location', 'video_url', 'video_embed', 'section_title', 'about_title', 'featured_on'];
    foreach ($stringFields as $f) {
        if (isset($data[$f])) {
            $fields[] = "$f = ?";
            $values[] = $f === 'description' || $f === 'video_embed' ? $data[$f] : sanitizeString($data[$f]);
        }
    }
    if (isset($data['about_text'])) {
        $fields[] = 'about_text = ?';
        $values[] = $data['about_text'];
    }
    if (isset($data['featured_logo_id'])) {
        $fields[] = 'featured_logo_id = ?';
        $values[] = $data['featured_logo_id'] ?: null;
    }

    if (isset($data['slug'])) {
        $fields[] = 'slug = ?';
        $values[] = generateSlug($data['slug']);
    }
    if (isset($data['project_date'])) {
        $fields[] = 'project_date = ?';
        $values[] = $data['project_date'];
    }
    if (isset($data['thumbnail_id'])) {
        $fields[] = 'thumbnail_id = ?';
        $values[] = $data['thumbnail_id'] ?: null;
    }
    if (isset($data['gallery'])) {
        $fields[] = 'gallery = ?';
        $values[] = json_encode($data['gallery']);
    }
    if (isset($data['is_featured'])) {
        $fields[] = 'is_featured = ?';
        $values[] = (int)$data['is_featured'];
    }
    if (isset($data['is_published'])) {
        $fields[] = 'is_published = ?';
        $values[] = (int)$data['is_published'];
        if ((int)$data['is_published']) {
            $fields[] = 'published_at = COALESCE(published_at, NOW())';
        }
    }
    if (isset($data['position'])) {
        $fields[] = 'position = ?';
        $values[] = (int)$data['position'];
    }

    if (empty($fields)) errorResponse('Nenhum campo para atualizar', 400);

    $values[] = $id;
    $stmt = $db->prepare("UPDATE projects SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($values);

    successResponse(null, 'Projeto atualizado com sucesso');
}

function deleteProject($db, $id) {
    $stmt = $db->prepare("DELETE FROM projects WHERE id = ?");
    $stmt->execute([$id]);
    successResponse(null, 'Projeto excluído com sucesso');
}

function reorderProjects($db) {
    $data = getRequestBody();
    if (!isset($data['order'])) errorResponse('Ordem é obrigatória', 400);

    $stmt = $db->prepare("UPDATE projects SET position = ? WHERE id = ?");
    foreach ($data['order'] as $i => $projectId) {
        $stmt->execute([$i, (int)$projectId]);
    }

    successResponse(null, 'Ordem atualizada');
}
