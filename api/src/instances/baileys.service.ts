import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  getContentType,
  makeCacheableSignalKeyStore,
  makeWASocket,
  normalizeMessageContent,
  proto,
  useMultiFileAuthState,
  type GroupMetadata,
  type WAMessage,
  type WASocket,
} from 'baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import P from 'pino';
import * as QRCode from 'qrcode';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { env } from '../config/env';
import { isBroadcastJid, isGroupJid, isLidJid, isPnJid, jidToPhone } from '../common/utils/jid';
import { maskJid } from '../common/utils/privacy';
import { TtlCache } from '../common/utils/ttl-cache';
import { EventBus, IncomingMessage } from '../shared/event-bus.service';
import { InstanceSettingsService } from '../shared/instance-settings.service';
import { PrismaService } from '../shared/prisma.service';
import { ProxySettings } from '../shared/settings.types';

export type InstanceStatus = 'DISCONNECTED' | 'CONNECTING' | 'WAITING_QR' | 'CONNECTED';

interface Session {
  id: string;
  socket: WASocket | null;
  status: InstanceStatus;
  qr: string | null;
  qrAttempts: number;
  phone: string | null;
  name: string | null;
  profilePic: string | null;
  lastError: string | null;
  /** Incrementado a cada novo socket: eventos de sockets antigos são descartados. */
  generation: number;
  reconnectAttempts: number;
  reconnectTimer: NodeJS.Timeout | null;
  /** Indica parada intencional (restart/logout/shutdown): não reconectar. */
  stopping: boolean;
}

export interface ContactInfo {
  id: string;
  phone: string;
  name: string | null;
}

const MAX_QR_ATTEMPTS = 6;
const MAX_BACKOFF_MS = 5 * 60_000;
const MESSAGE_STATUS = ['ERROR', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'PLAYED'];

/**
 * Gerencia o ciclo de vida das conexões WhatsApp (uma por instância).
 *
 * Garantias:
 * - Nunca mantém dois sockets ativos para a mesma instância (evita o loop "connectionReplaced").
 * - Reconexão com backoff exponencial e somente para falhas transitórias
 *   (nunca insiste em 401/403/440/411/500, que indicam logout, bloqueio ou sessão em outro lugar).
 * - Restaura sessões salvas ao iniciar, de forma escalonada.
 * - Mensagens de histórico/offline ("append") não disparam automações.
 */
