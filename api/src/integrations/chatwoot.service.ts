import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AxiosError } from 'axios';
import { downloadMediaMessage, getContentType, normalizeMessageContent, type WAMessage } from 'baileys';
import * as crypto from 'crypto';
import P from 'pino';
import { env } from '../config/env';
import { isBroadcastJid, isGroupJid, isPnJid, jidToPhone } from '../common/utils/jid';
import { KeyedMutex } from '../common/utils/keyed-mutex';
import { assertSafeUrl, outbound } from '../common/utils/net';
import { maskJid } from '../common/utils/privacy';
import { TtlCache } from '../common/utils/ttl-cache';
import { BaileysService } from '../instances/baileys.service';
import { MessageSenderService } from '../instances/message-sender.service';
import { MessagesService } from '../messages/messages.service';
import { MediaKind } from '../messages/media.util';
import { EventBus, IncomingMessage, OutgoingMessage } from '../shared/event-bus.service';
import { ChatwootSettings } from '../shared/settings.types';
import { IntegrationConfigService } from './integration-config.service';

import { describeError } from '../common/utils/errors';
interface ForwardItem {
  chatJid: string;
  pushName: string | null;
  fromMe: boolean;
  waId: string;
  text: string;
  raw: WAMessage | null;
}

interface ContactRef {
  id: number;
  sourceId: string;
}

const silentLogger = P({ level: 'silent' });

/**
 * Integração bidirecional com o Chatwoot (canal API):
 * WhatsApp → Chatwoot: mensagens recebidas, enviadas pelo celular, pela API e pelos bots (com mídia).
 * Chatwoot → WhatsApp: respostas dos agentes chegam pelo webhook /chatwoot/webhook/:instanceId.
 */
@Injectable()
export class ChatwootService implements OnModuleInit {
  private readonly logger = new Logger(ChatwootService.name);
  private readonly mutex = new KeyedMutex();
  private readonly inboxes = new TtlCache<string, number>(10 * 60_000, 2_000);
  private readonly contacts = new TtlCache<string, ContactRef>(30 * 60_000, 50_000);
  private readonly conversations = new TtlCache<string, number>(30 * 60_000, 50_000);
  /** Ids de mensagens criadas por nós no Chatwoot: o webhook delas é ignorado (sem eco). */
  private readonly ownMessages = new TtlCache<number, true>(10 * 60_000, 50_000);

  constructor(
    private readonly bus: EventBus,
    private readonly configs: IntegrationConfigService,
    private readonly baileys: BaileysService,
    private readonly sender: MessageSenderService,
    private readonly messages: MessagesService,
  ) {}

  onModuleInit() {
    this.bus.onIncoming((message) => this.onIncoming(message));
    this.bus.onOutgoing((message) => this.onOutgoing(message));
    this.bus.onConfigChanged(({ scope, key }) => {
      if (scope === 'instance') this.inboxes.delete(key);
    });
  }

  /** Token do webhook de retorno (HMAC por instância), validado em tempo constante. */
  static webhookToken(instanceId: string) {
    return crypto.createHmac('sha256', env.appSecret).update(`chatwoot:${instanceId}`).digest('hex').slice(0, 40);
  }

  static verifyToken(instanceId: string, token: string | undefined) {
    if (!token) return false;
    const expected = Buffer.from(ChatwootService.webhookToken(instanceId));
    const received = Buffer.from(token);
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  }

  // ───────────────────────────── WhatsApp → Chatwoot ─────────────────────────────

  private async onIncoming(message: IncomingMessage) {
    if (message.isGroup) return;
    await this.enqueueForward(message.instanceId, {
      chatJid: message.chatJid,
      pushName: message.fromMe ? null : message.pushName,
      fromMe: message.fromMe,
      waId: message.id,
      text: message.text || this.describe(message.raw),
      raw: message.hasMedia ? message.raw : null,
    });
  }

