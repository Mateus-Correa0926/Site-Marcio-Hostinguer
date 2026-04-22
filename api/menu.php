<?php
/**
 * API de Menu de Navegação
 */

function handleMenu($method, $id, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($method) {
        case 'GET':
            getMenuItems($db);
            break;
        case 'POST':
            createMenuItem($db);
            break;
        case 'PUT':
            if ($id === 'reorder') {
                reorderMenu($db);
            } elseif ($id) {
                updateMenuItem($db, $id);
            } else {
                errorResponse('ID do item é obrigatório', 400);
            }
            break;
        case 'DELETE':
            if (!$id) errorResponse('ID do item é obrigatório', 400);
            deleteMenuItem($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function getMenuItems($db) {
    $stmt = $db->query(
        "SELECT * FROM menu_items WHERE is_active = 1 ORDER BY position ASC"
    );
    $items = $stmt->fetchAll();

    // Organizar em árvore (parent/children)
    $tree = [];
    $map = [];

    foreach ($items as &$item) {
        $item['children'] = [];
        $map[$item['id']] = &$item;
    }

    foreach ($items as &$item) {
        if ($item['parent_id'] && isset($map[$item['parent_id']])) {
            $map[$item['parent_id']]['children'][] = &$item;
        } else {
            $tree[] = &$item;
        }
    }

    successResponse($tree);
}

function createMenuItem($db) {
    $data = getRequestBody();
    validateRequired($data, ['title', 'url']);

    $maxPos = $db->query("SELECT MAX(position) as m FROM menu_items")->fetch()['m'] ?? 0;

    $slug = generateSlug($data['title']);

    $stmt = $db->prepare(
        "INSERT INTO menu_items (title, slug, url, parent_id, position, is_active, open_new_tab, icon) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        sanitizeString($data['title']),
        $slug,
        sanitizeString($data['url']),
        $data['parent_id'] ?? null,
        $data['position'] ?? ($maxPos + 1),
        (int)($data['is_active'] ?? 1),
        (int)($data['open_new_tab'] ?? 0),
        sanitizeString($data['icon'] ?? '')
    ]);

    successResponse(['id' => $db->lastInsertId()], 'Item de menu criado', 201);
}

function updateMenuItem($db, $id) {
    $data = getRequestBody();
    $fields = [];
    $values = [];

    foreach (['title', 'url', 'icon'] as $f) {
        if (isset($data[$f])) {
            $fields[] = "$f = ?";
            $values[] = sanitizeString($data[$f]);
        }
    }
    if (isset($data['slug'])) {
        $fields[] = 'slug = ?';
        $values[] = generateSlug($data['slug']);
    }
    if (array_key_exists('parent_id', $data)) {
        $fields[] = 'parent_id = ?';
        $values[] = $data['parent_id'];
    }
    if (isset($data['position'])) {
        $fields[] = 'position = ?';
        $values[] = (int)$data['position'];
    }
    if (isset($data['is_active'])) {
        $fields[] = 'is_active = ?';
        $values[] = (int)$data['is_active'];
    }
    if (isset($data['open_new_tab'])) {
        $fields[] = 'open_new_tab = ?';
        $values[] = (int)$data['open_new_tab'];
    }

    if (empty($fields)) errorResponse('Nenhum campo para atualizar', 400);

    $values[] = $id;
    $stmt = $db->prepare("UPDATE menu_items SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($values);

    successResponse(null, 'Item de menu atualizado');
}

function deleteMenuItem($db, $id) {
    // Remover filhos primeiro
    $stmt = $db->prepare("UPDATE menu_items SET parent_id = NULL WHERE parent_id = ?");
    $stmt->execute([$id]);

    $stmt = $db->prepare("DELETE FROM menu_items WHERE id = ?");
    $stmt->execute([$id]);

    successResponse(null, 'Item de menu removido');
}

function reorderMenu($db) {
    $data = getRequestBody();
    if (!isset($data['order'])) errorResponse('Ordem é obrigatória', 400);

    $stmt = $db->prepare("UPDATE menu_items SET position = ?, parent_id = ? WHERE id = ?");

    foreach ($data['order'] as $i => $item) {
        $itemId = is_array($item) ? $item['id'] : $item;
        $parentId = is_array($item) ? ($item['parent_id'] ?? null) : null;
        $stmt->execute([$i, $parentId, (int)$itemId]);
    }

    successResponse(null, 'Menu reordenado');
}
