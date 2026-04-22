<?php
/**
 * API de Páginas
 */

function handlePages($method, $id, $action, $currentUser) {
    $db = Database::getInstance()->getConnection();

    if ($action === 'sections' && $id) {
        require_once __DIR__ . '/sections.php';
        handlePageSections($db, $method, $id, $currentUser);
        return;
    }

    switch ($method) {
        case 'GET':
            if ($id) {
                getPage($db, $id, $currentUser);
            } else {
                getPages($db, $currentUser);
            }
            break;
        case 'POST':
            createPage($db);
            break;
        case 'PUT':
            if (!$id) errorResponse('ID da página é obrigatório', 400);
            updatePage($db, $id);
            break;
        case 'DELETE':
            if (!$id) errorResponse('ID da página é obrigatório', 400);
            deletePage($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function getPages($db, $currentUser) {
    $onlyPublished = !$currentUser;

    $sql = "SELECT p.*, (SELECT COUNT(*) FROM sections s WHERE s.page_id = p.id) as section_count FROM pages p";
    if ($onlyPublished) {
        $sql .= " WHERE p.is_published = 1";
    }
    $sql .= " ORDER BY p.created_at DESC";

    $stmt = $db->query($sql);
    $pages = $stmt->fetchAll();

    successResponse($pages);
}

function getPage($db, $id, $currentUser) {
    $onlyPublished = !$currentUser;

    // Buscar por ID ou slug
    $field = is_numeric($id) ? 'p.id' : 'p.slug';
    $sql = "SELECT p.* FROM pages p WHERE $field = ?";
    if ($onlyPublished) {
        $sql .= " AND p.is_published = 1";
    }

    $stmt = $db->prepare($sql);
    $stmt->execute([$id]);
    $page = $stmt->fetch();

    if (!$page) errorResponse('Página não encontrada', 404);

    // Buscar seções da página
    $stmt = $db->prepare("SELECT * FROM sections WHERE page_id = ? AND is_active = 1 ORDER BY position ASC");
    $stmt->execute([$page['id']]);
    $page['sections'] = $stmt->fetchAll();

    // Decodificar JSON das seções
    foreach ($page['sections'] as &$section) {
        $section['content'] = json_decode($section['content'], true);
        $section['styles'] = json_decode($section['styles'], true);
    }

    successResponse($page);
}

function createPage($db) {
    $data = getRequestBody();
    validateRequired($data, ['title']);

    $slug = generateSlug($data['title']);

    // Verificar slug único
    $stmt = $db->prepare("SELECT id FROM pages WHERE slug = ?");
    $stmt->execute([$slug]);
    if ($stmt->fetch()) {
        $slug .= '-' . time();
    }

    $stmt = $db->prepare(
        "INSERT INTO pages (title, slug, meta_description, is_published, template) VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        sanitizeString($data['title']),
        $slug,
        sanitizeString($data['meta_description'] ?? ''),
        (int)($data['is_published'] ?? 0),
        sanitizeString($data['template'] ?? 'default')
    ]);

    $pageId = $db->lastInsertId();

    // Criar seções iniciais se fornecidas
    if (!empty($data['sections'])) {
        foreach ($data['sections'] as $i => $section) {
            $stmt = $db->prepare(
                "INSERT INTO sections (page_id, section_type, content, styles, position) VALUES (?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $pageId,
                $section['section_type'],
                json_encode($section['content'] ?? []),
                json_encode($section['styles'] ?? []),
                $i
            ]);
        }
    }

    successResponse(['id' => $pageId, 'slug' => $slug], 'Página criada com sucesso', 201);
}

function updatePage($db, $id) {
    $data = getRequestBody();

    $fields = [];
    $values = [];

    if (isset($data['title'])) {
        $fields[] = 'title = ?';
        $values[] = sanitizeString($data['title']);
    }
    if (isset($data['slug'])) {
        $fields[] = 'slug = ?';
        $values[] = generateSlug($data['slug']);
    }
    if (isset($data['meta_description'])) {
        $fields[] = 'meta_description = ?';
        $values[] = sanitizeString($data['meta_description']);
    }
    if (isset($data['is_published'])) {
        $fields[] = 'is_published = ?';
        $values[] = (int)$data['is_published'];
    }
    if (isset($data['template'])) {
        $fields[] = 'template = ?';
        $values[] = sanitizeString($data['template']);
    }

    if (empty($fields)) {
        errorResponse('Nenhum campo para atualizar', 400);
    }

    $values[] = $id;
    $sql = "UPDATE pages SET " . implode(', ', $fields) . " WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute($values);

    successResponse(null, 'Página atualizada com sucesso');
}

function deletePage($db, $id) {
    // Não permitir excluir páginas padrão
    $stmt = $db->prepare("SELECT slug FROM pages WHERE id = ?");
    $stmt->execute([$id]);
    $page = $stmt->fetch();

    if (!$page) errorResponse('Página não encontrada', 404);

    $protectedSlugs = ['home', 'about', 'projects', 'services', 'contact'];
    if (in_array($page['slug'], $protectedSlugs)) {
        errorResponse('Não é possível excluir páginas padrão do sistema', 403);
    }

    $stmt = $db->prepare("DELETE FROM pages WHERE id = ?");
    $stmt->execute([$id]);

    successResponse(null, 'Página excluída com sucesso');
}
