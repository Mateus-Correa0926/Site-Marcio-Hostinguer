<?php
/**
 * API de Agendamento
 * GET  /api/schedule?date=YYYY-MM-DD
 * POST /api/schedule
 */

function handleSchedule($method, $id, $action, $currentUser) {
    switch ($method) {
        case 'GET':
            $month = getQueryParam('month');
            if ($month) {
                getMonthAvailability($month);
            } else {
                getAvailableSlots();
            }
            break;
        case 'POST':
            bookMeeting();
            break;
        default:
            errorResponse('Método não permitido', 405);
    }
}


function getMonthAvailability($month) {
    if (!$month || !preg_match('/^\d{4}-\d{2}$/', $month)) {
        errorResponse('Mês inválido. Use YYYY-MM.', 422);
    }

    $provider = getScheduleProvider();
    $timezone = new DateTimeZone(GOOGLE_CALENDAR_TIMEZONE);
    $firstDay = new DateTime($month . '-01 00:00:00', $timezone);
    $lastDay  = new DateTime($firstDay->format('Y-m-t') . ' 23:59:59', $timezone);

    $busyRanges = getBusyRanges($provider, $firstDay, $lastDay);

    $today = new DateTime('today', $timezone);
    $available = [];
    $unavailable = [];

    $cursor = clone $firstDay;
    while ($cursor <= $lastDay) {
        $dateStr = $cursor->format('Y-m-d');
        // Dia no passado
        if ($cursor < $today) {
            $unavailable[] = $dateStr;
            $cursor->modify('+1 day');
            continue;
        }

        // Verifica se há pelo menos um slot livre no dia
        $slots = buildDaySlots($dateStr, $busyRanges, $timezone);
        if (count($slots) > 0) {
            $available[] = $dateStr;
        } else {
            $unavailable[] = $dateStr;
        }

        $cursor->modify('+1 day');
    }

    successResponse([
        'month'       => $month,
        'provider'    => $provider,
        'available'   => $available,
        'unavailable' => $unavailable
    ]);
}

function getAvailableSlots() {
    $date = getQueryParam('date');
    if (!$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        errorResponse('Data inválida. Use YYYY-MM-DD.', 422);
    }

    $provider = getScheduleProvider();
    $timezone = new DateTimeZone(GOOGLE_CALENDAR_TIMEZONE);
    $dayStart = new DateTime($date . ' 00:00:00', $timezone);
    $dayEnd = new DateTime($date . ' 23:59:59', $timezone);
    $busyRanges = getBusyRanges($provider, $dayStart, $dayEnd);
    $slots = buildDaySlots($date, $busyRanges, $timezone);

    successResponse([
        'date' => $date,
        'provider' => $provider,
        'timezone' => GOOGLE_CALENDAR_TIMEZONE,
        'slots' => $slots
    ]);
}