@Injectable()
export class BaileysService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BaileysService.name);
  private readonly waLogger = P({ level: 'silent' });
  private readonly sessions = new Map<string, Session>();
  private readonly starting = new Map<string, Promise<void>>();
  private readonly contacts = new Map<string, Map<string, ContactInfo>>();
  /** Mensagens enviadas recentemente, usadas pelo Baileys para reenvio (retry receipts). */
  private readonly sentMessages = new TtlCache<string, proto.IMessage>(10 * 60_000, 5_000);
  private readonly groupCache = new TtlCache<string, GroupMetadata>(5 * 60_000, 2_000);
  private waVersion: { version: [number, number, number]; fetchedAt: number } | null = null;
  private readonly sessionsRoot = path.resolve(env.sessionsDir);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: InstanceSettingsService,
    private readonly bus: EventBus,
  ) {}

  // ───────────────────────────── Ciclo de vida da aplicação ─────────────────────────────

  async onApplicationBootstrap() {
    fs.mkdirSync(this.sessionsRoot, { recursive: true });
    if (!env.restoreSessionsOnBoot) return;

    const instances = await this.prisma.instance.findMany({ select: { id: true } });
    const restorable = instances.filter((i) => this.hasSavedSession(i.id));
    if (restorable.length === 0) return;

    this.logger.log(`Restaurando ${restorable.length} sessão(ões) salvas...`);
    // Escalonado para não abrir dezenas de conexões no mesmo segundo.
    restorable.forEach((instance, index) => {
      setTimeout(() => this.start(instance.id).catch((err) => this.logger.warn(`Restore ${instance.id}: ${err.message}`)), index * 1500);
    });
  }

  async onApplicationShutdown() {
    for (const session of this.sessions.values()) {
      session.stopping = true;
      if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
      try {
        session.socket?.end(undefined);
      } catch {
        /* já encerrado */
      }
    }
  }

  // ───────────────────────────── Consultas ─────────────────────────────

  getStatus(instanceId: string): InstanceStatus {
    return this.sessions.get(instanceId)?.status ?? 'DISCONNECTED';
  }

  getQR(instanceId: string) {
    return this.sessions.get(instanceId)?.qr ?? null;
  }

  getInfo(instanceId: string) {
    const s = this.sessions.get(instanceId);
    return {
      status: s?.status ?? ('DISCONNECTED' as InstanceStatus),
      phone: s?.phone ?? null,
      profileName: s?.name ?? null,
      profilePic: s?.profilePic ?? null,
      lastError: s?.lastError ?? null,
    };
  }

  countConnected() {
    let total = 0;
    for (const s of this.sessions.values()) if (s.status === 'CONNECTED') total++;
    return total;
  }

  /** Socket apenas quando conectado; caso contrário lança erro amigável. */
  requireSocket(instanceId: string): WASocket {
    const session = this.sessions.get(instanceId);
    if (!session?.socket || session.status !== 'CONNECTED') {
      throw new BadRequestException('Instância não está conectada ao WhatsApp');
    }
    return session.socket;
  }

  getSocket(instanceId: string): WASocket | null {
    const session = this.sessions.get(instanceId);
    return session?.status === 'CONNECTED' ? session.socket : null;
  }

  getContacts(instanceId: string): ContactInfo[] {
    return [...(this.contacts.get(instanceId)?.values() ?? [])];
  }

  getContactName(instanceId: string, jid: string): string | null {
    return this.contacts.get(instanceId)?.get(jid)?.name ?? null;
  }

  async getGroupMetadata(instanceId: string, jid: string): Promise<GroupMetadata> {
    const key = `${instanceId}:${jid}`;
    const cached = this.groupCache.get(key);
    if (cached) return cached;
    const metadata = await this.requireSocket(instanceId).groupMetadata(jid);
    this.groupCache.set(key, metadata);
    return metadata;
  }

  async getAllGroups(instanceId: string): Promise<GroupMetadata[]> {
    const groups = await this.requireSocket(instanceId).groupFetchAllParticipating();
    for (const g of Object.values(groups)) this.groupCache.set(`${instanceId}:${g.id}`, g);
    return Object.values(groups);
  }

  /** Registra mensagem enviada para permitir reenvio sob demanda do WhatsApp. */
  rememberSent(instanceId: string, message: WAMessage) {
    if (message?.key?.id && message.message) this.sentMessages.set(`${instanceId}:${message.key.id}`, message.message);
  }

  // ───────────────────────────── Controle da conexão ─────────────────────────────

  /** Inicia a conexão (idempotente) e aguarda QR ou conexão aberta. */
  async connect(instanceId: string, waitMs = 20_000): Promise<{ status: InstanceStatus; qr: string | null }> {
    await this.start(instanceId);
    await this.waitFor(instanceId, (s) => !!s.qr || s.status === 'CONNECTED' || s.status === 'DISCONNECTED', waitMs);
    return { status: this.getStatus(instanceId), qr: this.getQR(instanceId) };
  }

  /** Abre uma conexão se ainda não houver uma ativa. Chamadas concorrentes compartilham a mesma promessa. */
  start(instanceId: string): Promise<void> {
    const session = this.sessions.get(instanceId);
    if (session?.socket && session.status !== 'DISCONNECTED') return Promise.resolve();

    const pending = this.starting.get(instanceId);
    if (pending) return pending;

    const promise = this.openSocket(instanceId).finally(() => this.starting.delete(instanceId));
    this.starting.set(instanceId, promise);
    return promise;
  }

  /** Fecha e reabre mantendo a sessão (não pede QR se já autenticado). */
  async restart(instanceId: string) {
    await this.stop(instanceId);
    return this.connect(instanceId);
  }

  /** Desconecta e invalida a sessão no aparelho (exige novo QR). */
  async logout(instanceId: string) {
    const session = this.sessions.get(instanceId);
    if (session) {
      session.stopping = true;
      this.clearReconnect(session);
      try {
        if (session.status === 'CONNECTED') await session.socket?.logout();
      } catch (err) {
        this.logger.debug(`logout ${instanceId}: ${(err as Error).message}`);
      }
      this.disposeSocket(session);
      this.setStatus(session, 'DISCONNECTED');
    }
    this.clearAuthState(instanceId);
    this.bus.publish(instanceId, 'LOGOUT_INSTANCE', { instance: instanceId });
  }

  /** Remove completamente a instância da memória e do disco. */
  async remove(instanceId: string) {
    await this.logout(instanceId);
    this.sessions.delete(instanceId);
    this.contacts.delete(instanceId);
    this.groupCache.deleteWhere((k) => k.startsWith(`${instanceId}:`));
    fs.rmSync(this.authDir(instanceId), { recursive: true, force: true });
    this.bus.publish(instanceId, 'REMOVE_INSTANCE', { instance: instanceId });
  }

  /** Aplica alterações de comportamento no socket ativo (sem reconectar). */
  async applySettings(instanceId: string) {
    const socket = this.getSocket(instanceId);
    if (!socket) return;
    const settings = await this.settingsService.get(instanceId);
    await socket.sendPresenceUpdate(settings.alwaysOnline ? 'available' : 'unavailable').catch(() => undefined);
  }

  private async stop(instanceId: string) {
    const session = this.sessions.get(instanceId);
    if (!session) return;
    session.stopping = true;
    this.clearReconnect(session);
    this.disposeSocket(session);
    this.setStatus(session, 'DISCONNECTED');
  }

  // ───────────────────────────── Socket ─────────────────────────────

  private async openSocket(instanceId: string) {
    const meta = await this.settingsService.getMeta(instanceId);
    if (!meta) throw new BadRequestException('Instância não encontrada');

    const session = this.ensureSession(instanceId);
    this.clearReconnect(session);
    this.disposeSocket(session);
    session.stopping = false;
    session.qr = null;
    session.lastError = null;
    const generation = ++session.generation;

    const settings = await this.settingsService.get(instanceId);
    const authDir = this.authDir(instanceId);
    fs.mkdirSync(authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const version = await this.getWaVersion();
    const agent = this.createProxyAgent(settings.proxy);

    if (!state.creds.registered) session.qrAttempts = 0;
    this.setStatus(session, 'CONNECTING');

    const socket = makeWASocket({
      ...(version ? { version } : {}),
      logger: this.waLogger,
      // [nome exibido em "Aparelhos conectados", plataforma, versão]
      browser: [env.waBrowserName, 'Chrome', '124.0.0'],
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, this.waLogger) },
      markOnlineOnConnect: settings.alwaysOnline,
      syncFullHistory: settings.syncFullHistory,
      generateHighQualityLinkPreview: false,
      agent,
      fetchAgent: agent,
      getMessage: async (key) => this.sentMessages.get(`${instanceId}:${key.id}`),
      cachedGroupMetadata: async (jid) => this.groupCache.get(`${instanceId}:${jid}`),
    });
    session.socket = socket;

    const alive = () => session.generation === generation && !session.stopping;

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', (update) => {
      if (session.generation !== generation) return;
      this.handleConnectionUpdate(session, generation, update).catch((err) =>
        this.logger.error(`connection.update ${instanceId}: ${err.message}`),
      );
    });

    socket.ev.on('messages.upsert', ({ messages, type }) => {
      if (!alive()) return;
      this.handleMessagesUpsert(instanceId, messages, type).catch((err) =>
        this.logger.error(`messages.upsert ${instanceId}: ${err.message}`),
      );
    });

    socket.ev.on('messages.update', (updates) => {
      if (!alive()) return;
      this.handleMessageStatus(instanceId, updates);
      this.bus.publish(instanceId, 'MESSAGES_UPDATE', updates);
    });

    socket.ev.on('messages.delete', (data) => alive() && this.bus.publish(instanceId, 'MESSAGES_DELETE', data));
    socket.ev.on('chats.upsert', (data) => alive() && this.bus.publish(instanceId, 'CHATS_UPSERT', data));
    socket.ev.on('chats.update', (data) => alive() && this.bus.publish(instanceId, 'CHATS_UPDATE', data));
    socket.ev.on('chats.delete', (data) => alive() && this.bus.publish(instanceId, 'CHATS_DELETE', data));
    socket.ev.on('presence.update', (data) => alive() && this.bus.publish(instanceId, 'PRESENCE_UPDATE', data));
    socket.ev.on('labels.edit', (data) => alive() && this.bus.publish(instanceId, 'LABELS_EDIT', data));
    socket.ev.on('labels.association', (data) => alive() && this.bus.publish(instanceId, 'LABELS_ASSOCIATION', data));

    socket.ev.on('contacts.upsert', (contacts) => {
      if (!alive()) return;
      this.storeContacts(instanceId, contacts);
      this.bus.publish(instanceId, 'CONTACTS_UPSERT', contacts);
    });
    socket.ev.on('contacts.update', (contacts) => {
      if (!alive()) return;
      this.storeContacts(instanceId, contacts as any);
      this.bus.publish(instanceId, 'CONTACTS_UPDATE', contacts);
    });

    socket.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {
      if (!alive()) return;
      this.storeContacts(instanceId, contacts);
      // Apenas resumo: o histórico completo pode ter milhares de itens.
      this.bus.publish(instanceId, 'CHATS_SET', { count: chats.length, isLatest });
      this.bus.publish(instanceId, 'CONTACTS_SET', { count: contacts.length, isLatest });
      this.bus.publish(instanceId, 'MESSAGES_SET', { count: messages.length, isLatest });
    });

    socket.ev.on('groups.upsert', (groups) => {
      if (!alive()) return;
      for (const g of groups) this.groupCache.set(`${instanceId}:${g.id}`, g);
      this.bus.publish(instanceId, 'GROUPS_UPSERT', groups);
    });
    socket.ev.on('groups.update', (updates) => {
      if (!alive()) return;
      for (const u of updates) if (u.id) this.groupCache.delete(`${instanceId}:${u.id}`);
      this.bus.publish(instanceId, 'GROUP_UPDATE', updates);
    });
    socket.ev.on('group-participants.update', (update) => {
      if (!alive()) return;
      this.groupCache.delete(`${instanceId}:${update.id}`);
      this.bus.publish(instanceId, 'GROUP_PARTICIPANTS_UPDATE', update);
    });

    socket.ev.on('call', (calls) => {
      if (!alive()) return;
      this.bus.publish(instanceId, 'CALL', calls);
      this.handleCalls(instanceId, socket, calls).catch((err) => this.logger.warn(`call ${instanceId}: ${err.message}`));
    });
  }

  private async handleConnectionUpdate(session: Session, generation: number, update: any) {
    const { connection, lastDisconnect, qr } = update;
    const instanceId = session.id;

    if (qr) {
      session.qrAttempts++;
      if (session.qrAttempts > MAX_QR_ATTEMPTS) {
        // QR não escaneado: para de gerar códigos para não manter conexões ociosas abertas.
        session.lastError = 'QR Code expirou sem leitura. Gere um novo para conectar.';
        this.logger.log(`Instância ${instanceId}: QR expirado, conexão pausada`);
        await this.stop(instanceId);
        return;
      }
      session.qr = qr;
      this.setStatus(session, 'WAITING_QR');
      const base64 = await QRCode.toDataURL(qr).catch(() => null);
      this.bus.publish(instanceId, 'QRCODE_UPDATED', { qrcode: { code: qr, base64 }, attempt: session.qrAttempts });
    }

    if (connection === 'open') {
      session.qr = null;
      session.qrAttempts = 0;
      session.reconnectAttempts = 0;
      session.lastError = null;
      const user = session.socket?.user;
      session.phone = user?.id ? jidToPhone(user.id) : null;
      session.name = user?.name || (user as any)?.verifiedName || null;
      this.setStatus(session, 'CONNECTED');
      this.logger.log(`Instância ${instanceId} conectada (${maskJid(session.phone)})`);

      this.prisma.instance
        .update({ where: { id: instanceId }, data: { phone: session.phone } })
        .catch(() => undefined);
      this.applySettings(instanceId).catch(() => undefined);
      if (user?.id) {
        session.socket
          ?.profilePictureUrl(user.id, 'image')
          .then((url) => session.generation === generation && (session.profilePic = url ?? null))
          .catch(() => undefined);
      }
      return;
    }

    if (connection !== 'close') return;
    if (session.stopping || session.generation !== generation) return;

    const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
    session.socket = null;
    session.qr = null;

    const fatal: Record<number, string> = {
      [DisconnectReason.loggedOut]: 'Sessão encerrada no aparelho. Leia o QR Code novamente.',
      [DisconnectReason.forbidden]: 'O WhatsApp recusou a conexão (403). Verifique se o número está restrito.',
      [DisconnectReason.connectionReplaced]: 'Sessão aberta em outro local. Reconecte manualmente se desejar.',
      [DisconnectReason.multideviceMismatch]: 'Incompatibilidade de multi-dispositivo. Conecte novamente.',
      [DisconnectReason.badSession]: 'Sessão corrompida. Conecte novamente.',
    };

    if (code !== undefined && fatal[code]) {
      session.lastError = fatal[code];
      this.setStatus(session, 'DISCONNECTED');
      this.logger.warn(`Instância ${instanceId} desconectada (${code}): sem reconexão automática`);
      if (code !== DisconnectReason.connectionReplaced && code !== DisconnectReason.forbidden) {
        this.clearAuthState(instanceId);
        this.bus.publish(instanceId, 'LOGOUT_INSTANCE', { instance: instanceId, reason: code });
      }
      return;
    }

    if (code === DisconnectReason.restartRequired) {
      this.scheduleReconnect(session, 0);
      return;
    }

    // Sem credenciais registradas e timeout: o QR expirou, não insistir.
    if (!this.hasSavedSession(instanceId) && code === DisconnectReason.timedOut) {
      session.lastError = 'QR Code expirou sem leitura. Gere um novo para conectar.';
      this.setStatus(session, 'DISCONNECTED');
      return;
    }

    const delay = Math.min(2_000 * 2 ** session.reconnectAttempts, MAX_BACKOFF_MS) + Math.floor(Math.random() * 1_000);
    session.reconnectAttempts++;
    session.lastError = `Conexão perdida (${code ?? 'desconhecido'}). Reconectando...`;
    this.setStatus(session, 'CONNECTING');
    this.logger.warn(`Instância ${instanceId} caiu (${code}); nova tentativa em ${Math.round(delay / 1000)}s`);
    this.scheduleReconnect(session, delay);
  }

  private async handleMessagesUpsert(instanceId: string, messages: WAMessage[], type: string) {
    const settings = await this.settingsService.get(instanceId);
    const socket = this.getSocket(instanceId);

    for (const msg of messages) {
      const rawJid = msg.key?.remoteJid;
      if (!rawJid || !msg.message) continue;
      if (msg.pushName && !msg.key.fromMe) this.rememberPushName(instanceId, msg);

      if (rawJid === 'status@broadcast') {
        if (type === 'notify' && settings.readStatus && !msg.key.fromMe) {
          await socket?.readMessages([msg.key]).catch(() => undefined);
        }
        continue;
      }
      if (settings.ignoreGroups && isGroupJid(rawJid)) continue;

      // Histórico e mensagens offline chegam como "append": não disparam automações nem webhooks.
      if (type !== 'notify') continue;

      const normalized = this.normalize(instanceId, msg);
      if (!normalized) continue;

      if (settings.readMessages && !msg.key.fromMe && !isBroadcastJid(rawJid)) {
        await socket?.readMessages([msg.key]).catch(() => undefined);
      }

      this.bus.publish(instanceId, 'MESSAGES_UPSERT', {
        key: msg.key,
        pushName: msg.pushName ?? null,
        chatJid: normalized.chatJid,
        messageType: normalized.type,
        text: normalized.text,
        buttonId: normalized.buttonId,
        message: msg.message,
        messageTimestamp: normalized.timestamp,
      });
      this.bus.emitIncoming(normalized);
    }
  }

  /** Normaliza a mensagem e resolve o JID de telefone quando o WhatsApp usa endereçamento @lid. */
  normalize(instanceId: string, msg: WAMessage): IncomingMessage | null {
    const key = msg.key;
    const rawJid = key.remoteJid!;
    const alt = (key as any).remoteJidAlt as string | undefined;
    const chatJid = isLidJid(rawJid) && alt && isPnJid(alt) ? alt : rawJid;

    const content = normalizeMessageContent(msg.message);
    const type = getContentType(content) ?? 'unknown';
    if (type === 'protocolMessage' || type === 'senderKeyDistributionMessage' || type === 'reactionMessage') return null;

    const text =
      content?.conversation ||
      content?.extendedTextMessage?.text ||
      content?.imageMessage?.caption ||
      content?.videoMessage?.caption ||
      content?.documentMessage?.caption ||
      content?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
      content?.buttonsResponseMessage?.selectedDisplayText ||
      content?.listResponseMessage?.title ||
      content?.templateButtonReplyMessage?.selectedDisplayText ||
      content?.interactiveResponseMessage?.body?.text ||
      '';

    // Id do botão tocado (botões interativos, legados ou lista).
    let buttonId: string | null =
      content?.buttonsResponseMessage?.selectedButtonId ||
      content?.templateButtonReplyMessage?.selectedId ||
      content?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      null;
    const paramsJson = content?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (!buttonId && paramsJson) {
      try {
        buttonId = JSON.parse(paramsJson)?.id ?? null;
      } catch {
        /* payload inesperado */
      }
    }

    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'documentWithCaptionMessage'];
    const ts = Number(msg.messageTimestamp ?? Math.floor(Date.now() / 1000));

    return {
      instanceId,
      id: key.id ?? '',
      chatJid,
      rawJid,
      fromMe: !!key.fromMe,
      isGroup: isGroupJid(rawJid),
      pushName: msg.pushName ?? this.getContactName(instanceId, chatJid),
      text: text.trim(),
      buttonId,
      type,
      hasMedia: mediaTypes.includes(type),
      timestamp: ts,
      raw: msg,
    };
  }

  private handleMessageStatus(instanceId: string, updates: Array<{ key: any; update: any }>) {
    for (const { key, update } of updates) {
      if (!key?.fromMe || !key.id || update?.status === undefined || update.status === null) continue;
      const status = MESSAGE_STATUS[update.status] ?? 'SENT';
      this.prisma.message
        .updateMany({ where: { instanceId, messageId: key.id }, data: { status } })
        .catch(() => undefined);
    }
  }

  private async handleCalls(instanceId: string, socket: WASocket, calls: any[]) {
    const settings = await this.settingsService.get(instanceId);
    if (!settings.rejectCalls) return;
    for (const call of calls) {
      if (call.status !== 'offer') continue;
      await socket.rejectCall(call.id, call.from).catch(() => undefined);
      if (settings.rejectCallMessage && !call.isGroup) {
        await socket.sendMessage(call.from, { text: settings.rejectCallMessage }).catch(() => undefined);
      }
      this.logger.log(`Chamada rejeitada (${maskJid(call.from)}) na instância ${instanceId}`);
    }
  }

  // ───────────────────────────── Auxiliares ─────────────────────────────

  private ensureSession(instanceId: string): Session {
    let session = this.sessions.get(instanceId);
    if (!session) {
      session = {
        id: instanceId,
        socket: null,
        status: 'DISCONNECTED',
        qr: null,
        qrAttempts: 0,
        phone: null,
        name: null,
        profilePic: null,
        lastError: null,
        generation: 0,
        reconnectAttempts: 0,
        reconnectTimer: null,
        stopping: false,
      };
      this.sessions.set(instanceId, session);
    }
    return session;
  }

  private setStatus(session: Session, status: InstanceStatus) {
    const changed = session.status !== status;
    session.status = status;
    if (!changed) return;

    this.prisma.instance.update({ where: { id: session.id }, data: { status } }).catch(() => undefined);
    const state = status === 'CONNECTED' ? 'open' : status === 'DISCONNECTED' ? 'close' : 'connecting';
    this.bus.publish(session.id, 'CONNECTION_UPDATE', {
      state,
      status,
      phone: session.phone,
      reason: session.lastError,
    });
  }

  private scheduleReconnect(session: Session, delayMs: number) {
    this.clearReconnect(session);
    session.reconnectTimer = setTimeout(() => {
      session.reconnectTimer = null;
      if (session.stopping) return;
      this.start(session.id).catch((err) => {
        this.logger.warn(`Reconexão ${session.id} falhou: ${err.message}`);
        this.scheduleReconnect(session, Math.min(30_000 * (session.reconnectAttempts + 1), MAX_BACKOFF_MS));
      });
    }, delayMs);
  }

  private clearReconnect(session: Session) {
    if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }

  private disposeSocket(session: Session) {
    const socket = session.socket;
    session.socket = null;
    session.qr = null;
    if (!socket) return;
    try {
      socket.ev.removeAllListeners(undefined as any);
    } catch {
      /* ignore */
    }
    try {
      socket.end(undefined);
    } catch {
      /* ignore */
    }
  }

  private waitFor(instanceId: string, predicate: (s: Session) => boolean, timeoutMs: number) {
    return new Promise<void>((resolve) => {
      const started = Date.now();
      const tick = () => {
        const session = this.sessions.get(instanceId);
        if (!session || predicate(session) || Date.now() - started >= timeoutMs) return resolve();
        setTimeout(tick, 300);
      };
      tick();
    });
  }

  /** Versão do WhatsApp Web (cache de 6h). Sem resposta, usa a versão embutida na biblioteca. */
  private async getWaVersion(): Promise<[number, number, number] | null> {
    const sixHours = 6 * 60 * 60_000;
    if (this.waVersion && Date.now() - this.waVersion.fetchedAt < sixHours) return this.waVersion.version;
    try {
      const { version, isLatest } = await fetchLatestBaileysVersion();
      if (isLatest !== false || !this.waVersion) {
        this.waVersion = { version: version as [number, number, number], fetchedAt: Date.now() };
      }
    } catch {
      /* mantém a versão anterior */
    }
    return this.waVersion?.version ?? null;
  }

  private createProxyAgent(proxy: ProxySettings): any {
    if (!proxy?.enabled || !proxy.host || !proxy.port) return undefined;
    const auth = proxy.username
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password ?? '')}@`
      : '';
    const url = `${proxy.protocol || 'http'}://${auth}${proxy.host}:${proxy.port}`;
    return proxy.protocol?.startsWith('socks') ? new SocksProxyAgent(url) : new HttpsProxyAgent(url);
  }

  private storeContacts(instanceId: string, contacts: Array<{ id?: string; name?: string; notify?: string; verifiedName?: string }>) {
    if (!contacts?.length) return;
    let map = this.contacts.get(instanceId);
    if (!map) this.contacts.set(instanceId, (map = new Map()));
    for (const c of contacts) {
      if (!c?.id || isGroupJid(c.id) || isBroadcastJid(c.id)) continue;
      const previous = map.get(c.id);
      map.set(c.id, {
        id: c.id,
        phone: isPnJid(c.id) ? jidToPhone(c.id) : '',
        name: c.name || c.notify || c.verifiedName || previous?.name || null,
      });
      if (map.size > 50_000) map.delete(map.keys().next().value as string);
    }
  }

  private rememberPushName(instanceId: string, msg: WAMessage) {
    const alt = (msg.key as any).remoteJidAlt as string | undefined;
    const jid = isPnJid(alt) ? alt! : msg.key.remoteJid!;
    if (isGroupJid(jid)) return;
    const known = this.contacts.get(instanceId)?.get(jid);
    if (!known?.name) this.storeContacts(instanceId, [{ id: jid, notify: msg.pushName ?? undefined }]);
  }

  private authDir(instanceId: string) {
    if (!/^[a-zA-Z0-9-]+$/.test(instanceId)) throw new BadRequestException('Identificador inválido');
    return path.join(this.sessionsRoot, instanceId);
  }

  private hasSavedSession(instanceId: string) {
    try {
      const creds = JSON.parse(fs.readFileSync(path.join(this.authDir(instanceId), 'creds.json'), 'utf-8'));
      return !!creds?.registered || !!creds?.me;
    } catch {
      return false;
    }
  }

  private clearAuthState(instanceId: string) {
    const dir = this.authDir(instanceId);
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      // Mantém apenas arquivos que não são credenciais (ex: settings.json.migrated).
      if (file.endsWith('.migrated')) continue;
      fs.rmSync(path.join(dir, file), { recursive: true, force: true });
    }
  }
}
