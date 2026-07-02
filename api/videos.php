<?php
/**
 * API de Vídeos — Gerenciador de vídeos por seção do site
 *
 * Rotas:
 *   GET    /api/videos                    Lista todos os vídeos (admin)
 *   GET    /api/videos/{id}               Retorna um vídeo (admin)
 *   GET    /api/videos/section/{key}      Vídeos ativos de uma seção (público)
 *   POST   /api/videos                    Cria vídeo (upload ou youtube)
 *   POST   /api/videos/{id}/update        Atualiza vídeo (suporta upload multipart)
 *   PUT    /api/videos/{id}/toggle        Alterna status ativo/inativo
 *   DELETE /api/videos/{id}               Remove vídeo
 */

function handleVideos($method, $id, $action, $currentUser) {
    $db = Database::getInstance()->getConnection();

    // Rota pública: GET /api/videos/section/{section_key}
    if ($method === 'GET' && $id === 'section' && $action) {
        getVideosBySection($db, $action);
        return;
    }

    // Todas as outras rotas requerem autenticação
    if (!$currentUser) {
        errorResponse('Não autorizado', 401);
    }

    switch ($method) {
        case 'GET':
            $id ? getVideo($db, $id) : getVideos($db);
            break;

        case 'POST':
            if ($id && $action === 'update') {
                updateVideo($db, $id);
            } else {
                createVideo($db);
            }
            break;

        case 'PUT':
            if (!$id) errorResponse('ID do vídeo é obrigatório', 400);
            if ($action === 'toggle') {
                toggleVideo($db, $id);
            } else {
                errorResponse('Ação não reconhecida', 400);
            }
            break;

        case 'DELETE':
            if (!$id) errorResponse('ID do vídeo é obrigatório', 400);
            deleteVideo($db, $id);
            break;

        default:
            errorResponse('Método não permitido', 405);
    }
}

/* ============================================================
   HELPERS YOUTUBE
   ============================================================ */

/**
 * Valida que a URL pertence a um domínio YouTube permitido.
 */
function validateYoutubeDomain($url) {
    $host = strtolower(parse_url($url, PHP_URL_HOST) ?? '');
    $allowed = ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtu.be', 'www.youtube-nocookie.com'];
    return in_array($host, $allowed, true);
}

/**
 * Extrai o ID de 11 caracteres de qualquer URL do YouTube.
 * Aceita: watch?v=, youtu.be/, /embed/, /shorts/
 */
function parseYoutubeId($url) {
    $url = trim($url);
    // Remove query params after the ID
    $pattern = '/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/';
    if (preg_match($pattern, $url, $matches)) {
        return $matches[1];
    }
    return null;
}

/**
 * Constrói URL de embed com parâmetros de autoplay/loop/muted.
 */
function buildEmbedUrl($videoId) {
    return 'https://www.youtube.com/embed/' . $videoId
        . '?autoplay=1&mute=1&loop=1&playlist=' . $videoId
        . '&controls=0&rel=0&playsinline=1';
}

/* ============================================================
   ENRICH
   ============================================================ */

function enrichVideo($row) {
    if ($row['type'] === 'upload') {
        $row['video_url_desktop'] = $row['video_file_desktop']
            ? UPLOAD_URL . $row['video_file_desktop'] : null;
        $row['video_url_mobile']  = $row['video_file_mobile']
            ? UPLOAD_URL . $row['video_file_mobile']  : null;
        $row['poster_url']        = $row['poster_image']
            ? UPLOAD_URL . $row['poster_image']        : null;
    } elseif ($row['type'] === 'youtube' && $row['youtube_video_id']) {
        $row['embed_url'] = buildEmbedUrl($row['youtube_video_id']);
    }
    return $row;
}

/* ============================================================
   READ
   ============================================================ */

function getVideos($db) {
    $stmt = $db->query(
        "SELECT * FROM videos ORDER BY section_key ASC, sort_order ASC, created_at DESC"
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row = enrichVideo($row);
    }
    successResponse($rows);
}

function getVideo($db, $id) {
    $stmt = $db->prepare("SELECT * FROM videos WHERE id = ?");
    $stmt->execute([(int)$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Vídeo não encontrado', 404);
    successResponse(enrichVideo($row));
}

function getVideosBySection($db, $sectionKey) {
    // Sanitize: apenas letras, números, _ e -
    if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $sectionKey)) {
        errorResponse('Chave de seção inválida', 400);
    }
    $stmt = $db->prepare(
        "SELECT * FROM videos WHERE section_key = ? AND is_active = 1
         ORDER BY sort_order ASC, id ASC"
    );
    $stmt->execute([$sectionKey]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row = enrichVideo($row);
    }
    successResponse($rows);
}

