<?php
/**
 * Helper de Upload de Arquivos
 */

class FileUploader {

    public static function upload($file, $folder = 'general') {
        if (!isset($file['tmp_name']) || $file['error'] !== UPLOAD_ERR_OK) {
            return ['error' => 'Erro no upload do arquivo: ' . self::getUploadError($file['error'] ?? -1)];
        }

        if ($file['size'] > MAX_UPLOAD_SIZE) {
            return ['error' => 'Arquivo muito grande. Máximo: ' . (MAX_UPLOAD_SIZE / 1024 / 1024) . 'MB'];
        }

        $mimeType = mime_content_type($file['tmp_name']);
        $fileType = self::getFileType($mimeType);

        if (!$fileType) {
            return ['error' => 'Tipo de arquivo não permitido: ' . $mimeType];
        }

        // Criar diretório se não existir
        $uploadDir = UPLOAD_DIR . $folder . '/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Gerar nome único
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = uniqid() . '_' . time() . '.' . strtolower($extension);
        $filePath = $uploadDir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            return ['error' => 'Falha ao salvar o arquivo'];
        }

        $result = [
            'filename' => $filename,
            'original_name' => $file['name'],
            'file_path' => $folder . '/' . $filename,
            'file_type' => $fileType,
            'mime_type' => $mimeType,
            'file_size' => $file['size']
        ];

        // Obter dimensões para imagens
        if ($fileType === 'image') {
            $imageInfo = getimagesize($filePath);
            if ($imageInfo) {
                $result['width'] = $imageInfo[0];
                $result['height'] = $imageInfo[1];
            }

            // Gerar thumbnail
            $thumbPath = self::createThumbnail($filePath, $uploadDir, $filename);
            if ($thumbPath) {
                $result['thumbnail_path'] = $folder . '/thumbs/' . $filename;
            }
        }

        return $result;
    }

    public static function uploadMultiple($files, $folder = 'general') {
        $results = [];
        if (!is_array($files['name'])) {
            return [self::upload($files, $folder)];
        }

        for ($i = 0; $i < count($files['name']); $i++) {
            $file = [
                'name' => $files['name'][$i],
                'type' => $files['type'][$i],
                'tmp_name' => $files['tmp_name'][$i],
                'error' => $files['error'][$i],
                'size' => $files['size'][$i]
            ];
            $results[] = self::upload($file, $folder);
        }
        return $results;
    }

    public static function delete($filePath) {
        $fullPath = UPLOAD_DIR . $filePath;
        if (file_exists($fullPath)) {
            unlink($fullPath);
        }

        // Remover thumbnail se existir
        $dir = dirname($filePath);
        $file = basename($filePath);
        $thumbPath = UPLOAD_DIR . $dir . '/thumbs/' . $file;
        if (file_exists($thumbPath)) {
            unlink($thumbPath);
        }

        return true;
    }

    private static function createThumbnail($sourcePath, $uploadDir, $filename, $maxWidth = 400, $maxHeight = 300) {
        $thumbDir = $uploadDir . 'thumbs/';
        if (!is_dir($thumbDir)) {
            mkdir($thumbDir, 0755, true);
        }

        $imageInfo = getimagesize($sourcePath);
        if (!$imageInfo) return false;

        list($width, $height, $type) = $imageInfo;

        $ratio = min($maxWidth / $width, $maxHeight / $height);
        if ($ratio >= 1) {
            // Imagem já é pequena, copiar
            copy($sourcePath, $thumbDir . $filename);
            return $thumbDir . $filename;
        }

        $newWidth = (int)($width * $ratio);
        $newHeight = (int)($height * $ratio);

        $thumb = imagecreatetruecolor($newWidth, $newHeight);

        switch ($type) {
            case IMAGETYPE_JPEG:
                $source = imagecreatefromjpeg($sourcePath);
                break;
            case IMAGETYPE_PNG:
                $source = imagecreatefrompng($sourcePath);
                imagealphablending($thumb, false);
                imagesavealpha($thumb, true);
                break;
            case IMAGETYPE_GIF:
                $source = imagecreatefromgif($sourcePath);
                break;
            case IMAGETYPE_WEBP:
                $source = imagecreatefromwebp($sourcePath);
                break;
            default:
                return false;
        }

        if (!$source) return false;

        imagecopyresampled($thumb, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        $thumbPath = $thumbDir . $filename;
        switch ($type) {
            case IMAGETYPE_JPEG:
                imagejpeg($thumb, $thumbPath, 85);
                break;
            case IMAGETYPE_PNG:
                imagepng($thumb, $thumbPath, 8);
                break;
            case IMAGETYPE_GIF:
                imagegif($thumb, $thumbPath);
                break;
            case IMAGETYPE_WEBP:
                imagewebp($thumb, $thumbPath, 85);
                break;
        }

        imagedestroy($thumb);
        imagedestroy($source);

        return $thumbPath;
    }

    private static function getFileType($mimeType) {
        if (in_array($mimeType, ALLOWED_IMAGE_TYPES)) {
            return 'image';
        }
        if (in_array($mimeType, ALLOWED_VIDEO_TYPES)) {
            return 'video';
        }
        return null;
    }

    private static function getUploadError($code) {
        $errors = [
            UPLOAD_ERR_INI_SIZE => 'Arquivo excede o limite do servidor',
            UPLOAD_ERR_FORM_SIZE => 'Arquivo excede o limite do formulário',
            UPLOAD_ERR_PARTIAL => 'Upload incompleto',
            UPLOAD_ERR_NO_FILE => 'Nenhum arquivo enviado',
            UPLOAD_ERR_NO_TMP_DIR => 'Diretório temporário não encontrado',
            UPLOAD_ERR_CANT_WRITE => 'Falha ao gravar no disco',
            UPLOAD_ERR_EXTENSION => 'Upload bloqueado por extensão'
        ];
        return $errors[$code] ?? 'Erro desconhecido';
    }
}
