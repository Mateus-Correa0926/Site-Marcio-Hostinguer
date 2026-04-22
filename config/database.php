<?php
/**
 * Configuração do Banco de Dados
 * Alterar as credenciais conforme a Hostinger
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'u277389556_marciofilmes');
define('DB_USER', 'u277389556_marcioifilmes');
define('DB_PASS', 'marcioIMG#2026');
define('DB_CHARSET', 'utf8mb4');

// Chave secreta para JWT - ALTERE PARA UMA CHAVE SEGURA!
define('JWT_SECRET', 'stornoway-secret-key-change-this-in-production-2026');
define('JWT_EXPIRY', 86400); // 24 horas

// Diretório de uploads
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('UPLOAD_URL', '/uploads/');
define('MAX_UPLOAD_SIZE', 500 * 1024 * 1024); // 500MB para vídeos

// Tipos de arquivo permitidos
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);
define('ALLOWED_VIDEO_TYPES', ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']);

// URL base da API
define('API_BASE_URL', '/api');

// Modo de desenvolvimento
define('DEV_MODE', true);

class Database {
    private static $instance = null;
    private $pdo;

    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ];
            $this->pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            if (DEV_MODE) {
                die(json_encode(['error' => 'Erro de conexão: ' . $e->getMessage()]));
            }
            die(json_encode(['error' => 'Erro interno do servidor']));
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->pdo;
    }

    // Impedir clonagem
    private function __clone() {}
}
