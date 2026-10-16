import { Injectable } from '@nestjs/common';
import { jidToPhone } from '../common/utils/jid';
import { assertSafeUrl, outbound } from '../common/utils/net';
import { MessageSenderService } from '../instances/message-sender.service';
import { MessagesService } from '../messages/messages.service';
import { EventBus } from '../shared/event-bus.service';
import { InstanceSettingsService } from '../shared/instance-settings.service';
import { N8nSettings } from '../shared/settings.types';
import { BotEngine, BotOutput, BotReply, BotTurn } from './bot-engine';
import { IntegrationConfigService } from './integration-config.service';

/**
 * Integração com n8n via webhook. Aceita as respostas mais comuns de workflows:
 * texto puro, { output } (AI Agent), { message }, { text }, { messages: [...] } ou arrays desses itens.
 * Campos opcionais: { endSession: true } encerra a sessão; { mediaUrl, mediaType, caption } envia mídia.
 */
@Injectable()
export class N8nService extends BotEngine<N8nSettings> {
  protected readonly type = 'n8n' as const;

  constructor(
    bus: EventBus,
    configs: IntegrationConfigService,
    sender: MessageSenderService,
    messages: MessagesService,
    private readonly settings: InstanceSettingsService,
  ) {
    super(bus, configs, sender, messages);
  }

  protected isConfigured(config: N8nSettings) {
    return !!config.webhookUrl;
  }

  protected async converse({ config, session, message, text }: BotTurn<N8nSettings>): Promise<BotReply> {
    await assertSafeUrl(config.webhookUrl, 'URL do n8n');
    const meta = await this.settings.getMeta(session.instanceId);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.basicAuthUser) {
      headers.Authorization = `Basic ${Buffer.from(`${config.basicAuthUser}:${config.basicAuthPassword ?? ''}`).toString('base64')}`;
    }

    const { data } = await outbound.post(
      config.webhookUrl,
      {
        sessionId: session.key,
        instanceId: session.instanceId,
        instanceName: meta?.name ?? '',
        remoteJid: session.chatJid,
        phoneNumber: jidToPhone(session.chatJid),
        pushName: message.pushName ?? '',
        message: text,
        messageId: message.id,
        messageType: message.type,
        buttonId: message.buttonId,
        fromMe: message.fromMe,
        timestamp: new Date(message.timestamp * 1000).toISOString(),
      },
      { headers, timeout: 60_000 },
    );

    const items = Array.isArray(data) ? data : [data];
    const outputs: BotOutput[] = [];
    let finished = false;

    for (const item of items) {
      if (item == null) continue;
      if (typeof item === 'string') {
        outputs.push(...this.split(item, config));
        continue;
      }
      if (item.endSession === true) finished = true;
      if (typeof item.mediaUrl === 'string' && /^https?:\/\//.test(item.mediaUrl)) {
        const kind = ['image', 'video', 'audio', 'document'].includes(item.mediaType) ? item.mediaType : 'document';
        outputs.push({ kind, url: item.mediaUrl, caption: item.caption });
      }
      const texts: unknown[] = Array.isArray(item.messages)
        ? item.messages.map((m: any) => (typeof m === 'string' ? m : m?.text ?? m?.message))
        : [item.output ?? item.message ?? item.text ?? item.response];
      for (const t of texts) if (typeof t === 'string' && t.trim()) outputs.push(...this.split(t, config));
    }

    return { outputs, finished };
  }

  /** splitMessages: quebra a resposta em parágrafos, enviados como mensagens separadas. */
  private split(text: string, config: N8nSettings): BotOutput[] {
    const parts = config.splitMessages ? text.split(/\n\s*\n/) : [text];
    return parts.map((p) => p.trim()).filter(Boolean).map((p) => ({ kind: 'text' as const, text: p }));
  }
}
