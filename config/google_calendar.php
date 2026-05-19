<?php
/**
 * Configuração do Google Calendar (agendamento público)
 *
 * Recomendação: defina variáveis de ambiente no servidor.
 * Exemplo de private key em ENV com quebras escapadas (\n):
 * GOOGLE_CALENDAR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 */

define('GOOGLE_CALENDAR_ENABLED', filter_var(getenv('GOOGLE_CALENDAR_ENABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN));
define('GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL', getenv('GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL') ?: '');
define('GOOGLE_CALENDAR_PRIVATE_KEY', str_replace('\\n', "\n", getenv('GOOGLE_CALENDAR_PRIVATE_KEY') ?: ''));
define('GOOGLE_CALENDAR_CALENDAR_ID', getenv('GOOGLE_CALENDAR_CALENDAR_ID') ?: 'primary');
define('GOOGLE_CALENDAR_TIMEZONE', getenv('GOOGLE_CALENDAR_TIMEZONE') ?: 'America/Sao_Paulo');
define('GOOGLE_CALENDAR_WORKDAY_START_HOUR', (int)(getenv('GOOGLE_CALENDAR_WORKDAY_START_HOUR') ?: 9));
define('GOOGLE_CALENDAR_WORKDAY_END_HOUR', (int)(getenv('GOOGLE_CALENDAR_WORKDAY_END_HOUR') ?: 18));
define('GOOGLE_CALENDAR_SLOT_MINUTES', (int)(getenv('GOOGLE_CALENDAR_SLOT_MINUTES') ?: 60));
