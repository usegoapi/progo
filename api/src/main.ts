// Deve ser o primeiro import: protege o console antes de carregar Baileys/libsignal.
import './common/utils/console-guard';
import { BadRequestException, Logger, LogLevel, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './config/env';

const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

const COLLECTION_LABELS: Record<string, string> = { buttons: 'Botão', options: 'Opção', numbers: 'Número' };

/** Uma mensagem por campo, com caminho legível em itens aninhados (ex: "Botão 2: ..."). */
function formatValidationErrors(errors: ValidationError[], parents: string[] = []): string[] {
  return errors.flatMap((error) => {
    const path = [...parents, error.property];
    const own = error.constraints ? [Object.values(error.constraints)[0]] : [];
    const label = path
      .map((part, i) => (/^\d+$/.test(part) ? `${COLLECTION_LABELS[path[i - 1]] ?? 'Item'} ${Number(part) + 1}` : null))
      .filter(Boolean)
      .join(' › ');
    const messages = own.map((m) => (label ? `${label}: ${m}` : m));
    return [...messages, ...formatValidationErrors(error.children ?? [], path)];
  });
}

async function bootstrap() {
  const levelIndex = Math.max(0, LOG_LEVELS.indexOf(env.logLevel as LogLevel));
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: LOG_LEVELS.slice(0, levelIndex + 1),
    bodyParser: true,
  });

  app.disable('x-powered-by');
  // Necessário para o rate limit identificar o IP real atrás de proxy/Traefik/Nginx.
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal');
  app.useBodyParser('json', { limit: env.bodyLimit });
  app.useBodyParser('urlencoded', { limit: env.bodyLimit, extended: true });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  // A API autentica por header (JWT/API key), sem cookies: CORS amplo não expõe sessões.
  app.enableCors({
    origin: env.corsOrigins.length ? env.corsOrigins : true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'apikey'],
    credentials: false,
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: false,
      stopAtFirstError: true,
      validationError: { target: false, value: false },
      exceptionFactory: (errors) => new BadRequestException(formatValidationErrors(errors)),
    }),
  );

  app.enableShutdownHooks();
  await app.listen(env.port, '0.0.0.0');
  Logger.log(`🚀 GO-API ouvindo na porta ${env.port} (URL pública: ${env.publicUrl})`, 'Bootstrap');
}

process.on('unhandledRejection', (reason) => {
  Logger.error(`Promise rejeitada sem tratamento: ${(reason as Error)?.message ?? reason}`, undefined, 'Process');
});

bootstrap().catch((err) => {
  Logger.error(`Falha ao iniciar: ${err.message}`, err.stack, 'Bootstrap');
  process.exit(1);
});
