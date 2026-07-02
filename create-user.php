<?php
/**
 * Script de criação de usuário — USO ÚNICO
 * ==========================================
 * Acesse: https://seusite.com/create-user.php?token=stornoway2026
 *
 * IMPORTANTE: Apague este arquivo do servidor após o uso!
 */

define('CREATE_USER_TOKEN', 'stornoway2026');

header('Content-Type: text/html; charset=utf-8');

echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Criar Usuário</title>';
echo '<style>body{font-family:sans-serif;max-width:600px;margin:60px auto;padding:0 20px;background:#0a0a0a;color:#e0e0e0}';
echo 'h1{color:#C9B8A0}.ok{color:#4ade80}.err{color:#f87171}';
echo '.box{background:#141414;padding:20px;border-radius:8px;margin:16px 0;border-left:4px solid #333}';
echo '.box.ok-box{border-left-color:#4ade80}.box.err-box{border-left-color:#f87171}';
echo '.warn{background:#141414;border-left:4px solid #fbbf24;padding:16px;border-radius:8px;margin-top:24px;color:#fbbf24;font-size:13px}';
echo '</style></head><body>';
echo '<h1>Criar Usuário Admin</h1>';

// Validar token
$token = $_GET['token'] ?? '';
if (!hash_equals(CREATE_USER_TOKEN, $token)) {
    http_response_code(403);
    echo '<div class="box err-box"><span class="err">✗</span> Token inválido ou ausente.</div>';
    echo '<p style="color:#888;font-size:13px">Acesse com: <code>?token=stornoway2026</code></p>';
    echo '</body></html>';
    exit;
}

require_once __DIR__ . '/config/database.php';

try {
    $db = Database::getInstance()->getConnection();
} catch (Exception $e) {
    echo '<div class="box err-box"><span class="err">✗</span> Erro de conexão: ' . htmlspecialchars($e->getMessage()) . '</div>';
    echo '</body></html>';
    exit;
}

// Hash seguro da senha '123' gerado com password_hash()
$username     = 'mateus';
$email        = 'mateus@stornowayfilms.com';
$passwordHash = '$2y$10$ToAsJqfkba0EDeBlxslDpeYSjXKq4v6tNDpWbt3HCHQNBt3QK45wW';
$role         = 'admin';

// Verificar se usuário já existe
$check = $db->prepare("SELECT id FROM users WHERE username = ?");
$check->execute([$username]);
if ($check->fetch()) {
    echo '<div class="box ok-box"><span class="ok">✓</span> Usuário <strong>' . htmlspecialchars($username) . '</strong> já existe. Nenhuma alteração feita.</div>';
} else {
    $stmt = $db->prepare(
        "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)"
    );
    $stmt->execute([$username, $email, $passwordHash, $role]);

    echo '<div class="box ok-box">';
    echo '<span class="ok">✓</span> Usuário criado com sucesso!<br>';
    echo '<strong>Usuário:</strong> ' . htmlspecialchars($username) . '<br>';
    echo '<strong>Senha:</strong> 123<br>';
    echo '<strong>Role:</strong> ' . htmlspecialchars($role);
    echo '</div>';
}

echo '<div class="warn">';
echo '⚠️ <strong>Atenção:</strong> Apague o arquivo <code>create-user.php</code> do servidor imediatamente após o uso para evitar riscos de segurança.';
echo '</div>';
echo '</body></html>';