function bookMeeting() {
    $data = getRequestBody();
    validateRequired($data, ['name', 'email', 'date', 'start_time', 'subject']);

    $provider = getScheduleProvider();
    $name = sanitizeString($data['name']);
    $email = filter_var($data['email'], FILTER_SANITIZE_EMAIL);
    $subject = sanitizeString($data['subject']);
    $notes = sanitizeString($data['notes'] ?? '');
    $date = $data['date'];
    $startTime = $data['start_time'];

    if (!$name || strlen($name) < 2) {
        errorResponse('Nome inválido', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        errorResponse('E-mail inválido', 422);
    }
    if (!$subject || mb_strlen($subject, 'UTF-8') < 3) {
        errorResponse('Assunto inválido', 422);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        errorResponse('Data inválida. Use YYYY-MM-DD.', 422);
    }
    if (!preg_match('/^\d{2}:\d{2}$/', $startTime)) {
        errorResponse('Horário inválido. Use HH:MM.', 422);
    }

    $timezone = new DateTimeZone(GOOGLE_CALENDAR_TIMEZONE);
    $start = new DateTime($date . ' ' . $startTime . ':00', $timezone);
    $end = clone $start;
    $end->modify('+' . GOOGLE_CALENDAR_SLOT_MINUTES . ' minutes');

    $hour = (int)$start->format('G');
    if ($hour < GOOGLE_CALENDAR_WORKDAY_START_HOUR || $hour >= GOOGLE_CALENDAR_WORKDAY_END_HOUR) {
        errorResponse('Horário fora da agenda disponível.', 422);
    }

    $busy = getBusyRanges($provider, $start, $end);
    if (isRangeBusy($start, $end, $busy)) {
        errorResponse('Esse horário acabou de ser reservado. Escolha outro.', 409);
    }

    $result = $provider === 'google'
        ? googleCalendarCreateEvent($start, $end, $name, $email, $subject, $notes)
        : createAdminCalendarBooking($start, $end, $name, $email, $subject, $notes);

    successResponse([
        'provider' => $provider,
        'event_id' => $result['id'] ?? null,
        'html_link' => $result['htmlLink'] ?? null,
        'start' => $start->format(DateTime::ATOM),
        'end' => $end->format(DateTime::ATOM)
    ], 'Reunião agendada com sucesso!', 201);
}

function getScheduleProvider() {
    if (
        GOOGLE_CALENDAR_ENABLED &&
        GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL &&
        GOOGLE_CALENDAR_PRIVATE_KEY
    ) {
        return 'google';
    }

    return 'admin';
}

function getBusyRanges($provider, DateTime $timeMin, DateTime $timeMax) {
    if ($provider === 'google') {
        return googleCalendarGetBusyRanges($timeMin, $timeMax);
    }

    return adminCalendarGetBusyRanges($timeMin, $timeMax);
}

function buildDaySlots($date, $busyRanges, DateTimeZone $timezone) {
    $slots = [];
    $cursor = new DateTime($date . ' ' . sprintf('%02d:00:00', GOOGLE_CALENDAR_WORKDAY_START_HOUR), $timezone);
    $endWorkday = new DateTime($date . ' ' . sprintf('%02d:00:00', GOOGLE_CALENDAR_WORKDAY_END_HOUR), $timezone);

    while ($cursor < $endWorkday) {
        $slotEnd = clone $cursor;
        $slotEnd->modify('+' . GOOGLE_CALENDAR_SLOT_MINUTES . ' minutes');

        if ($slotEnd > $endWorkday) {
            break;
        }

        $busy = isRangeBusy($cursor, $slotEnd, $busyRanges);
        if (!$busy) {
            $slots[] = [
                'start' => $cursor->format('H:i'),
                'end' => $slotEnd->format('H:i'),
                'label' => $cursor->format('H:i') . ' - ' . $slotEnd->format('H:i')
            ];
        }

        $cursor->modify('+' . GOOGLE_CALENDAR_SLOT_MINUTES . ' minutes');
    }

    return $slots;
}

function isRangeBusy(DateTime $start, DateTime $end, $busyRanges) {
    $startTs = $start->getTimestamp();
    $endTs = $end->getTimestamp();

    foreach ($busyRanges as $range) {
        $busyStart = $range['start']->getTimestamp();
        $busyEnd = $range['end']->getTimestamp();
        if ($startTs < $busyEnd && $endTs > $busyStart) {
            return true;
        }
    }

    return false;
}

function googleCalendarGetBusyRanges(DateTime $timeMin, DateTime $timeMax) {
    $token = googleCalendarGetAccessToken();

    $payload = [
        'timeMin' => $timeMin->format(DateTime::RFC3339),
        'timeMax' => $timeMax->format(DateTime::RFC3339),
        'timeZone' => GOOGLE_CALENDAR_TIMEZONE,
        'items' => [
            ['id' => GOOGLE_CALENDAR_CALENDAR_ID]
        ]
    ];

    $response = googleApiRequest(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        'POST',
        $token,
        $payload
    );

    $busy = $response['calendars'][GOOGLE_CALENDAR_CALENDAR_ID]['busy'] ?? [];
    $ranges = [];
    foreach ($busy as $item) {
        $ranges[] = [
            'start' => new DateTime($item['start']),
            'end' => new DateTime($item['end'])
        ];
    }

    return $ranges;
}

function googleCalendarCreateEvent(DateTime $start, DateTime $end, $name, $email, $subject, $notes) {
    $token = googleCalendarGetAccessToken();

    $payload = [
        'summary' => 'Reunião - ' . $subject,
        'description' => "Solicitante: {$name}\nE-mail: {$email}\nAssunto: {$subject}\n\nObservações:\n{$notes}",
        'start' => [
            'dateTime' => $start->format(DateTime::RFC3339),
            'timeZone' => GOOGLE_CALENDAR_TIMEZONE
        ],
        'end' => [
            'dateTime' => $end->format(DateTime::RFC3339),
            'timeZone' => GOOGLE_CALENDAR_TIMEZONE
        ],
        'attendees' => [
            ['email' => $email, 'displayName' => $name]
        ]
    ];

    $url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode(GOOGLE_CALENDAR_CALENDAR_ID) . '/events?sendUpdates=all';
    return googleApiRequest($url, 'POST', $token, $payload);
}

function adminCalendarGetBusyRanges(DateTime $timeMin, DateTime $timeMax) {
    $db = Database::getInstance()->getConnection();
    ensureAdminMeetingTable($db);

    $stmt = $db->prepare(
        "SELECT start_at, end_at
         FROM meeting_bookings
         WHERE status = 'confirmed'
           AND start_at < ?
           AND end_at > ?"
    );

    $stmt->execute([
        $timeMax->format('Y-m-d H:i:s'),
        $timeMin->format('Y-m-d H:i:s')
    ]);

    $ranges = [];
    foreach ($stmt->fetchAll() as $row) {
        $ranges[] = [
            'start' => new DateTime($row['start_at'], new DateTimeZone(GOOGLE_CALENDAR_TIMEZONE)),
            'end' => new DateTime($row['end_at'], new DateTimeZone(GOOGLE_CALENDAR_TIMEZONE))
        ];
    }

    return $ranges;
}

function createAdminCalendarBooking(DateTime $start, DateTime $end, $name, $email, $subject, $notes) {
    $db = Database::getInstance()->getConnection();
    ensureAdminMeetingTable($db);

    $slotKey = $start->format('Y-m-d-H:i');

    $stmt = $db->prepare(
        "INSERT INTO meeting_bookings
         (provider, slot_key, subject, requester_name, requester_email, notes, start_at, end_at, status)
         VALUES ('admin', ?, ?, ?, ?, ?, ?, ?, 'confirmed')"
    );

    try {
        $stmt->execute([
            $slotKey,
            $subject,
            $name,
            $email,
            $notes,
            $start->format('Y-m-d H:i:s'),
            $end->format('Y-m-d H:i:s')
        ]);
    } catch (PDOException $e) {
        if ((int)$e->getCode() === 23000) {
            errorResponse('Esse horário acabou de ser reservado. Escolha outro.', 409);
        }
        throw $e;
    }

    return [
        'id' => $db->lastInsertId(),
        'htmlLink' => null
    ];
}

function ensureAdminMeetingTable($db) {
    static $checked = false;
    if ($checked) return;

    $db->exec(
        "CREATE TABLE IF NOT EXISTS meeting_bookings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            provider ENUM('admin','google') DEFAULT 'admin',
            slot_key VARCHAR(64) NOT NULL UNIQUE,
            subject VARCHAR(255) NOT NULL,
            requester_name VARCHAR(255) NOT NULL,
            requester_email VARCHAR(255) NOT NULL,
            notes TEXT DEFAULT NULL,
            start_at DATETIME NOT NULL,
            end_at DATETIME NOT NULL,
            external_event_id VARCHAR(255) DEFAULT NULL,
            status ENUM('confirmed','cancelled') DEFAULT 'confirmed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_meeting_start (start_at),
            INDEX idx_meeting_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $checked = true;
}

function googleCalendarGetAccessToken() {
    $now = time();
    $jwtHeader = ['alg' => 'RS256', 'typ' => 'JWT'];
    $jwtClaim = [
        'iss' => GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL,
        'scope' => 'https://www.googleapis.com/auth/calendar',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600
    ];

    $jwt = base64UrlEncode(json_encode($jwtHeader)) . '.' . base64UrlEncode(json_encode($jwtClaim));
    $signature = '';

    $ok = openssl_sign($jwt, $signature, GOOGLE_CALENDAR_PRIVATE_KEY, OPENSSL_ALGO_SHA256);
    if (!$ok) {
        errorResponse('Falha ao assinar credenciais do Google Calendar.', 500);
    }

    $assertion = $jwt . '.' . base64UrlEncode($signature);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $assertion
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = json_decode($raw, true);
    if ($status >= 300 || empty($json['access_token'])) {
        errorResponse('Não foi possível autenticar no Google Calendar.', 502, $json);
    }

    return $json['access_token'];
}

function googleApiRequest($url, $method, $accessToken, $payload = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);

    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
    }

    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = json_decode($raw, true);
    if ($status >= 300) {
        errorResponse('Erro de integração com Google Calendar.', 502, $json);
    }

    return $json ?? [];
}

function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
