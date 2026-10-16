import { Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { jidToPhone } from '../common/utils/jid';
import { assertSafeUrl, outbound } from '../common/utils/net';
import { MessageSenderService } from '../instances/message-sender.service';
import { MessagesService, numberEmoji } from '../messages/messages.service';
import { EventBus } from '../shared/event-bus.service';
import { InstanceSettingsService } from '../shared/instance-settings.service';
import { TypebotSettings } from '../shared/settings.types';
import { BotEngine, BotOutput, BotReply, BotTurn } from './bot-engine';
import { IntegrationConfigService } from './integration-config.service';

import { describeError } from '../common/utils/errors';
/** Converte o Markdown do Typebot para a formatação do WhatsApp. */
export function markdownToWhatsapp(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/(?<![*\w])__(.+?)__(?!\w)/g, '_$1_')
    .replace(/~~(.+?)~~/g, '~$1~')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_m, label, url) => (label === url ? url : `${label} (${url})`))
    .replace(/\\([*_~`])/g, '$1')
    .trim();
}

/** Extrai texto do formato richText (Slate) usado por versões antigas. */
function richTextToString(nodes: any[]): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((node) => {
      if (typeof node?.text === 'string') {
        let text = node.text;
        if (node.bold) text = `*${text}*`;
        if (node.italic) text = `_${text}_`;
        return text;
      }
      if (node?.type === 'a' && node.url) return `${richTextToString(node.children)} (${node.url})`;
      return richTextToString(node?.children ?? []);
    })
    .join(nodes.some((n) => n?.type === 'p' || n?.type === 'variable') ? '\n' : '');
}

@Injectable()
export class TypebotService extends BotEngine<TypebotSettings> {
  protected readonly type = 'typebot' as const;
  /** Versões antigas do Typebot esperam `message` como string. */
  private readonly legacyServers = new Set<string>();

  constructor(
    bus: EventBus,
    configs: IntegrationConfigService,
    sender: MessageSenderService,
    messages: MessagesService,
    private readonly settings: InstanceSettingsService,
  ) {
    super(bus, configs, sender, messages);
  }

  protected isConfigured(config: TypebotSettings) {
    return !!config.apiUrl && !!config.publicName;
  }

  protected async converse({ config, session, message, text, isFirstTurn }: BotTurn<TypebotSettings>): Promise<BotReply> {
    const apiUrl = config.apiUrl.replace(/\/+$/, '');
    await assertSafeUrl(apiUrl, 'URL do Typebot');

    let response: any;
    if (isFirstTurn || !session.state.sessionId) {
      const meta = await this.settings.getMeta(session.instanceId);
      response = await this.post(apiUrl, `/api/v1/typebots/${encodeURIComponent(config.publicName)}/startChat`, {
        textBubbleContentFormat: 'markdown',
        prefilledVariables: {
          remoteJid: session.chatJid,
          phoneNumber: jidToPhone(session.chatJid),
          pushName: message.pushName ?? '',
          instanceName: meta?.name ?? '',
          instanceId: session.instanceId,
        },
      });
      session.state.sessionId = response.sessionId;
      if (!response.sessionId) throw new Error('Typebot não retornou sessionId');
    } else {
      response = await this.post(apiUrl, `/api/v1/sessions/${encodeURIComponent(session.state.sessionId)}/continueChat`, {
        message: this.resolveChoice(session.state.choices, text),
        textBubbleContentFormat: 'markdown',
      });
    }

    const outputs = this.toOutputs(response.messages ?? []);
    const input = response.input;
    session.state.choices = undefined;

    // Botões de escolha viram um menu numerado (botões nativos não são entregues pelo WhatsApp).
    const items: Array<{ content?: string }> = input?.items ?? [];
    if (input?.type === 'choice input' && items.length) {
      session.state.choices = items.map((i) => i.content ?? '');
      const menu = items.map((item, idx) => `${numberEmoji(idx + 1)} ${item.content ?? ''}`).join('\n');
      const last = outputs[outputs.length - 1];
      if (last?.kind === 'text') last.text = `${last.text}\n\n${menu}`;
      else outputs.push({ kind: 'text', text: menu });
    }

    return { outputs, finished: !input };
  }

  private resolveChoice(choices: string[] | undefined, text: string): string {
    if (!choices?.length) return text;
    const index = Number.parseInt(text.trim(), 10);
    if (Number.isInteger(index) && index >= 1 && index <= choices.length) return choices[index - 1];
    return text;
  }

  private toOutputs(messages: any[]): BotOutput[] {
    const outputs: BotOutput[] = [];
    for (const msg of messages) {
      const content = msg?.content ?? {};
      switch (msg?.type) {
        case 'text': {
          const text = content.markdown
            ? markdownToWhatsapp(content.markdown)
            : content.richText
              ? richTextToString(content.richText)
              : content.plainText ?? (typeof content === 'string' ? content : '');
          if (text) outputs.push({ kind: 'text', text });
          break;
        }
        case 'image':
        case 'video':
        case 'audio':
          if (content.url && /^https?:\/\//.test(content.url)) outputs.push({ kind: msg.type, url: content.url });
          break;
        case 'embed':
          if (content.url) outputs.push({ kind: 'text', text: content.url });
          break;
      }
    }
    return outputs;
  }

  /** Usa o formato atual ({type,text}); se o servidor recusar, repete no formato legado (string). */
  private async post(apiUrl: string, path: string, body: Record<string, any>) {
    const legacy = this.legacyServers.has(apiUrl);
    const payload = { ...body };
    if (typeof body.message === 'string') {
      payload.message = legacy ? body.message : { type: 'text', text: body.message };
    }

    try {
      const { data } = await outbound.post(`${apiUrl}${path}`, payload, { timeout: 30_000 });
      return data;
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (!legacy && typeof body.message === 'string' && (status === 400 || status === 422)) {
        this.legacyServers.add(apiUrl);
        return this.post(apiUrl, path, body);
      }
      throw new Error(`Typebot respondeu ${status ?? describeError(err)}`);
    }
  }
}
