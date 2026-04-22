<?php
/**
 * Helper JWT - Autenticação por token
 */

class JWT {
    
    public static function encode($payload) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload['iat'] = time();
        $payload['exp'] = time() + JWT_EXPIRY;
        $payload = json_encode($payload);

        $base64Header = self::base64UrlEncode($header);
        $base64Payload = self::base64UrlEncode($payload);

        $signature = hash_hmac('sha256', $base64Header . '.' . $base64Payload, JWT_SECRET, true);
        $base64Signature = self::base64UrlEncode($signature);

        return $base64Header . '.' . $base64Payload . '.' . $base64Signature;
    }

    public static function decode($token) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        list($base64Header, $base64Payload, $signatureProvided) = $parts;

        $signature = hash_hmac('sha256', $base64Header . '.' . $base64Payload, JWT_SECRET, true);
        $base64Signature = self::base64UrlEncode($signature);

        if (!hash_equals($base64Signature, $signatureProvided)) return null;

        $payload = json_decode(self::base64UrlDecode($base64Payload), true);

        if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) return null;

        return $payload;
    }

    public static function getTokenFromHeader() {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
            return $matches[1];
        }
        return null;
    }

    public static function authenticate() {
        $token = self::getTokenFromHeader();
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Token não fornecido']);
            exit();
        }

        $payload = self::decode($token);
        if (!$payload) {
            http_response_code(401);
            echo json_encode(['error' => 'Token inválido ou expirado']);
            exit();
        }

        return $payload;
    }

    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
    }
}
