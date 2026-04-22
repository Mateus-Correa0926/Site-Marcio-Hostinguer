<?php
/**
 * API de Seções
 */

function handleSections($method, $id, $action, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($method) {
        case 'GET':
            if ($id) {
                getSection($db, $id);
            }
            break;
        case 'POST':
            createSection($db);
            break;
        case 'PUT':
            if ($action === 'reorder') {
                reorderSections($db);
            } elseif ($id) {
                updateSection($db, $id);
            }
            break;
        case 'DELETE':
            if (!$id) errorResponse('ID da seção é obrigatório', 400);
            deleteSection($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function handlePageSections($db, $method, $pageId, $currentUser) {
    switch ($method) {
        case 'GET':
            getPageSections($db, $pageId);
            break;
        case 'POST':
            $data = getRequestBody();
            $data['page_id'] = $pageId;
            createSectionFromData($db, $data);
            break;
        case 'PUT':
            reorderPageSections($db, $pageId);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function getPageSections($db, $pageId) {
    $stmt = $db->prepare("SELECT * FROM sections WHERE page_id = ? ORDER BY position ASC");
    $stmt->execute([$pageId]);
    $sections = $stmt->fetchAll();

    foreach ($sections as &$section) {
        $section['content'] = json_decode($section['content'], true);
        $section['styles'] = json_decode($section['styles'], true);
    }

    successResponse($sections);
}

function getSection($db, $id) {
    $stmt = $db->prepare("SELECT * FROM sections WHERE id = ?");
    $stmt->execute([$id]);
    $section = $stmt->fetch();

    if (!$section) errorResponse('Seção não encontrada', 404);

    $section['content'] = json_decode($section['content'], true);
    $section['styles'] = json_decode($section['styles'], true);

    successResponse($section);
}

function createSection($db) {
    $data = getRequestBody();
    createSectionFromData($db, $data);
}

function createSectionFromData($db, $data) {
    validateRequired($data, ['page_id', 'section_type']);

    // Obter posição mais alta
    $stmt = $db->prepare("SELECT MAX(position) as max_pos FROM sections WHERE page_id = ?");
    $stmt->execute([$data['page_id']]);
    $maxPos = $stmt->fetch()['max_pos'] ?? -1;

    $stmt = $db->prepare(
        "INSERT INTO sections (page_id, section_type, content, styles, position, is_active) VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        (int)$data['page_id'],
        sanitizeString($data['section_type']),
        json_encode($data['content'] ?? getDefaultContent($data['section_type'])),
        json_encode($data['styles'] ?? getDefaultStyles($data['section_type'])),
        $data['position'] ?? ($maxPos + 1),
        (int)($data['is_active'] ?? 1)
    ]);

    $sectionId = $db->lastInsertId();

    // Retornar a seção criada
    $stmt = $db->prepare("SELECT * FROM sections WHERE id = ?");
    $stmt->execute([$sectionId]);
    $section = $stmt->fetch();
    $section['content'] = json_decode($section['content'], true);
    $section['styles'] = json_decode($section['styles'], true);

    successResponse($section, 'Seção criada com sucesso', 201);
}

function updateSection($db, $id) {
    $data = getRequestBody();

    $fields = [];
    $values = [];

    if (isset($data['section_type'])) {
        $fields[] = 'section_type = ?';
        $values[] = sanitizeString($data['section_type']);
    }
    if (array_key_exists('content', $data)) {
        $fields[] = 'content = ?';
        $values[] = json_encode($data['content']);
    }
    if (array_key_exists('styles', $data)) {
        $fields[] = 'styles = ?';
        $values[] = json_encode($data['styles']);
    }
    if (isset($data['position'])) {
        $fields[] = 'position = ?';
        $values[] = (int)$data['position'];
    }
    if (isset($data['is_active'])) {
        $fields[] = 'is_active = ?';
        $values[] = (int)$data['is_active'];
    }

    if (empty($fields)) {
        errorResponse('Nenhum campo para atualizar', 400);
    }

    $values[] = $id;
    $sql = "UPDATE sections SET " . implode(', ', $fields) . " WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute($values);

    // Retornar seção atualizada
    $stmt = $db->prepare("SELECT * FROM sections WHERE id = ?");
    $stmt->execute([$id]);
    $section = $stmt->fetch();
    if ($section) {
        $section['content'] = json_decode($section['content'], true);
        $section['styles'] = json_decode($section['styles'], true);
    }

    successResponse($section, 'Seção atualizada com sucesso');
}

function deleteSection($db, $id) {
    $stmt = $db->prepare("DELETE FROM sections WHERE id = ?");
    $stmt->execute([$id]);

    successResponse(null, 'Seção excluída com sucesso');
}

function reorderSections($db) {
    $data = getRequestBody();
    if (!isset($data['sections']) || !is_array($data['sections'])) {
        errorResponse('Lista de seções é obrigatória', 400);
    }

    $stmt = $db->prepare("UPDATE sections SET position = ? WHERE id = ?");
    foreach ($data['sections'] as $i => $sectionId) {
        $stmt->execute([$i, (int)$sectionId]);
    }

    successResponse(null, 'Ordem atualizada com sucesso');
}

function reorderPageSections($db, $pageId) {
    $data = getRequestBody();
    if (!isset($data['order']) || !is_array($data['order'])) {
        errorResponse('Lista de ordem é obrigatória', 400);
    }

    $stmt = $db->prepare("UPDATE sections SET position = ? WHERE id = ? AND page_id = ?");
    foreach ($data['order'] as $i => $sectionId) {
        $stmt->execute([$i, (int)$sectionId, (int)$pageId]);
    }

    successResponse(null, 'Ordem atualizada com sucesso');
}

function getDefaultContent($type) {
    $defaults = [
        'hero' => [
            'title' => 'Título Principal',
            'subtitle' => 'Subtítulo',
            'description' => 'Descrição do conteúdo',
            'video_url' => '',
            'image_url' => '',
            'button_text' => '',
            'button_url' => ''
        ],
        'text' => [
            'title' => 'Título da Seção',
            'content' => '<p>Seu texto aqui...</p>',
            'alignment' => 'center'
        ],
        'image' => [
            'image_url' => '',
            'alt_text' => '',
            'caption' => '',
            'link_url' => '',
            'width' => '100%',
            'height' => 'auto'
        ],
        'video' => [
            'video_url' => '',
            'poster_url' => '',
            'autoplay' => false,
            'muted' => true,
            'loop' => true,
            'title' => ''
        ],
        'gallery' => [
            'title' => 'Galeria',
            'items' => [],
            'columns' => 3,
            'gap' => 16
        ],
        'testimonial' => [
            'title' => 'Depoimentos',
            'items' => [],
            'background_image' => ''
        ],
        'cta' => [
            'title' => 'Vamos registrar a sua história.',
            'subtitle' => 'Entre em contato',
            'button_text' => 'CONECTE-SE HOJE',
            'button_url' => '/contact',
            'background_image' => ''
        ],
        'contact_form' => [
            'title' => 'COMO ENTRAR EM CONTATO CONOSCO',
            'description' => '',
            'form_type' => 'couple'
        ],
        'founders' => [
            'title' => 'CONHEÇA OS FUNDADORES',
            'names' => '',
            'description' => '',
            'image_url' => '',
            'button_text' => 'SOBRE A EQUIPE',
            'button_url' => '/about',
            'press_logos' => []
        ],
        'projects_grid' => [
            'title' => 'Projetos em Destaque',
            'subtitle' => '',
            'max_items' => 6,
            'layout' => 'grid'
        ],
        'services_list' => [
            'title' => 'Nossos Serviços',
            'subtitle' => '',
            'layout' => 'cards'
        ],
        'featured_in' => [
            'title' => 'Em destaque',
            'logos' => []
        ],
        'custom' => [
            'html' => '',
            'css' => ''
        ]
    ];

    return $defaults[$type] ?? [];
}

function getDefaultStyles($type) {
    $defaults = [
        'hero' => [
            'height' => '100vh',
            'text_color' => '#ffffff',
            'overlay_opacity' => 0.3,
            'padding' => '0',
            'text_align' => 'center'
        ],
        'text' => [
            'padding' => '80px 20px',
            'background' => '#ffffff',
            'text_color' => '#333333',
            'max_width' => '800px'
        ],
        'cta' => [
            'padding' => '100px 20px',
            'background' => '#f5f5f0',
            'text_color' => '#333333',
            'button_bg' => '#1a1a2e',
            'button_color' => '#ffffff'
        ],
        'founders' => [
            'background' => '#1a1a2e',
            'text_color' => '#ffffff',
            'padding' => '80px 20px'
        ]
    ];

    return $defaults[$type] ?? ['padding' => '60px 20px', 'background' => '#ffffff'];
}
