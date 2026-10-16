import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  type AnyMessageContent,
  type MiscMessageGenerationOptions,
  type proto,
  type WAMessage,
} from 'baileys';
import { env } from '../config/env';
import { isBroadcastJid, isGroupJid, isLidJid, isPnJid, jidToPhone, normalizeDestination } from '../common/utils/jid';
import { maskJid } from '../common/utils/privacy';
import { TtlCache } from '../common/utils/ttl-cache';
import { EventBus, MessageSource } from '../shared/event-bus.service';
import { BaileysService } from './baileys.service';

export interface SendOptions {
  source: MessageSource;
  /** Tempo (ms) exibindo "digitando..." antes do envio. Se omitido, é calculado pelo tamanho do texto. */
  delayMs?: number;
  quoted?: WAMessage;
  /** Texto usado para auditoria/integrações (ex: Chatwoot). */
  preview?: string;
  type?: string;
}

/**
 * Mensagem já montada no formato do protocolo (ex: interactiveMessage).
 * É enviada via relayMessage, que anexa os nós de negócio exigidos pelo WhatsApp.
 */
export interface RawContent {
  raw: proto.IMessage;
}

export type SendableContent = AnyMessageContent | RawContent;
const isRaw = (content: SendableContent): content is RawContent => 'raw' in (content as object);

