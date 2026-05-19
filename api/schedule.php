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
    ensureGoogleCalendarEnabled();

    if (!$month || !preg_match('/^\d{4}-\d{2}$/', $month)) {
        errorResponse('Mês inválido. Use YYYY-MM.', 422);
    }

    $timezone = new DateTimeZone(GOOGLE_CALENDAR_TIMEZONE);
    $firstDay = new DateTime($month . '-01 00:00:00', $timezone);
    $lastDay  = new DateTime($firstDay->format('Y-m-t') . ' 23:59:59', $timezone);

    // Consulta o Google Calendar uma só vez para o mês inteiro
    $busyRanges = googleCalendarGetBusyRanges($firstDay, $lastDay);

    $today = new DateTime('today', $timezone);
    $available = [];
    $unavailable = [];

    $cursor = clone $firstDay;
    while ($cursor <= $lastDay) {
        $dateStr = $cursor->format('Y-m-d');
        $weekday = (int)$cursor->format('N'); // 1=Mon, 7=Sun

        // Fim de semana ou dia no passado
        if ($weekday >= 6 || $cursor < $today) {
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
        'available'   => $available,
        'unavailable' => $unavailable
    ]);
}

function getAvailableSlots() {
    ensureGoogleCalendarEnabled();

    $date = getQueryParam('date');
    if (!$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        errorResponse('Data inválida. Use YYYY-MM-DD.', 422);
    }

    $timezone = new DateTimeZone(GOOGLE_CALENDAR_TIMEZONE);
    $dayStart = new DateTime($date . ' 00:00:00', $timezone);
    $dayEnd = new DateTime($date . ' 23:59:59', $timezone);
    $weekday = (int)$dayStart->format('N');

    if ($weekday >= 6) {
        successResponse([
            'date' => $date,
            'timezone' => GOOGLE_CALENDAR_TIMEZONE,
            'slots' => []
        ]);
    }

    $busyRanges = googleCalendarGetBusyRanges($dayStart, $dayEnd);
    $slots = buildDaySlots($date, $busyRanges, $timezone);

    successResponse([
        'date' => $date,
        'timezone' => GOOGLE_CALENDAR_TIMEZONE,
        'slots' => $slots
    ]);
}

function bookMeeting() {
    ensureGoogleCalendarEnabled();

    $data = getRequestBody();
    validateRequired($data, ['name', 'email', 'date', 'start_time']);

    $name = sanitizeString($data['name']);
    $email = filter_var($data['email'], FILTER_SANITIZE_EMAIL);
    $notes = sanitizeString($data['notes'] ?? '');
    $date = $data['date'];
    $startTime = $data['start_time'];

    if (!$name || strlen($name) < 2) {
        errorResponse('Nome inválido', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        errorResponse('E-mail inválido', 422);
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

    if ((int)$start->format('N') >= 6) {
        errorResponse('Não há agendamento disponível no fim de semana.', 422);
    }

    $hour = (int)$start->format('G');
    if ($hour < GOOGLE_CALENDAR_WORKDAY_START_HOUR || $hour >= GOOGLE_CALENDAR_WORKDAY_END_HOUR) {
        errorResponse('Horário fora da agenda disponível.', 422);
    }

    $busy = googleCalendarGetBusyRanges($start, $end);
    if (isRangeBusy($start, $end, $busy)) {
        errorResponse('Esse horário acabou de ser reservado. Escolha outro.', 409);
    }

    $event = googleCalendarCreateEvent($start, $end, $name, $email, $notes);

    successResponse([
        'event_id' => $event['id'] ?? null,
        'html_link' => $event['htmlLink'] ?? null,
        'start' => $start->format(DateTime::ATOM),
        'end' => $end->format(DateTime::ATOM)
    ], 'Reunião agendada com sucesso!', 201);
}

function ensureGoogleCalendarEnabled() {
    if (!GOOGLE_CALENDAR_ENABLED) {
        errorResponse('Agenda indisponível no momento.', 503);
    }
    if (!GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL || !GOOGLE_CALENDAR_PRIVATE_KEY) {
        errorResponse('Configuração do Google Calendar incompleta.', 500);
    }
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

function googleCalendarCreateEvent(DateTime $start, DateTime $end, $name, $email, $notes) {
    $token = googleCalendarGetAccessToken();

    $payload = [
        'summary' => 'Reunião - ' . $name,
        'description' => "Solicitante: {$name}\nE-mail: {$email}\n\nObservações:\n{$notes}",
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
