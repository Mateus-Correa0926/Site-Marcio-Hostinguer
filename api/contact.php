<?php
/**
 * API de Contato (formulários)
 */

function handleContact($method, $id, $action, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($method) {
        case 'GET':
            if (!$currentUser) errorResponse('Não autorizado', 401);
            if ($id) {
                getSubmission($db, $id);
            } else {
                getSubmissions($db);
            }
            break;
        case 'POST':
            if ($id && $action === 'read') {
                if (!$currentUser) errorResponse('Não autorizado', 401);
                markAsRead($db, $id);
            } else {
                submitContact($db);
            }
            break;
        case 'PUT':
            if (!$currentUser) errorResponse('Não autorizado', 401);
            if ($id) markAsRead($db, $id);
            break;
        case 'DELETE':
            if (!$currentUser) errorResponse('Não autorizado', 401);
            if (!$id) errorResponse('ID é obrigatório', 400);
            deleteSubmission($db, $id);
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}

function submitContact($db) {
    $data = getRequestBody();
    validateRequired($data, ['full_name', 'email']);

    // Validar e-mail
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        errorResponse('E-mail inválido', 422);
    }

    $formType = sanitizeString($data['form_type'] ?? 'couple');

    $stmt = $db->prepare(
        "INSERT INTO contact_submissions 
         (form_type, full_name, partner_name, email, phone, instagram, event_date, event_location, 
          event_type, planner_name, photographer_name, budget, message, how_found, referral, 
          booking_stage, company_name, additional_info)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    $stmt->execute([
        $formType,
        sanitizeString($data['full_name']),
        sanitizeString($data['partner_name'] ?? ''),
        filter_var($data['email'], FILTER_SANITIZE_EMAIL),
        sanitizeString($data['phone'] ?? ''),
        sanitizeString($data['instagram'] ?? ''),
        $data['event_date'] ?? null,
        sanitizeString($data['event_location'] ?? ''),
        sanitizeString($data['event_type'] ?? ''),
        sanitizeString($data['planner_name'] ?? ''),
        sanitizeString($data['photographer_name'] ?? ''),
        sanitizeString($data['budget'] ?? ''),
        sanitizeString($data['message'] ?? ''),
        sanitizeString($data['how_found'] ?? ''),
        sanitizeString($data['referral'] ?? ''),
        sanitizeString($data['booking_stage'] ?? ''),
        sanitizeString($data['company_name'] ?? ''),
        sanitizeString($data['additional_info'] ?? '')
    ]);

    successResponse(null, 'Mensagem enviada com sucesso! Entraremos em contato em breve.', 201);
}

function getSubmissions($db) {
    $page = (int)(getQueryParam('page', 1));
    $perPage = (int)(getQueryParam('per_page', 20));
    $formType = getQueryParam('form_type');
    $isRead = getQueryParam('is_read');
    $offset = ($page - 1) * $perPage;

    $where = [];
    $params = [];

    if ($formType) {
        $where[] = "form_type = ?";
        $params[] = $formType;
    }
    if ($isRead !== null && $isRead !== '') {
        $where[] = "is_read = ?";
        $params[] = (int)$isRead;
    }

    $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $db->prepare("SELECT COUNT(*) as total FROM contact_submissions $whereClause");
    $countStmt->execute($params);
    $total = $countStmt->fetch()['total'];

    $sql = "SELECT * FROM contact_submissions $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?";
    $params[] = $perPage;
    $params[] = $offset;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    // Contar não lidos
    $unreadStmt = $db->query("SELECT COUNT(*) as c FROM contact_submissions WHERE is_read = 0");
    $unreadCount = $unreadStmt->fetch()['c'];

    $data = $stmt->fetchAll();

    jsonResponse([
        'success' => true,
        'data' => $data,
        'unread_count' => (int)$unreadCount,
        'pagination' => [
            'total' => (int)$total,
            'page' => (int)$page,
            'per_page' => (int)$perPage,
            'total_pages' => ceil($total / $perPage)
        ]
    ]);
}

function getSubmission($db, $id) {
    $stmt = $db->prepare("SELECT * FROM contact_submissions WHERE id = ?");
    $stmt->execute([$id]);
    $submission = $stmt->fetch();

    if (!$submission) errorResponse('Mensagem não encontrada', 404);

    // Marcar como lida
    $db->prepare("UPDATE contact_submissions SET is_read = 1 WHERE id = ?")->execute([$id]);

    successResponse($submission);
}

function markAsRead($db, $id) {
    $stmt = $db->prepare("UPDATE contact_submissions SET is_read = 1 WHERE id = ?");
    $stmt->execute([$id]);
    successResponse(null, 'Marcada como lida');
}

function deleteSubmission($db, $id) {
    $stmt = $db->prepare("DELETE FROM contact_submissions WHERE id = ?");
    $stmt->execute([$id]);
    successResponse(null, 'Mensagem excluída');
}
