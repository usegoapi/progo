import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import type { WAMessage } from 'baileys';

/** Eventos públicos (webhook/websocket/rabbitmq/sqs) no padrão usado pelo painel. */
export const WA_EVENTS = [
  'APPLICATION_STARTUP',
  'CALL',
  'CHATS_DELETE',
  'CHATS_SET',
  'CHATS_UPDATE',
  'CHATS_UPSERT',
  'CONNECTION_UPDATE',
  'CONTACTS_SET',
  'CONTACTS_UPDATE',
  'CONTACTS_UPSERT',
  'GROUP_PARTICIPANTS_UPDATE',
  'GROUP_UPDATE',
  'GROUPS_UPSERT',
  'LABELS_ASSOCIATION',
  'LABELS_EDIT',
  'LOGOUT_INSTANCE',
  'MESSAGES_DELETE',
  'MESSAGES_SET',
  'MESSAGES_UPDATE',
  'MESSAGES_UPSERT',
  'PRESENCE_UPDATE',
  'QRCODE_UPDATED',
  'REMOVE_INSTANCE',
  'SEND_MESSAGE',
  'TYPEBOT_CHANGE_STATUS',
  'TYPEBOT_START',
] as const;

export type WaEvent = (typeof WA_EVENTS)[number];

/** Nomes usados pela página global de Webhooks (mantidos por compatibilidade). */
export const EVENT_ALIASES: Record<string, WaEvent> = {
  message_received: 'MESSAGES_UPSERT',
  message_sent: 'SEND_MESSAGE',
  instance_status: 'CONNECTION_UPDATE',
  qr_code_updated: 'QRCODE_UPDATED',
};

export const resolveEventName = (name: string): WaEvent | null => {
  const upper = name.toUpperCase().replace(/[.\-]/g, '_') as WaEvent;
  if ((WA_EVENTS as readonly string[]).includes(upper)) return upper;
  return EVENT_ALIASES[name] ?? null;
};

export interface PublicEvent {
  event: WaEvent;
  instanceId: string;
  data: unknown;
  date: string;
}

export type MessageSource = 'api' | 'panel' | 'bot' | 'chatwoot' | 'phone' | 'contact';

/** Mensagem recebida normalizada, consumida pelas integrações. */
export interface IncomingMessage {
  instanceId: string;
  id: string;
  /** JID do chat preferindo o número de telefone (resolve endereçamento @lid). */
  chatJid: string;
  rawJid: string;
  fromMe: boolean;
  isGroup: boolean;
  pushName: string | null;
  text: string;
  type: string;
  hasMedia: boolean;
  /** Id do botão tocado pelo contato (respostas de botões interativos). */
  buttonId: string | null;
  timestamp: number;
  raw: WAMessage;
}

/** Mensagem enviada pela API/bots/Chatwoot (não passa pelo upsert "notify"). */
export interface OutgoingMessage {
  instanceId: string;
  chatJid: string;
  source: MessageSource;
  text: string;
  type: string;
  message: WAMessage;
}

/**
 * Barramento interno desacoplando o núcleo do WhatsApp dos consumidores
 * (dispatchers de eventos e integrações), sem dependências circulares.
 */
@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publish(instanceId: string, event: WaEvent, data: unknown) {
    this.safeEmit('public', { event, instanceId, data, date: new Date().toISOString() } satisfies PublicEvent);
  }

  emitIncoming(message: IncomingMessage) {
    this.safeEmit('incoming', message);
  }

  emitOutgoing(message: OutgoingMessage) {
    this.safeEmit('outgoing', message);
  }

  /** Sinaliza alteração de configuração (invalida caches). */
  emitConfigChanged(scope: 'instance' | 'webhooks' | 'integrations', key: string) {
    this.safeEmit('config', { scope, key });
  }

  onPublic(handler: (event: PublicEvent) => unknown) {
    this.on('public', handler);
  }

  onIncoming(handler: (message: IncomingMessage) => unknown) {
    this.on('incoming', handler);
  }

  onOutgoing(handler: (message: OutgoingMessage) => unknown) {
    this.on('outgoing', handler);
  }

  onConfigChanged(handler: (change: { scope: string; key: string }) => unknown) {
    this.on('config', handler);
  }

  private on(channel: string, handler: (payload: any) => unknown) {
    this.emitter.on(channel, (payload) => {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((err) => this.logger.error(`Handler de "${channel}" falhou: ${err?.message ?? err}`));
    });
  }

  private safeEmit(channel: string, payload: unknown) {
    try {
      this.emitter.emit(channel, payload);
    } catch (err) {
      this.logger.error(`Falha ao emitir "${channel}": ${(err as Error).message}`);
    }
  }
}
