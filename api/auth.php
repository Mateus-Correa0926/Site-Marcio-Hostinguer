<?php
/**
 * API de Autenticação
 */

function handleAuth($method, $action, $currentUser) {
    $db = Database::getInstance()->getConnection();

    switch ($action) {
        case 'login':
            if ($method !== 'POST') errorResponse('Método não permitido', 405);
            login($db);
            break;
        case 'me':
            if ($method !== 'GET') errorResponse('Método não permitido', 405);
            if (!$currentUser) errorResponse('Não autenticado', 401);
            getProfile($db, $currentUser);
            break;
        case 'change-password':
            if ($method !== 'POST') errorResponse('Método não permitido', 405);
            if (!$currentUser) errorResponse('Não autenticado', 401);
            changePassword($db, $currentUser);
            break;
        default:
            errorResponse('Rota não encontrada', 404);
    }
}

function login($db) {
    $data = getRequestBody();
    validateRequired($data, ['username', 'password']);

    $username = sanitizeString($data['username']);
    $password = $data['password'];

    $stmt = $db->prepare("SELECT id, username, email, password, role FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        errorResponse('Credenciais inválidas', 401);
    }

    $token = JWT::encode([
        'user_id' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role']
    ]);

    successResponse([
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ], 'Login realizado com sucesso');
}

function getProfile($db, $currentUser) {
    $stmt = $db->prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?");
    $stmt->execute([$currentUser['user_id']]);
    $user = $stmt->fetch();

    if (!$user) errorResponse('Usuário não encontrado', 404);

    successResponse($user);
}

function changePassword($db, $currentUser) {
    $data = getRequestBody();
    validateRequired($data, ['current_password', 'new_password']);

    $stmt = $db->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->execute([$currentUser['user_id']]);
    $user = $stmt->fetch();

    if (!password_verify($data['current_password'], $user['password'])) {
        errorResponse('Senha atual incorreta', 400);
    }

    if (strlen($data['new_password']) < 6) {
        errorResponse('A nova senha deve ter pelo menos 6 caracteres', 422);
    }

    $hashedPassword = password_hash($data['new_password'], PASSWORD_DEFAULT);
    $stmt = $db->prepare("UPDATE users SET password = ? WHERE id = ?");
    $stmt->execute([$hashedPassword, $currentUser['user_id']]);

    successResponse(null, 'Senha alterada com sucesso');
}
