import { Logger, OnModuleInit } from '@nestjs/common';
import { maskJid } from '../common/utils/privacy';
import { TtlCache } from '../common/utils/ttl-cache';
import { MessageSenderService } from '../instances/message-sender.service';
import { MessagesService } from '../messages/messages.service';
import { EventBus, IncomingMessage } from '../shared/event-bus.service';
import { BotBaseSettings } from '../shared/settings.types';
import { IntegrationConfigService } from './integration-config.service';

import { describeError } from '../common/utils/errors';
export type BotOutput =
  | { kind: 'text'; text: string }
  | { kind: 'image' | 'video' | 'audio' | 'document'; url: string; caption?: string };

export interface BotReply {
  outputs: BotOutput[];
  /** O fluxo terminou: encerra a sessão (a menos que keepOpen). */
  finished?: boolean;
}

export interface BotSession {
  key: string;
  instanceId: string;
  chatJid: string;
  startedAt: number;
  lastActivity: number;
  /** Dados específicos do provedor (ex: sessionId do Typebot, opções numeradas). */
  state: Record<string, any>;
}

export interface BotTurn<C> {
  config: C;
  session: BotSession;
  message: IncomingMessage;
  text: string;
  isFirstTurn: boolean;
}

/**
 * Motor conversacional comum (Typebot, n8n):
 * - Gatilho por palavra-chave/tudo, palavra de encerramento e expiração;
 * - Debounce: agrupa mensagens enviadas em sequência;
 * - Operador humano respondendo pelo celular pausa o bot (stopBotFromMe);
 * - Respostas do próprio bot/API nunca voltam para o bot (sem loop);
 * - Mensagem de "não entendi" somente dentro de uma sessão ativa (sem spam para todos os contatos).
 */
export abstract class BotEngine<C extends BotBaseSettings> implements OnModuleInit {
  protected abstract readonly type: 'typebot' | 'n8n';
  protected readonly logger: Logger;

  private readonly sessions = new Map<string, BotSession>();
  private readonly buffers = new Map<string, { texts: string[]; last: IncomingMessage; timer: NodeJS.Timeout }>();
  private readonly paused = new TtlCache<string, true>(60 * 60_000, 20_000);
  private readonly processing = new Map<string, Promise<void>>();

  constructor(
    protected readonly bus: EventBus,
    protected readonly configs: IntegrationConfigService,
    protected readonly sender: MessageSenderService,
    protected readonly messages: MessagesService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  protected abstract isConfigured(config: C): boolean;
  protected abstract converse(turn: BotTurn<C>): Promise<BotReply>;

  onModuleInit() {
    this.bus.onIncoming((message) => this.onMessage(message));
    // Limpeza periódica de sessões ociosas (evita crescimento de memória).
    setInterval(() => this.sweep(), 5 * 60_000).unref();
  }

  private async onMessage(message: IncomingMessage) {
    if (message.isGroup || !message.chatJid.includes('@') || message.chatJid.endsWith('@broadcast')) return;

    const config = (await this.configs.resolve(message.instanceId, this.type)) as unknown as C | null;
    if (!config?.enabled || !this.isConfigured(config)) return;

    const key = `${message.instanceId}:${message.chatJid}`;
    const text = message.text;
    const session = this.sessions.get(key);

    if (message.fromMe) {
      // Mensagem digitada por um atendente no celular.
      if (config.stopBotFromMe && session) {
        this.endSession(key, 'operador assumiu a conversa');
        this.paused.set(key, true, Math.max(config.expireMinutes, 60) * 60_000);
        return;
      }
      if (!config.listeningFromMe) return;
    }
    if (!text) return;

    if (config.keywordFinish && text.toLowerCase() === config.keywordFinish.trim().toLowerCase()) {
      if (session) this.endSession(key, 'palavra de encerramento');
      this.paused.delete(key);
      return;
    }

    if (session && config.expireMinutes > 0 && Date.now() - session.lastActivity > config.expireMinutes * 60_000) {
      this.endSession(key, 'sessão expirada');
    }

    let isFirstTurn = false;
    if (!this.sessions.has(key)) {
      if (!this.shouldTrigger(text, config)) return;
      if (this.paused.has(key) && config.triggerType !== 'keyword') return;
      this.paused.delete(key);
      // A sessão é criada já no gatilho para que mensagens no período de debounce não se percam.
      this.sessions.set(key, {
        key,
        instanceId: message.instanceId,
        chatJid: message.chatJid,
        startedAt: Date.now(),
        lastActivity: Date.now(),
        state: {},
      });
      isFirstTurn = true;
      this.logger.log(`Sessão iniciada (${maskJid(message.chatJid)})`);
      if (this.type === 'typebot') this.bus.publish(message.instanceId, 'TYPEBOT_START', { remoteJid: message.chatJid });
    }

    this.sessions.get(key)!.lastActivity = Date.now();
    if (config.debounceTime > 0) {
      this.buffer(key, message, text, config, isFirstTurn);
    } else {
      this.enqueueTurn(key, message, text, config, isFirstTurn);
    }
  }

  private buffer(key: string, message: IncomingMessage, text: string, config: C, isFirstTurn: boolean) {
    const existing = this.buffers.get(key);
    if (existing) clearTimeout(existing.timer);
    const texts = [...(existing?.texts ?? []), text];
    // Lembra que o lote agrupado começou no gatilho (primeiro turno da sessão).
    if (isFirstTurn) this.sessions.get(key)!.state.pendingFirst = true;

    const timer = setTimeout(() => {
      this.buffers.delete(key);
      const session = this.sessions.get(key);
      const first = !!session?.state.pendingFirst;
      if (session) delete session.state.pendingFirst;
      this.enqueueTurn(key, message, texts.join('\n'), config, first);
    }, config.debounceTime * 1000);
    this.buffers.set(key, { texts, last: message, timer });
  }

  /** Garante uma conversa por vez por contato, na ordem de chegada. */
  private enqueueTurn(key: string, message: IncomingMessage, text: string, config: C, isFirstTurn: boolean) {
    const previous = this.processing.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.runTurn(key, message, text, config, isFirstTurn))
      .finally(() => {
        if (this.processing.get(key) === next) this.processing.delete(key);
      });
    this.processing.set(key, next);
  }

