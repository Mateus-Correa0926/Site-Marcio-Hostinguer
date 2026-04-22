<?php
/**
 * Router principal da API
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/helpers/jwt.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/upload.php';

setCorsHeaders();

// Obter a URI e método
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/api';

// Remover base path e query string
$uri = parse_url($requestUri, PHP_URL_PATH);
$uri = str_replace($basePath, '', $uri);
$uri = trim($uri, '/');

$method = $_SERVER['REQUEST_METHOD'];
$segments = $uri ? explode('/', $uri) : [];
$resource = $segments[0] ?? '';
$id = $segments[1] ?? null;
$action = $segments[2] ?? null;

// Rotas públicas (não requerem autenticação)
$publicRoutes = [
    'GET' => ['pages', 'projects', 'services', 'settings', 'menu', 'testimonials', 'media', 'project-slots', 'fallback-pool'],
    'POST' => ['auth/login', 'contact']
];

// Verificar se é rota pública
$isPublic = false;
$routeKey = $resource . ($action ? '/' . $action : '');

if ($method === 'GET' && in_array($resource, $publicRoutes['GET'])) {
    $isPublic = true;
}
if ($method === 'POST' && in_array($routeKey, $publicRoutes['POST'])) {
    $isPublic = true;
}
if ($method === 'POST' && $resource === 'auth' && $id === 'login') {
    $isPublic = true;
}

// Autenticar rotas protegidas
$currentUser = null;
if (!$isPublic) {
    $currentUser = JWT::authenticate();
}

// Roteamento
switch ($resource) {
    case 'auth':
        require_once __DIR__ . '/api/auth.php';
        handleAuth($method, $id, $currentUser);
        break;

    case 'pages':
        require_once __DIR__ . '/api/pages.php';
        handlePages($method, $id, $action, $currentUser);
        break;

    case 'sections':
        require_once __DIR__ . '/api/sections.php';
        handleSections($method, $id, $action, $currentUser);
        break;

    case 'media':
        require_once __DIR__ . '/api/media.php';
        handleMedia($method, $id, $action, $currentUser);
        break;

    case 'projects':
        require_once __DIR__ . '/api/projects.php';
        handleProjects($method, $id, $action, $currentUser);
        break;

    case 'services':
        require_once __DIR__ . '/api/services.php';
        handleServices($method, $id, $currentUser);
        break;

    case 'settings':
        require_once __DIR__ . '/api/settings.php';
        handleSettings($method, $id, $currentUser);
        break;

    case 'menu':
        require_once __DIR__ . '/api/menu.php';
        handleMenu($method, $id, $currentUser);
        break;

    case 'contact':
        require_once __DIR__ . '/api/contact.php';
        handleContact($method, $id, $action, $currentUser);
        break;

    case 'testimonials':
        require_once __DIR__ . '/api/testimonials.php';
        handleTestimonials($method, $id, $currentUser);
        break;

    case 'project-slots':
        require_once __DIR__ . '/api/project-slots.php';
        handleProjectSlots($method, $id, $action, $currentUser);
        break;

    case 'fallback-pool':
        require_once __DIR__ . '/api/fallback-pool.php';
        handleFallbackPool($method, $id, $action, $currentUser);
        break;

    case 'uploads':
        // Servir arquivos de upload
        $filePath = UPLOAD_DIR . implode('/', array_slice($segments, 1));
        if (file_exists($filePath) && is_file($filePath)) {
            $mimeType = mime_content_type($filePath);
            header('Content-Type: ' . $mimeType);
            header('Cache-Control: public, max-age=31536000');
            readfile($filePath);
            exit();
        }
        errorResponse('Arquivo não encontrado', 404);
        break;

    default:
        errorResponse('Rota não encontrada', 404);
}