interface InstanceQueue {
  tail: Promise<unknown>;
  pending: number;
  lastSentAt: number;
  window: number[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fila de envio por instância com comportamento "humano":
 * - Serializa os envios (sem rajadas paralelas no mesmo número);
 * - Intervalo mínimo + variação aleatória entre mensagens;
 * - Limite de mensagens por minuto;
 * - Presença "digitando/gravando" proporcional ao conteúdo;
 * - Validação de número com cache (evita consultas repetidas ao WhatsApp).
 */
@Injectable()
export class MessageSenderService {
  private readonly logger = new Logger(MessageSenderService.name);
  private readonly queues = new Map<string, InstanceQueue>();
  private readonly numberCache = new TtlCache<string, string | null>(24 * 60 * 60_000, 50_000);

  constructor(
    private readonly baileys: BaileysService,
    private readonly bus: EventBus,
  ) {}

  /**
   * Resolve o destino para um JID válido. Para números, consulta o WhatsApp (com cache)
   * e trata o nono dígito de celulares brasileiros.
   */
  async resolveJid(instanceId: string, to: string): Promise<string> {
    const normalized = normalizeDestination(to);
    if (isGroupJid(normalized) || isLidJid(normalized) || isBroadcastJid(normalized)) return normalized;

    const digits = jidToPhone(normalized);
    if (!/^\d{8,15}$/.test(digits)) throw new BadRequestException('Número de destino inválido');

    const cacheKey = `${instanceId}:${digits}`;
    const cached = this.numberCache.get(cacheKey);
    if (cached !== undefined) {
      if (cached === null) throw new BadRequestException('O número informado não possui WhatsApp');
      return cached;
    }

    const socket = this.baileys.requireSocket(instanceId);
    const candidates = [digits];
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      const ddd = digits.slice(2, 4);
      const local = digits.slice(4);
      candidates.push(local.length === 9 && local.startsWith('9') ? `55${ddd}${local.slice(1)}` : `55${ddd}9${local}`);
    }

    for (const candidate of candidates) {
      try {
        const [result] = (await socket.onWhatsApp(candidate)) ?? [];
        if (result?.exists) {
          const jid = isPnJid(result.jid) ? result.jid : `${candidate}@s.whatsapp.net`;
          this.numberCache.set(cacheKey, jid);
          return jid;
        }
      } catch (err) {
        this.logger.debug(`onWhatsApp ${maskJid(candidate)}: ${(err as Error).message}`);
        // Falha de consulta não deve impedir o envio: usa o número informado.
        return `${digits}@s.whatsapp.net`;
      }
    }

    this.numberCache.set(cacheKey, null, 60 * 60_000);
    throw new BadRequestException('O número informado não possui WhatsApp');
  }

  async checkNumbers(instanceId: string, numbers: string[]) {
    const results: Array<{ number: string; exists: boolean; jid: string | null }> = [];
    for (const number of numbers.slice(0, 50)) {
      try {
        const jid = await this.resolveJid(instanceId, number);
        results.push({ number, exists: true, jid });
      } catch {
        results.push({ number, exists: false, jid: null });
      }
    }
    return results;
  }

  /** Enfileira o envio. A promessa resolve quando a mensagem for de fato enviada. */
  /** Envia uma imagem ao servidor de mídia do WhatsApp (para cabeçalhos de mensagens interativas). */
  async uploadImage(instanceId: string, image: Buffer, mimetype?: string): Promise<proto.Message.IImageMessage> {
    const socket = this.baileys.requireSocket(instanceId);
    const { imageMessage } = await prepareWAMessageMedia(
      { image, ...(mimetype ? { mimetype } : {}) },
      { upload: socket.waUploadToServer },
    );
    if (!imageMessage) throw new BadRequestException('Falha ao enviar a imagem ao WhatsApp');
    return imageMessage;
  }

  send(instanceId: string, jid: string, content: SendableContent, options: SendOptions): Promise<WAMessage> {
    this.baileys.requireSocket(instanceId);
    const queue = this.getQueue(instanceId);
    if (queue.pending >= env.sendQueueLimit) {
      throw new HttpException('Fila de envio cheia para esta instância. Tente novamente em instantes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    queue.pending++;
    const run = queue.tail.catch(() => undefined).then(() => this.deliver(instanceId, queue, jid, content, options));
    queue.tail = run.catch(() => undefined).finally(() => queue.pending--);
    return run;
  }

  getQueueSize(instanceId: string) {
    return this.queues.get(instanceId)?.pending ?? 0;
  }

  private async deliver(
    instanceId: string,
    queue: InstanceQueue,
    jid: string,
    content: SendableContent,
    options: SendOptions,
  ): Promise<WAMessage> {
    await this.respectRateLimit(queue);
    const socket = this.baileys.requireSocket(instanceId);

    const canPresence = env.typingSimulation && !isGroupJid(jid) && !isBroadcastJid(jid);
    if (canPresence) {
      const isAudio = !isRaw(content) && 'audio' in content;
      const typingMs = options.delayMs ?? this.typingDuration(options.preview ?? '');
      if (typingMs > 0) {
        await socket.sendPresenceUpdate(isAudio ? 'recording' : 'composing', jid).catch(() => undefined);
        await sleep(Math.min(typingMs, 25_000));
      }
    } else if (options.delayMs) {
      await sleep(Math.min(options.delayMs, 25_000));
    }

    let sent: WAMessage | undefined;
    if (isRaw(content)) {
      const message = generateWAMessageFromContent(jid, content.raw, {
        userJid: socket.user!.id,
        ...(options.quoted ? { quoted: options.quoted } : {}),
      });
      await socket.relayMessage(jid, message.message!, { messageId: message.key.id! });
      sent = message;
    } else {
      const messageOptions: MiscMessageGenerationOptions = options.quoted ? { quoted: options.quoted } : {};
      sent = await socket.sendMessage(jid, content, messageOptions);
    }
    if (canPresence) socket.sendPresenceUpdate('paused', jid).catch(() => undefined);

    queue.lastSentAt = Date.now();
    queue.window.push(queue.lastSentAt);
    if (!sent) throw new BadRequestException('O WhatsApp não confirmou o envio');

    this.baileys.rememberSent(instanceId, sent);
    this.bus.publish(instanceId, 'SEND_MESSAGE', { key: sent.key, message: sent.message, source: options.source });
    this.bus.emitOutgoing({
      instanceId,
      chatJid: jid,
      source: options.source,
      text: options.preview ?? '',
      type: options.type ?? 'text',
      message: sent,
    });
    return sent;
  }

  private async respectRateLimit(queue: InstanceQueue) {
    const now = Date.now();
    queue.window = queue.window.filter((t) => now - t < 60_000);
    if (env.sendMaxPerMinute > 0 && queue.window.length >= env.sendMaxPerMinute) {
      await sleep(60_000 - (now - queue.window[0]) + 50);
    }
    const gap = env.sendMinIntervalMs + Math.floor(Math.random() * Math.max(env.sendJitterMs, 0));
    const elapsed = Date.now() - queue.lastSentAt;
    if (elapsed < gap) await sleep(gap - elapsed);
  }

  /** ~40ms por caractere, entre 0,6s e 4s (parecido com digitação real). */
  private typingDuration(text: string) {
    if (!text) return 600;
    return Math.max(600, Math.min(4_000, text.length * 40));
  }

  private getQueue(instanceId: string): InstanceQueue {
    let queue = this.queues.get(instanceId);
    if (!queue) {
      queue = { tail: Promise.resolve(), pending: 0, lastSentAt: 0, window: [] };
      this.queues.set(instanceId, queue);
    }
    return queue;
  }
}