/* ============================================================
   CREATE
   ============================================================ */

function createVideo($db) {
    $type       = $_POST['type'] ?? '';
    $title      = trim($_POST['title'] ?? '');
    $sectionKey = trim($_POST['section_key'] ?? '');
    $isActive   = isset($_POST['is_active']) ? (int)$_POST['is_active'] : 1;
    $sortOrder  = (int)($_POST['sort_order'] ?? 0);

    if (!in_array($type, ['upload', 'youtube'], true)) {
        errorResponse('Tipo inválido. Use "upload" ou "youtube"', 400);
    }
    if ($title === '') errorResponse('Título é obrigatório', 400);
    if ($sectionKey === '') errorResponse('Seção é obrigatória', 400);
    if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $sectionKey)) {
        errorResponse('Chave de seção inválida (use apenas letras, números, _ e -)', 400);
    }

    $videoFileDesktop = null;
    $videoFileMobile  = null;
    $youtubeVideoId   = null;
    $posterImage      = null;

    if ($type === 'youtube') {
        $ytUrl = trim($_POST['youtube_url'] ?? '');
        if ($ytUrl === '') errorResponse('URL do YouTube é obrigatória', 400);
        if (!validateYoutubeDomain($ytUrl)) {
            errorResponse('Domínio não permitido. Use youtube.com ou youtu.be', 400);
        }
        $youtubeVideoId = parseYoutubeId($ytUrl);
        if (!$youtubeVideoId) {
            errorResponse('Não foi possível extrair o ID do vídeo do YouTube', 400);
        }
    } else {
        // Upload obrigatório para desktop
        if (!isset($_FILES['video_desktop']) || $_FILES['video_desktop']['error'] !== UPLOAD_ERR_OK) {
            errorResponse('Arquivo de vídeo desktop é obrigatório', 400);
        }
        $videoFileDesktop = uploadVideoFile('video_desktop');

        // Mobile opcional
        if (isset($_FILES['video_mobile']) && $_FILES['video_mobile']['error'] === UPLOAD_ERR_OK) {
            $videoFileMobile = uploadVideoFile('video_mobile');
        }
    }

    // Poster opcional para ambos os tipos
    if (isset($_FILES['poster']) && $_FILES['poster']['error'] === UPLOAD_ERR_OK) {
        $posterImage = uploadPosterFile('poster');
    }

    $stmt = $db->prepare(
        "INSERT INTO videos
            (title, section_key, type, video_file_desktop, video_file_mobile,
             youtube_video_id, poster_image, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $title, $sectionKey, $type,
        $videoFileDesktop, $videoFileMobile,
        $youtubeVideoId, $posterImage,
        $isActive, $sortOrder
    ]);
    $newId = (int)$db->lastInsertId();

    $stmt = $db->prepare("SELECT * FROM videos WHERE id = ?");
    $stmt->execute([$newId]);
    successResponse(enrichVideo($stmt->fetch()), 'Vídeo criado com sucesso', 201);
}

/* ============================================================
   UPDATE (via POST /videos/{id}/update — suporta multipart)
   ============================================================ */

