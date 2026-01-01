import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BaileysService } from '../instances/baileys.service';
import {
  SendTextDto, SendImageDto, SendAudioDto, SendLocationDto,
  SendButtonsDto, SendCarouselDto, SendPixDto, SendListDto,
  SendPollDto, SendInteractiveButtonsDto,
} from './dto/message.dto';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private baileys: BaileysService,
  ) {}

  // Helper para baixar mídia de URL com tratamento de erros
  private async downloadMedia(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const options = {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      };

      protocol.get(url, options, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.downloadMedia(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject).on('timeout', () => reject(new Error('Download timeout')));
    });
  }

  // Detectar mimetype baseado na URL ou conteúdo
  private getMimeType(url: string, type: 'image' | 'audio' | 'video' | 'document'): string {
    const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
    const mimeTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
      // Audio
      mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
      // Video
      mp4: 'video/mp4', avi: 'video/avi', mkv: 'video/mkv', webm: 'video/webm',
      // Documents
      pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    
    if (ext && mimeTypes[ext]) return mimeTypes[ext];
    
    const defaults = { image: 'image/jpeg', audio: 'audio/mp4', video: 'video/mp4', document: 'application/octet-stream' };
    return defaults[type];
  }

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
    
    try {
      // Tenta baixar a imagem primeiro para evitar erro de fetch
      const imageBuffer = await this.downloadMedia(dto.imageUrl);
      const mimetype = this.getMimeType(dto.imageUrl, 'image');
      
      await socket.sendMessage(to, { 
        image: imageBuffer, 
        mimetype,
        caption: dto.caption 
      });
    } catch (downloadError) {
      this.logger.warn(`Download failed, trying direct URL: ${downloadError.message}`);
      // Fallback: tenta enviar direto pela URL
      try {
        await socket.sendMessage(to, { image: { url: dto.imageUrl }, caption: dto.caption });
      } catch (urlError) {
        this.logger.error(`Failed to send image: ${urlError.message}`);
        throw new BadRequestException(`Não foi possível enviar a imagem. Verifique se a URL é acessível: ${dto.imageUrl}`);
      }
    }
    
    return this.saveMessage(dto.instanceId, dto.to, 'IMAGE', { imageUrl: dto.imageUrl, caption: dto.caption });
  }

  async sendAudio(dto: SendAudioDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = this.formatPhone(dto.to);
    
    try {
      // Tenta baixar o áudio primeiro
      const audioBuffer = await this.downloadMedia(dto.audioUrl);
      const mimetype = this.getMimeType(dto.audioUrl, 'audio');
      
      await socket.sendMessage(to, { 
        audio: audioBuffer, 
        mimetype, 
        ptt: dto.ptt ?? true 
      });
    } catch (downloadError) {
      this.logger.warn(`Audio download failed, trying direct URL: ${downloadError.message}`);
      try {
        await socket.sendMessage(to, { audio: { url: dto.audioUrl }, mimetype: 'audio/mp4', ptt: dto.ptt ?? true });
      } catch (urlError) {
        this.logger.error(`Failed to send audio: ${urlError.message}`);
        throw new BadRequestException(`Não foi possível enviar o áudio. Verifique se a URL é acessível: ${dto.audioUrl}`);
      }
    }
    
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
    
    // Verificar se há botões CTA (URL, Call, Copy) - esses usam formato nativo
    const hasCtaButtons = dto.buttons.some(btn => 
      btn.type === 'cta_url' || btn.type === 'cta_call' || btn.type === 'cta_copy'
    );

    if (hasCtaButtons) {
      // Usar formato de mensagem interativa nativa (compatível com iOS/Android/Web)
      const nativeButtons = dto.buttons.map(btn => {
        if (btn.type === 'cta_url') {
          return {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: btn.displayText,
              url: btn.url,
              merchant_url: btn.url,
            }),
          };
        } else if (btn.type === 'cta_call') {
          return {
            name: 'cta_call',
            buttonParamsJson: JSON.stringify({
              display_text: btn.displayText,
              phone_number: btn.phoneNumber,
            }),
          };
        } else if (btn.type === 'cta_copy') {
          return {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: btn.displayText,
              copy_code: btn.copyCode,
            }),
          };
        } else {
          return {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: btn.displayText,
              id: btn.id || btn.displayText,
            }),
          };
        }
      });

      // Construir mensagem interativa nativa
      const interactiveMessage: any = {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: { text: dto.text },
              footer: { text: dto.footer || 'GO-API' },
              nativeFlowMessage: {
                buttons: nativeButtons,
                messageParamsJson: '',
              },
            },
          },
        },
      };

      // Adicionar header se tiver título ou imagem
      if (dto.title) {
        interactiveMessage.viewOnceMessage.message.interactiveMessage.header = {
          title: dto.title,
          hasMediaAttachment: false,
        };
      }

      if (dto.imageUrl) {
        try {
          const imageBuffer = await this.downloadMedia(dto.imageUrl);
          interactiveMessage.viewOnceMessage.message.interactiveMessage.header = {
            hasMediaAttachment: true,
            imageMessage: {
              jpegThumbnail: imageBuffer,
            },
          };
        } catch (e) {
          this.logger.warn(`Failed to download image for interactive: ${e.message}`);
        }
      }

      await socket.relayMessage(to, interactiveMessage, {});
    } else {
      // Apenas quick_reply - usar formato de botões simples (mais compatível)
      const buttons = dto.buttons.map((btn, index) => ({
        buttonId: btn.id || `btn_${index}`,
        buttonText: { displayText: btn.displayText },
        type: 1,
      }));

      const buttonMessage: any = {
        text: dto.text,
        footer: dto.footer || 'GO-API',
        buttons,
        headerType: 1,
      };

      if (dto.title) {
        buttonMessage.title = dto.title;
      }

      if (dto.imageUrl) {
        try {
          const imageBuffer = await this.downloadMedia(dto.imageUrl);
          buttonMessage.image = imageBuffer;
          buttonMessage.headerType = 4;
        } catch (e) {
          this.logger.warn(`Failed to download image: ${e.message}`);
        }
      }

      await socket.sendMessage(to, buttonMessage);
    }

    return this.saveMessage(dto.instanceId, dto.to, 'INTERACTIVE', { text: dto.text, buttons: JSON.parse(JSON.stringify(dto.buttons)) });
  }
}
