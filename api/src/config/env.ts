import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';

const logger = new Logger('Config');

const str = (key: string, fallback = ''): string => (process.env[key] ?? fallback).trim();
const int = (key: string, fallback: number): number => {
  const parsed = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (key: string, fallback: boolean): boolean => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
};
const list = (key: string): string[] =>
  str(key)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const isProduction = str('NODE_ENV') === 'production';

function resolveJwtSecret(): string {
  const secret = str('JWT_SECRET');
  const weakDefaults = ['go-api-secret-key', 'go-api-secret-key-change-in-production', 'change-me'];
  if (secret && secret.length >= 32 && !weakDefaults.includes(secret)) return secret;

  if (isProduction) {
    throw new Error(
      'JWT_SECRET ausente ou fraco. Defina um valor aleatório com pelo menos 32 caracteres (ex: openssl rand -hex 32).',
    );
  }
  logger.warn('JWT_SECRET ausente/fraco: usando um segredo aleatório desta execução (tokens expiram ao reiniciar).');
  return crypto.randomBytes(48).toString('hex');
}

const jwtSecret = resolveJwtSecret();

export const env = {
  isProduction,
  port: int('PORT', 3001),

  /** URL pública da API (usada em webhooks de retorno, ex: Chatwoot). */
  publicUrl: str('PUBLIC_API_URL', `http://localhost:${int('PORT', 3001)}`).replace(/\/+$/, ''),

  /** Origens liberadas no CORS. Vazio = qualquer origem (seguro: a API não usa cookies). */
  corsOrigins: list('CORS_ORIGINS'),

  jwtSecret,
  jwtExpiresIn: str('JWT_EXPIRES_IN', '7d'),
  /** Segredo para assinar tokens de callback (Chatwoot). Derivado do JWT se não informado. */
  appSecret: str('APP_SECRET') || crypto.createHash('sha256').update(`app:${jwtSecret}`).digest('hex'),

  adminEmail: str('ADMIN_EMAIL', 'admin@goapi.local').toLowerCase(),
  adminPassword: str('ADMIN_PASSWORD'),
  /** Se true, redefine a senha do admin para ADMIN_PASSWORD ao iniciar. */
  adminResetPassword: bool('ADMIN_RESET_PASSWORD', false),
  /** Cadastro público de usuários. Desligado por padrão (admin ainda pode cadastrar). */
  allowRegistration: bool('ALLOW_REGISTRATION', false),

  sessionsDir: str('SESSIONS_DIR', 'sessions'),
  /** Nome exibido em "Aparelhos conectados" do WhatsApp. */
  waBrowserName: str('WA_BROWSER_NAME', str('BRAND_NAME', 'GO-API')),
  /** Reconecta automaticamente as sessões salvas ao iniciar a API. */
  restoreSessionsOnBoot: bool('RESTORE_SESSIONS_ON_BOOT', true),

  // Anti-ban / fila de envio
  sendMinIntervalMs: int('SEND_MIN_INTERVAL_MS', 900),
  sendJitterMs: int('SEND_JITTER_MS', 600),
  sendMaxPerMinute: int('SEND_MAX_PER_MINUTE', 40),
  sendQueueLimit: int('SEND_QUEUE_LIMIT', 500),
  typingSimulation: bool('TYPING_SIMULATION', true),

  // Segurança de rede
  /** Bloqueia requisições de saída para IPs privados/loopback (proteção SSRF). */
  blockPrivateNetwork: bool('BLOCK_PRIVATE_NETWORK', false),
  mediaMaxBytes: int('MEDIA_MAX_MB', 32) * 1024 * 1024,
  bodyLimit: str('BODY_LIMIT', '25mb'),

  // Rate limit HTTP (por IP)
  throttleTtlMs: int('THROTTLE_TTL_MS', 60_000),
  throttleLimit: int('THROTTLE_LIMIT', 600),

  ffmpegPath: str('FFMPEG_PATH'),
  logLevel: str('LOG_LEVEL', isProduction ? 'log' : 'debug'),
};

export type Env = typeof env;
