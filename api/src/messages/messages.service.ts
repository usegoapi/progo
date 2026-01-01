import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BaileysService } from '../instances/baileys.service';
import {
  SendTextDto, SendImageDto, SendAudioDto, SendLocationDto,
  SendButtonsDto, SendCarouselDto, SendPixDto, SendListDto,
  SendPollDto, SendInteractiveButtonsDto,
} from './dto/message.dto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private baileys: BaileysService,
  ) {}

  private formatPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (phone.includes('@s.whatsapp.net')) return phone;
    return `${cleaned}@s.whatsapp.net`;
  }

  private async saveMessage(instanceId: string, to: string, type: string, content: any) {
    return this.prisma.message.create({
      data: { instanceId, from: 'me', to, type, content, status: 'SENT' },
    });
  }

  async sendText(dto: SendTextDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    await socket.sendMessage(to, { text: dto.text });
    return this.saveMessage(dto.instanceId, dto.to, 'TEXT', { text: dto.text });
  }

  async sendImage(dto: SendImageDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    await socket.sendMessage(to, { image: { url: dto.imageUrl }, caption: dto.caption });
    return this.saveMessage(dto.instanceId, dto.to, 'IMAGE', { imageUrl: dto.imageUrl, caption: dto.caption });
  }

  async sendAudio(dto: SendAudioDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    await socket.sendMessage(to, { audio: { url: dto.audioUrl }, mimetype: 'audio/mp4', ptt: dto.ptt ?? true });
    return this.saveMessage(dto.instanceId, dto.to, 'AUDIO', { audioUrl: dto.audioUrl });
  }

  async sendLocation(dto: SendLocationDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    await socket.sendMessage(to, { location: { degreesLatitude: dto.latitude, degreesLongitude: dto.longitude } });
    return this.saveMessage(dto.instanceId, dto.to, 'LOCATION', { latitude: dto.latitude, longitude: dto.longitude });
  }

  async sendButtons(dto: SendButtonsDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    const buttonsText = dto.buttons.map((btn, i) => `${i + 1}. ${btn.text}`).join('\n');
    const fullText = `${dto.text}\n\n${buttonsText}\n\n${dto.footer || 'GO-API'}`;
    await socket.sendMessage(to, { text: fullText });
    return this.saveMessage(dto.instanceId, dto.to, 'BUTTONS', { text: dto.text, buttons: dto.buttons });
  }

  async sendCarousel(dto: SendCarouselDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    
    const cards = dto.cards.map((card) => ({
      body: card.imageUrl,
      footer: '',
      image: { url: card.imageUrl },
      buttons: card.buttons.map(btn => ({
        name: btn.type === 'cta_url' ? 'cta_url' : 'quick_reply',
        buttonParamsJson: JSON.stringify(
          btn.type === 'cta_url'
            ? { display_text: btn.displayText, url: btn.url }
            : { display_text: btn.displayText, id: btn.id || btn.displayText }
        ),
      })),
    }));

    await socket.sendMessage(to, {
      text: dto.bodyText,
      footer: 'GO-API',
      title: 'Carrossel',
      cards,
    });

    return this.saveMessage(dto.instanceId, dto.to, 'CAROUSEL', { bodyText: dto.bodyText, cards: JSON.parse(JSON.stringify(dto.cards)) });
  }

  async sendPix(dto: SendPixDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    const pixText = `${dto.title || 'Pagamento PIX'}\n\n${dto.text}\n\n💰 Valor: R$ ${dto.amount.toFixed(2)}\n👤 ${dto.merchantName}${dto.productName ? `\n📦 ${dto.productName}` : ''}\n\n📋 Chave PIX: ${dto.pixKey}\n\n${dto.footer || 'GO-API'}`;
    
    await socket.sendMessage(to, { text: pixText });
    return this.saveMessage(dto.instanceId, dto.to, 'PIX', dto);
  }

  async sendList(dto: SendListDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    
    await socket.sendMessage(to, {
      text: dto.text,
      buttonText: dto.buttonText,
      title: dto.title || '',
      footer: dto.footer || 'GO-API',
      listType: 1,
      sections: dto.sections.map(section => ({
        title: section.title,
        rows: section.rows.map(row => ({
          title: row.title,
          description: row.description || '',
          rowId: row.rowId,
        })),
      })),
    });

    return this.saveMessage(dto.instanceId, dto.to, 'LIST', { text: dto.text, sections: JSON.parse(JSON.stringify(dto.sections)) });
  }

  async sendPoll(dto: SendPollDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    await socket.sendMessage(to, {
      poll: { name: dto.question, values: dto.options, selectableCount: dto.selectableCount || 1 },
    });

    return this.saveMessage(dto.instanceId, dto.to, 'POLL', { question: dto.question, options: dto.options });
  }

  async sendInteractiveButtons(dto: SendInteractiveButtonsDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    
    const interactiveButtons = dto.buttons.map(btn => {
      let name = 'quick_reply';
      let params: any = { display_text: btn.displayText, id: btn.id || btn.displayText };

      if (btn.type === 'cta_url') {
        name = 'cta_url';
        params = { display_text: btn.displayText, url: btn.url };
      } else if (btn.type === 'cta_call') {
        name = 'cta_call';
        params = { display_text: btn.displayText, phone_number: btn.phoneNumber };
      } else if (btn.type === 'cta_copy') {
        name = 'cta_copy';
        params = { display_text: btn.displayText, copy_code: btn.copyCode };
      }

      return { name, buttonParamsJson: JSON.stringify(params) };
    });

    const msgPayload: any = {
      text: dto.text,
      footer: dto.footer || 'GO-API',
      interactiveButtons,
    };

    if (dto.title) msgPayload.title = dto.title;
    if (dto.imageUrl) {
      msgPayload.image = { url: dto.imageUrl };
      msgPayload.caption = dto.text;
      delete msgPayload.text;
    }

    await socket.sendMessage(to, msgPayload);
    return this.saveMessage(dto.instanceId, dto.to, 'INTERACTIVE', { text: dto.text, buttons: JSON.parse(JSON.stringify(dto.buttons)) });
  }
}
