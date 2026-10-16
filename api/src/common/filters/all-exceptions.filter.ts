import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * Padroniza respostas de erro e impede vazamento de detalhes internos
 * (stack traces, SQL, caminhos de arquivo) para o cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, any> = { message: 'Erro interno. Tente novamente em instantes.' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      body = typeof response === 'string' ? { message: response } : { ...(response as object) };
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { message: 'Registro já existe' };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { message: 'Registro não encontrado' };
      }
    }

    if (status >= 500) {
      const errorId = crypto.randomUUID();
      body = { message: body.message ?? 'Erro interno', errorId };
      const err = exception as Error;
      const route = `${req?.method} ${req?.route?.path ?? ''}`;
      if (exception instanceof HttpException) {
        // 5xx previsto pela aplicação (ex: 504 do WhatsApp): sem stack, só o motivo.
        this.logger.warn(`[${errorId}] ${route} -> ${status}: ${body.message}`);
      } else {
        this.logger.error(`[${errorId}] ${route} -> ${err?.message}`, err?.stack);
      }
    }

    res.status(status).json({ statusCode: status, ...body });
  }
}
