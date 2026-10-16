import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AnyMessageContent, WAMessage } from 'baileys';
import { describeError } from '../common/utils/errors';
import { downloadBuffer } from '../common/utils/net';
import { jidToPhone } from '../common/utils/jid';
import { MessageSenderService } from '../instances/message-sender.service';
import { MessageSource } from '../shared/event-bus.service';
import { PrismaService } from '../shared/prisma.service';
import {
  SendAudioBody,
  SendContactBody,
  SendDocumentBody,
  SendImageBody,
  SendLocationBody,
  SendPollBody,
  SendTextBody,
  SendVideoBody,
} from './dto/message.dto';
import { auditableUrl, convertToOggOpus, filenameFromUrl, MediaKind, resolveMimeType } from './media.util';

export interface MediaRequest {
  kind: MediaKind;
  url: string;
  caption?: string;
  filename?: string;
  /** Apenas áudio: envia como nota de voz. */
  ptt?: boolean;
}

const NUMBER_EMOJI = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
export const numberEmoji = (n: number) =>
  String(n)
    .split('')
    .map((d) => NUMBER_EMOJI[Number(d)])
    .join('');

/** vCard escapando caracteres que quebrariam o formato. */
const vcardEscape = (value: string) => value.replace(/[\r\n]+/g, ' ').replace(/([;,])/g, '\\$1');

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: MessageSenderService,
  ) {}

  async sendText(instanceId: string, dto: SendTextBody, source: MessageSource = 'api') {
    const jid = await this.sender.resolveJid(instanceId, dto.to);
    const sent = await this.sender.send(instanceId, jid, { text: dto.text }, { source, delayMs: dto.delay, preview: dto.text });
    return this.record(instanceId, jid, 'TEXT', { text: dto.text }, sent);
  }

  async sendImage(instanceId: string, dto: SendImageBody, source: MessageSource = 'api') {
    const jid = await this.sender.resolveJid(instanceId, dto.to);
    const sent = await this.sendMediaTo(instanceId, jid, { kind: 'image', url: dto.imageUrl, caption: dto.caption }, source, dto.delay);
    return this.record(instanceId, jid, 'IMAGE', { imageUrl: auditableUrl(dto.imageUrl), caption: dto.caption }, sent);
  }

  async sendVideo(instanceId: string, dto: SendVideoBody, source: MessageSource = 'api') {
    const jid = await this.sender.resolveJid(instanceId, dto.to);
    const sent = await this.sendMediaTo(instanceId, jid, { kind: 'video', url: dto.videoUrl, caption: dto.caption }, source, dto.delay);
    return this.record(instanceId, jid, 'VIDEO', { videoUrl: auditableUrl(dto.videoUrl), caption: dto.caption }, sent);
  }

  async sendAudio(instanceId: string, dto: SendAudioBody, source: MessageSource = 'api') {
    const jid = await this.sender.resolveJid(instanceId, dto.to);
    const sent = await this.sendMediaTo(instanceId, jid, { kind: 'audio', url: dto.audioUrl, ptt: dto.ptt !== false }, source, dto.delay);
    return this.record(instanceId, jid, 'AUDIO', { audioUrl: auditableUrl(dto.audioUrl), ptt: dto.ptt !== false }, sent);
  }

  async sendDocument(instanceId: string, dto: SendDocumentBody, source: MessageSource = 'api') {
    const jid = await this.sender.resolveJid(instanceId, dto.to);
    const filename = dto.filename || filenameFromUrl(dto.documentUrl, 'documento');
    const sent = await this.sendMediaTo(
      instanceId,
      jid,
      { kind: 'document', url: dto.documentUrl, caption: dto.caption, filename },
      source,
      dto.delay,
    );
    return this.record(instanceId, jid, 'DOCUMENT', { documentUrl: auditableUrl(dto.documentUrl), filename, caption: dto.caption }, sent);
  }

  async sendContact(instanceId: string, dto: SendContactBody, source: MessageSource = 'api') {
    const jid = await this.sender.resolveJid(instanceId, dto.to);
    const phone = dto.contactPhone.replace(/\D/g, '');
    if (phone.length < 8) throw new BadRequestException('Telefone do contato inválido');
    const name = vcardEscape(dto.contactName);

    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:;${name};;;`,
      `FN:${name}`,
      dto.organization ? `ORG:${vcardEscape(dto.organization)}` : null,
      `TEL;type=CELL;type=VOICE;waid=${phone}:+${phone}`,
      'END:VCARD',
    ]
      .filter(Boolean)
      .join('\n');

    const sent = await this.sender.send(
      instanceId,
      jid,
      { contacts: { displayName: dto.contactName, contacts: [{ vcard }] } },
      { source, delayMs: dto.delay, preview: `📇 ${dto.contactName}`, type: 'contact' },
    );
    return this.record(instanceId, jid, 'CONTACT', { contactName: dto.contactName, contactPhone: phone }, sent);
  }

  async sendLocation(instanceId: string, dto: SendLocationBody, source: MessageSource = 'api') {
    const jid = await this.sender.resolveJid(instanceId, dto.to);
    const sent = await this.sender.send(
      instanceId,
      jid,
      { location: { degreesLatitude: dto.latitude, degreesLongitude: dto.longitude, name: dto.name, address: dto.address } },
      { source, delayMs: dto.delay, preview: `📍 ${dto.name ?? `${dto.latitude}, ${dto.longitude}`}`, type: 'location' },
    );
    return this.record(instanceId, jid, 'LOCATION', { latitude: dto.latitude, longitude: dto.longitude, name: dto.name }, sent);
  }

  async sendPoll(instanceId: string, dto: SendPollBody, source: MessageSource = 'api') {
    const jid = await this.sender.resolveJid(instanceId, dto.to);
    const values = [...new Set(dto.options.map((o) => o.trim()).filter(Boolean))];
    if (values.length < 2) throw new BadRequestException('A enquete precisa de pelo menos 2 opções diferentes');
    const selectableCount = Math.min(dto.selectableCount ?? 1, values.length);

    const sent = await this.sender.send(
      instanceId,
      jid,
      { poll: { name: dto.question, values, selectableCount } },
      { source, delayMs: dto.delay, preview: `📊 ${dto.question}`, type: 'poll' },
    );
    return this.record(instanceId, jid, 'POLL', { question: dto.question, options: values }, sent);
  }

  /** Envio de mídia reutilizado pelas integrações (Typebot, Chatwoot). */
  async sendMediaTo(instanceId: string, jid: string, media: MediaRequest, source: MessageSource, delayMs?: number) {
    let downloaded: { buffer: Buffer; contentType?: string };
    try {
      downloaded = await downloadBuffer(media.url);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`Download de mídia falhou: ${(err as Error).message}`);
      throw new BadRequestException('Não foi possível baixar a mídia. Verifique se a URL é pública e acessível.');
    }

    const mimetype = resolveMimeType(media.kind, media.url, downloaded.contentType);
    const preview = media.caption || `[${media.kind}]`;
    let content: AnyMessageContent;

    switch (media.kind) {
      case 'image':
        content = { image: downloaded.buffer, mimetype, caption: media.caption };
        break;
      case 'video':
        content = { video: downloaded.buffer, mimetype, caption: media.caption };
        break;
      case 'document':
        content = {
          document: downloaded.buffer,
          mimetype,
          fileName: media.filename || filenameFromUrl(media.url, 'documento'),
          caption: media.caption,
        };
        break;
      case 'audio': {
        if (media.ptt) {
          try {
            content = { audio: await convertToOggOpus(downloaded.buffer), mimetype: 'audio/ogg; codecs=opus', ptt: true };
            break;
          } catch (err) {
            this.logger.warn(`Conversão para nota de voz falhou, enviando áudio original: ${(err as Error).message}`);
          }
        }
        content = { audio: downloaded.buffer, mimetype, ptt: false };
        break;
      }
    }

    return this.sender.send(instanceId, jid, content!, { source, delayMs, preview, type: media.kind });
  }

  async stats(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [today, total] = await Promise.all([
      this.prisma.message.count({ where: { instance: { userId }, createdAt: { gte: startOfDay } } }),
      this.prisma.message.count({ where: { instance: { userId } } }),
    ]);
    return { today, total };
  }

  /**
   * Registra o envio para auditoria/estatísticas (sem mídia em base64).
   *
   * Chamado DEPOIS que a mensagem já saiu: uma falha aqui nunca pode virar erro na
   * resposta, senão o cliente reenviaria e o contato receberia a mensagem duplicada.
   */
  async record(instanceId: string, jid: string, type: string, content: Record<string, unknown>, sent: WAMessage) {
    const to = jidToPhone(jid) || jid;
    const messageId = sent.key?.id ?? null;
    try {
      const saved = await this.prisma.message.create({
        data: {
          instanceId,
          messageId,
          from: 'me',
          to,
          type,
          content: JSON.parse(JSON.stringify(content)),
          status: 'SENT',
        },
        select: { id: true, messageId: true, to: true, type: true, status: true, createdAt: true },
      });
      return { ...saved, success: true, jid };
    } catch (err) {
      this.logger.error(`Mensagem ${messageId} enviada, mas não registrada na auditoria: ${describeError(err)}`);
      return { id: null, messageId, to, type, status: 'SENT', createdAt: new Date(), success: true, jid, audited: false };
    }
  }
}