function updateVideo($db, $id) {
    $stmt = $db->prepare("SELECT * FROM videos WHERE id = ?");
    $stmt->execute([(int)$id]);
    $existing = $stmt->fetch();
    if (!$existing) errorResponse('Vídeo não encontrado', 404);

    $type       = $_POST['type'] ?? $existing['type'];
    $title      = trim($_POST['title'] ?? $existing['title']);
    $sectionKey = trim($_POST['section_key'] ?? $existing['section_key']);
    $isActive   = isset($_POST['is_active']) ? (int)$_POST['is_active'] : (int)$existing['is_active'];
    $sortOrder  = isset($_POST['sort_order']) ? (int)$_POST['sort_order'] : (int)$existing['sort_order'];

    if (!in_array($type, ['upload', 'youtube'], true)) {
        errorResponse('Tipo inválido', 400);
    }
    if ($title === '') errorResponse('Título é obrigatório', 400);
    if ($sectionKey === '') errorResponse('Seção é obrigatória', 400);
    if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $sectionKey)) {
        errorResponse('Chave de seção inválida', 400);
    }

    // Preserve existing files by default
    $videoFileDesktop = $existing['video_file_desktop'];
    $videoFileMobile  = $existing['video_file_mobile'];
    $youtubeVideoId   = $existing['youtube_video_id'];
    $posterImage      = $existing['poster_image'];

    if ($type === 'youtube') {
        $ytUrl = trim($_POST['youtube_url'] ?? '');
        if ($ytUrl !== '') {
            if (!validateYoutubeDomain($ytUrl)) {
                errorResponse('Domínio não permitido. Use youtube.com ou youtu.be', 400);
            }
            $newId = parseYoutubeId($ytUrl);
            if (!$newId) errorResponse('Não foi possível extrair o ID do YouTube', 400);
            $youtubeVideoId = $newId;
        }
        // Ao trocar para YouTube, limpar arquivos de vídeo
        $videoFileDesktop = null;
        $videoFileMobile  = null;
    } else {
        // Substituir arquivos se enviados
        if (isset($_FILES['video_desktop']) && $_FILES['video_desktop']['error'] === UPLOAD_ERR_OK) {
            $videoFileDesktop = uploadVideoFile('video_desktop');
        }
        if (isset($_FILES['video_mobile']) && $_FILES['video_mobile']['error'] === UPLOAD_ERR_OK) {
            $videoFileMobile = uploadVideoFile('video_mobile');
        }
        $youtubeVideoId = null;
    }

    if (isset($_FILES['poster']) && $_FILES['poster']['error'] === UPLOAD_ERR_OK) {
        $posterImage = uploadPosterFile('poster');
    }

    $stmt = $db->prepare(
        "UPDATE videos
         SET title=?, section_key=?, type=?,
             video_file_desktop=?, video_file_mobile=?,
             youtube_video_id=?, poster_image=?,
             is_active=?, sort_order=?, updated_at=NOW()
         WHERE id=?"
    );
    $stmt->execute([
        $title, $sectionKey, $type,
        $videoFileDesktop, $videoFileMobile,
        $youtubeVideoId, $posterImage,
        $isActive, $sortOrder,
        (int)$id
    ]);

    $stmt = $db->prepare("SELECT * FROM videos WHERE id = ?");
    $stmt->execute([(int)$id]);
    successResponse(enrichVideo($stmt->fetch()), 'Vídeo atualizado com sucesso');
}

/* ============================================================
   TOGGLE
   ============================================================ */

function toggleVideo($db, $id) {
    $stmt = $db->prepare("SELECT id, is_active FROM videos WHERE id = ?");
    $stmt->execute([(int)$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Vídeo não encontrado', 404);

    $newStatus = $row['is_active'] ? 0 : 1;
    $db->prepare("UPDATE videos SET is_active=?, updated_at=NOW() WHERE id=?")
       ->execute([$newStatus, (int)$id]);

    successResponse(
        ['is_active' => $newStatus],
        $newStatus ? 'Vídeo ativado' : 'Vídeo desativado'
    );
}

/* ============================================================
   DELETE
   ============================================================ */

function deleteVideo($db, $id) {
    $stmt = $db->prepare("SELECT id FROM videos WHERE id = ?");
    $stmt->execute([(int)$id]);
    if (!$stmt->fetch()) errorResponse('Vídeo não encontrado', 404);

    // Arquivos no servidor são mantidos para histórico (política de não-deleção automática)
    $db->prepare("DELETE FROM videos WHERE id = ?")->execute([(int)$id]);
    successResponse(null, 'Vídeo removido com sucesso');
}

/* ============================================================
   UPLOAD HELPERS
   ============================================================ */

function uploadVideoFile($fieldName) {
    $mime = mime_content_type($_FILES[$fieldName]['tmp_name']);
    $allowed = ['video/mp4', 'video/webm'];
    if (!in_array($mime, $allowed, true)) {
        errorResponse('Formato de vídeo inválido. Use .mp4 ou .webm', 400);
    }
    $result = FileUploader::upload($_FILES[$fieldName], 'videos');
    if (isset($result['error'])) errorResponse($result['error'], 400);
    return $result['file_path'];
}

function uploadPosterFile($fieldName) {
    $mime = mime_content_type($_FILES[$fieldName]['tmp_name']);
    if (!in_array($mime, ALLOWED_IMAGE_TYPES, true)) {
        errorResponse('Formato de imagem de capa inválido', 400);
    }
    $result = FileUploader::upload($_FILES[$fieldName], 'videos');
    if (isset($result['error'])) errorResponse($result['error'], 400);
    return $result['file_path'];
}