  private async onOutgoing(message: OutgoingMessage) {
    if (message.source === 'chatwoot' || isGroupJid(message.chatJid)) return;
    const content = normalizeMessageContent(message.message.message);
    const type = getContentType(content);
    const hasMedia = !!type && ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].includes(type);
    const caption = (content as any)?.[type ?? '']?.caption;
    await this.enqueueForward(message.instanceId, {
      chatJid: message.chatJid,
      pushName: null,
      fromMe: true,
      waId: message.message.key.id ?? '',
      text: hasMedia ? caption ?? '' : message.text,
      raw: hasMedia ? message.message : null,
    });
  }

  private async enqueueForward(instanceId: string, item: ForwardItem) {
    if (isBroadcastJid(item.chatJid)) return;
    const config = await this.configs.resolve(instanceId, 'chatwoot');
    if (!config?.enabled || !config.url || !config.accountId || !config.token) return;
    if (this.isIgnored(item.chatJid, config)) return;

    await this.mutex.run(`${instanceId}:${item.chatJid}`, async () => {
      try {
        await this.forward(instanceId, config, item);
      } catch (err) {
        const status = (err as AxiosError).response?.status;
        this.logger.warn(`Chatwoot: falha ao registrar mensagem (${maskJid(item.chatJid)}): ${status ?? describeError(err)}`);
      }
    });
  }

  private async forward(instanceId: string, config: ChatwootSettings, item: ForwardItem, retry = true) {
    const api = await this.client(config);
    const inboxId = await this.ensureInbox(instanceId, config);
    const contact = await this.ensureContact(instanceId, config, inboxId, item.chatJid, item.pushName);
    const conversationId = await this.ensureConversation(instanceId, config, inboxId, contact, item.chatJid);

    const messageType = item.fromMe ? 'outgoing' : 'incoming';
    const sourceId = `WAID:${item.waId}`;
    const attachment = item.raw ? await this.downloadAttachment(instanceId, item.raw) : null;

    try {
      let created: any;
      if (attachment) {
        const form = new FormData();
        form.append('content', item.text ?? '');
        form.append('message_type', messageType);
        form.append('private', 'false');
        form.append('source_id', sourceId);
        form.append('attachments[]', new Blob([new Uint8Array(attachment.buffer)], { type: attachment.mimetype }), attachment.filename);
        created = (await api.post(`/conversations/${conversationId}/messages`, form)).data;
      } else {
        if (!item.text) return;
        created = (
          await api.post(`/conversations/${conversationId}/messages`, {
            content: item.text,
            message_type: messageType,
            private: false,
            source_id: sourceId,
          })
        ).data;
      }
      if (created?.id) this.ownMessages.set(created.id, true);
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (retry && (status === 404 || status === 422)) {
        // Conversa removida/fechada no Chatwoot: recria e tenta uma vez.
        this.conversations.delete(`${instanceId}:${item.chatJid}`);
        return this.forward(instanceId, config, item, false);
      }
      throw err;
    }
  }

  private async ensureInbox(instanceId: string, config: ChatwootSettings): Promise<number> {
    const cached = this.inboxes.get(instanceId);
    if (cached) return cached;

    const api = await this.client(config);
    const name = config.nameInbox?.trim() || `WhatsApp ${instanceId.slice(0, 8)}`;
    const webhookUrl = `${env.publicUrl}/chatwoot/webhook/${instanceId}?token=${ChatwootService.webhookToken(instanceId)}`;

    const { data } = await api.get('/inboxes');
    const existing = (data?.payload ?? []).find((inbox: any) => inbox.name === name);
    let inboxId: number;

    if (existing) {
      inboxId = existing.id;
      if (existing.webhook_url !== webhookUrl) {
        await api.patch(`/inboxes/${inboxId}`, { channel: { webhook_url: webhookUrl } }).catch((err) =>
          this.logger.warn(`Chatwoot: não foi possível atualizar o webhook da inbox: ${describeError(err)}`),
        );
      }
    } else {
      if (!config.autoCreate) throw new Error(`Inbox "${name}" não existe e a criação automática está desativada`);
      const created = await api.post('/inboxes', {
        name,
        avatar_url: config.logo || undefined,
        channel: { type: 'api', webhook_url: webhookUrl },
      });
      inboxId = created.data?.id;
      this.logger.log(`Chatwoot: inbox "${name}" criada`);
    }

    if (!inboxId) throw new Error('Inbox inválida');
    this.inboxes.set(instanceId, inboxId);
    return inboxId;
  }

  private async ensureContact(instanceId: string, config: ChatwootSettings, inboxId: number, jid: string, pushName: string | null) {
    const cacheKey = `${instanceId}:${jid}`;
    const cached = this.contacts.get(cacheKey);
    if (cached) return cached;

    const api = await this.client(config);
    const phone = isPnJid(jid) ? `+${jidToPhone(jid)}` : undefined;
    const contact = (await this.findContact(api, jid, phone)) ?? (await this.createContact(api, jid, phone, pushName));

    // Atualiza o nome quando o contato foi criado só com o número.
    if (pushName && contact.name && /^\+?\d+$/.test(contact.name)) {
      api.put(`/contacts/${contact.id}`, { name: pushName }).catch(() => undefined);
    }

    const sourceId = await this.ensureContactInbox(api, contact.id, inboxId, jid);
    const ref = { id: contact.id, sourceId };
    this.contacts.set(cacheKey, ref);
    return ref;
  }

  private async findContact(api: any, jid: string, phone?: string) {
    for (const q of [jid, phone?.slice(1)].filter(Boolean)) {
      const { data } = await api.get('/contacts/search', { params: { q } });
      const match = (data?.payload ?? []).find(
        (c: any) => c.identifier === jid || (phone && (c.phone_number === phone || c.phone_number === phone.slice(1))),
      );
      if (match) return match;
    }
    return null;
  }

  private async createContact(api: any, jid: string, phone: string | undefined, pushName: string | null) {
    try {
      const { data } = await api.post('/contacts', {
        name: pushName || phone || jidToPhone(jid),
        identifier: jid,
        ...(phone ? { phone_number: phone } : {}),
      });
      const contact = data?.payload?.contact ?? data?.payload ?? data;
      if (!contact?.id) throw new Error('Contato inválido');
      return contact;
    } catch (err) {
      // Criado em paralelo por outro processo: busca novamente.
      if ((err as AxiosError).response?.status === 422) {
        const found = await this.findContact(api, jid, phone);
        if (found) return found;
      }
      throw err;
    }
  }

  private async ensureContactInbox(api: any, contactId: number, inboxId: number, jid: string): Promise<string> {
    try {
      const { data } = await api.post(`/contacts/${contactId}/contact_inboxes`, { inbox_id: inboxId, source_id: jid });
      return data?.source_id ?? jid;
    } catch {
      const { data } = await api.get(`/contacts/${contactId}`);
      const inboxes = data?.payload?.contact_inboxes ?? [];
      const match = inboxes.find((ci: any) => ci.inbox?.id === inboxId);
      if (!match?.source_id) throw new Error('Não foi possível vincular o contato à inbox');
      return match.source_id;
    }
  }

  private async ensureConversation(instanceId: string, config: ChatwootSettings, inboxId: number, contact: ContactRef, jid: string) {
    const cacheKey = `${instanceId}:${jid}`;
    const cached = this.conversations.get(cacheKey);
    if (cached) return cached;

    const api = await this.client(config);
    const { data } = await api.get(`/contacts/${contact.id}/conversations`);
    const conversations: any[] = (data?.payload ?? [])
      .filter((c: any) => c.inbox_id === inboxId)
      .sort((a: any, b: any) => b.id - a.id);

    let conversationId: number | undefined = conversations.find((c) => c.status !== 'resolved')?.id;

    if (!conversationId && config.reopenConversation && conversations[0]) {
      conversationId = conversations[0].id;
      await api
        .post(`/conversations/${conversationId}/toggle_status`, { status: config.conversationPending ? 'pending' : 'open' })
        .catch(() => undefined);
    }

    if (!conversationId) {
      const created = await api.post('/conversations', {
        source_id: contact.sourceId,
        inbox_id: inboxId,
        contact_id: contact.id,
        status: config.conversationPending ? 'pending' : 'open',
      });
      conversationId = created.data?.id;
    }

    if (!conversationId) throw new Error('Conversa inválida');
    this.conversations.set(cacheKey, conversationId);
    return conversationId;
  }

  // ───────────────────────────── Chatwoot → WhatsApp ─────────────────────────────

  async handleWebhook(instanceId: string, body: any) {
    const event = body?.event;

    if (event === 'conversation_status_changed' && body.status === 'resolved') {
      this.conversations.deleteWhere((key, value) => key.startsWith(`${instanceId}:`) && value === body.id);
      return;
    }
    if (event !== 'message_created' || body.message_type !== 'outgoing' || body.private) return;
    if (typeof body.source_id === 'string' && body.source_id.startsWith('WAID:')) return;

    // Pequena espera: a resposta da nossa própria criação pode chegar depois do webhook.
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (this.ownMessages.has(body.id)) return;

    const config = await this.configs.resolve(instanceId, 'chatwoot');
    if (!config?.enabled) return;

    const conversation = body.conversation ?? {};
    const sourceId: string | undefined = conversation.contact_inbox?.source_id;
    const metaSender = conversation.meta?.sender ?? {};
    const jid =
      (sourceId && sourceId.includes('@') ? sourceId : null) ||
      (typeof metaSender.identifier === 'string' && metaSender.identifier.includes('@') ? metaSender.identifier : null) ||
      (metaSender.phone_number ? `${String(metaSender.phone_number).replace(/\D/g, '')}@s.whatsapp.net` : null);
    if (!jid) {
      this.logger.warn('Chatwoot: webhook sem destinatário identificável');
      return;
    }
    if (conversation.id) this.conversations.set(`${instanceId}:${jid}`, conversation.id);

    let text: string = body.content ?? '';
    if (text && config.signMessages && body.sender?.type === 'user') {
      const name = body.sender.available_name || body.sender.name;
      if (name) text = `*${name}:*${config.signDelimiter || '\n'}${text}`;
    }

    const attachments: any[] = Array.isArray(body.attachments) ? body.attachments : [];
    try {
      if (attachments.length === 0) {
        if (text) await this.sender.send(instanceId, jid, { text }, { source: 'chatwoot', preview: text });
        return;
      }
      let captionUsed = false;
      for (const attachment of attachments) {
        const kind = this.attachmentKind(attachment.file_type);
        const canCaption = kind !== 'audio' && !captionUsed && !!text;
        await this.messages.sendMediaTo(
          instanceId,
          jid,
          { kind, url: attachment.data_url, caption: canCaption ? text : undefined, ptt: kind === 'audio', filename: attachment.file_name },
          'chatwoot',
        );
        if (canCaption) captionUsed = true;
      }
      if (text && !captionUsed) await this.sender.send(instanceId, jid, { text }, { source: 'chatwoot', preview: text });
    } catch (err) {
      this.logger.warn(`Chatwoot → WhatsApp falhou (${maskJid(jid)}): ${describeError(err)}`);
    }
  }

  // ───────────────────────────── Auxiliares ─────────────────────────────

  private async client(config: ChatwootSettings) {
    const base = config.url.replace(/\/+$/, '');
    await assertSafeUrl(base, 'URL do Chatwoot');
    return {
      get: (path: string, opts: any = {}) => outbound.get(`${base}/api/v1/accounts/${config.accountId}${path}`, this.opts(config, opts)),
      post: (path: string, body: any, opts: any = {}) =>
        outbound.post(`${base}/api/v1/accounts/${config.accountId}${path}`, body, this.opts(config, opts)),
      put: (path: string, body: any) => outbound.put(`${base}/api/v1/accounts/${config.accountId}${path}`, body, this.opts(config)),
      patch: (path: string, body: any) => outbound.patch(`${base}/api/v1/accounts/${config.accountId}${path}`, body, this.opts(config)),
    };
  }

  private opts(config: ChatwootSettings, extra: any = {}) {
    return {
      timeout: 20_000,
      maxBodyLength: env.mediaMaxBytes,
      ...extra,
      headers: { api_access_token: config.token, ...(extra.headers ?? {}) },
    };
  }

  private isIgnored(jid: string, config: ChatwootSettings) {
    if (!config.ignoreJids) return false;
    const phone = jidToPhone(jid);
    return config.ignoreJids
      .split(',')
      .map((j) => j.trim())
      .filter(Boolean)
      .some((entry) => entry === jid || jidToPhone(entry) === phone);
  }

  private attachmentKind(fileType: string): MediaKind {
    if (fileType === 'image' || fileType === 'video' || fileType === 'audio') return fileType;
    return 'document';
  }

  /** Texto amigável para mensagens sem texto (localização, contato, etc.). */
  private describe(raw: WAMessage): string {
    const content = normalizeMessageContent(raw.message);
    if (content?.locationMessage) {
      const { degreesLatitude: lat, degreesLongitude: lng, name } = content.locationMessage;
      return `📍 ${name ? `${name} - ` : ''}https://maps.google.com/?q=${lat},${lng}`;
    }
    if (content?.contactMessage) return `📇 Contato: ${content.contactMessage.displayName ?? ''}`;
    if (content?.contactsArrayMessage) return `📇 ${content.contactsArrayMessage.contacts?.length ?? 0} contatos`;
    if (content?.pollCreationMessage || content?.pollCreationMessageV3) {
      const poll = content.pollCreationMessage ?? content.pollCreationMessageV3;
      return `📊 ${poll?.name ?? 'Enquete'}`;
    }
    if (content?.stickerMessage) return '[figurinha]';
    return '';
  }

  private async downloadAttachment(instanceId: string, raw: WAMessage) {
    const content = normalizeMessageContent(raw.message);
    const type = getContentType(content);
    const media = type ? (content as any)[type] : null;
    if (!media) return null;
    if (Number(media.fileLength ?? 0) > env.mediaMaxBytes) return null;

    try {
      const socket = this.baileys.getSocket(instanceId);
      const buffer = await downloadMediaMessage(
        raw,
        'buffer',
        {},
        socket ? { reuploadRequest: socket.updateMediaMessage, logger: silentLogger as any } : undefined,
      );
      const mimetype: string = (media.mimetype ?? 'application/octet-stream').split(';')[0];
      const ext = mimetype.split('/')[1]?.replace('mpeg', 'mp3') ?? 'bin';
      return { buffer: buffer as Buffer, mimetype, filename: media.fileName || `${type?.replace('Message', '')}.${ext}` };
    } catch (err) {
      this.logger.debug(`Chatwoot: falha ao baixar mídia: ${describeError(err)}`);
      return null;
    }
  }
}