  private async runTurn(key: string, message: IncomingMessage, text: string, config: C, isFirstTurn: boolean) {
    const session = this.sessions.get(key);
    if (!session) return;

    try {
      const reply = await this.converse({ config, session, message, text, isFirstTurn });
      session.lastActivity = Date.now();

      if (reply.outputs.length === 0 && !isFirstTurn && config.unknownMessage) {
        await this.deliver(session, [{ kind: 'text', text: config.unknownMessage }], config);
      } else {
        await this.deliver(session, reply.outputs, config);
      }

      if (reply.finished && !config.keepOpen) this.endSession(key, 'fluxo concluído');
    } catch (err) {
      this.logger.error(`Falha na conversa (${maskJid(session.chatJid)}): ${describeError(err)}`);
      if (isFirstTurn) this.endSession(key, 'erro ao iniciar');
    }
  }

  protected async deliver(session: BotSession, outputs: BotOutput[], config: C) {
    for (const output of outputs) {
      try {
        if (output.kind === 'text') {
          const text = output.text.trim();
          if (!text) continue;
          await this.sender.send(session.instanceId, session.chatJid, { text }, {
            source: 'bot',
            delayMs: config.delayMessage,
            preview: text,
          });
        } else {
          await this.messages.sendMediaTo(
            session.instanceId,
            session.chatJid,
            { kind: output.kind, url: output.url, caption: output.caption, ptt: output.kind === 'audio' },
            'bot',
            config.delayMessage,
          );
        }
      } catch (err) {
        this.logger.warn(`Não foi possível enviar resposta do bot: ${describeError(err)}`);
      }
    }
  }

  protected shouldTrigger(text: string, config: C): boolean {
    if (config.triggerType === 'all') return true;
    if (config.triggerType !== 'keyword' || !config.keyword) return false;

    const msg = text.trim().toLowerCase();
    const keywords = config.keyword
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    if (config.triggerOperator === 'regex') {
      try {
        // Limite de tamanho reduz o risco de expressões catastróficas.
        return new RegExp(config.keyword.slice(0, 200), 'i').test(text.slice(0, 2000));
      } catch {
        return false;
      }
    }
    return keywords.some((keyword) => {
      switch (config.triggerOperator) {
        case 'equals':
          return msg === keyword;
        case 'startsWith':
          return msg.startsWith(keyword);
        case 'endsWith':
          return msg.endsWith(keyword);
        default:
          return msg.includes(keyword);
      }
    });
  }

  protected endSession(key: string, reason: string) {
    const session = this.sessions.get(key);
    this.sessions.delete(key);
    const buffered = this.buffers.get(key);
    if (buffered) clearTimeout(buffered.timer);
    this.buffers.delete(key);
    if (session) {
      this.logger.log(`Sessão encerrada (${maskJid(session.chatJid)}): ${reason}`);
      if (this.type === 'typebot') {
        this.bus.publish(session.instanceId, 'TYPEBOT_CHANGE_STATUS', { remoteJid: session.chatJid, status: 'closed', reason });
      }
    }
  }

  private sweep() {
    const maxIdle = 24 * 60 * 60_000;
    for (const [key, session] of this.sessions) {
      if (Date.now() - session.lastActivity > maxIdle) this.endSession(key, 'inatividade');
    }
  }
}
