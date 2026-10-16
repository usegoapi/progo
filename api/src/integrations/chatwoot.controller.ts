import { Body, Controller, ForbiddenException, HttpCode, Logger, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatwootService } from './chatwoot.service';

/** Webhook de retorno do Chatwoot (respostas dos agentes → WhatsApp). Autenticado por token HMAC na URL. */
@Controller('chatwoot')
export class ChatwootController {
  private readonly logger = new Logger(ChatwootController.name);

  constructor(private readonly chatwoot: ChatwootService) {}

  @Post('webhook/:instanceId')
  @HttpCode(200)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  receive(@Param('instanceId', ParseUUIDPipe) instanceId: string, @Query('token') token: string, @Body() body: any) {
    if (!ChatwootService.verifyToken(instanceId, token)) throw new ForbiddenException('Token inválido');
    // Responde imediatamente; o processamento segue em segundo plano.
    this.chatwoot.handleWebhook(instanceId, body).catch((err) => this.logger.warn(`Webhook Chatwoot: ${err.message}`));
    return { received: true };
  }
}
