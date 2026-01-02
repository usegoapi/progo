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
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private baileys: BaileysService,
  ) {
    // Configurar ffmpeg path
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  }

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

  // Converter áudio para OGG Opus (formato compatível com WhatsApp PTT em todos os dispositivos)
  private async convertToOggOpus(inputBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const tempDir = os.tmpdir();
      const inputPath = path.join(tempDir, `input_${Date.now()}.tmp`);
      const outputPath = path.join(tempDir, `output_${Date.now()}.ogg`);

      // Salvar buffer de entrada em arquivo temporário
      fs.writeFileSync(inputPath, inputBuffer);

      ffmpeg(inputPath)
        .audioCodec('libopus')
        .audioFrequency(48000)
        .audioChannels(1)
        .audioBitrate('64k')
        .format('ogg')
        .on('error', (err) => {
          this.logger.error(`FFmpeg error: ${err.message}`);
          // Limpar arquivos temporários
          try { fs.unlinkSync(inputPath); } catch {}
          try { fs.unlinkSync(outputPath); } catch {}
          reject(err);
        })
        .on('end', () => {
          try {
            const outputBuffer = fs.readFileSync(outputPath);
            // Limpar arquivos temporários
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
            resolve(outputBuffer);
          } catch (err) {
            reject(err);
          }
        })
        .save(outputPath);
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
      // Baixar o áudio
      const audioBuffer = await this.downloadMedia(dto.audioUrl);
      
      let finalBuffer: Buffer;
      let mimetype: string;
      
      if (dto.ptt !== false) {
        // Para PTT (voice note), converter para OGG Opus - formato obrigatório para Android/iOS
        this.logger.log('Convertendo áudio para OGG Opus (PTT)...');
        finalBuffer = await this.convertToOggOpus(audioBuffer);
        mimetype = 'audio/ogg; codecs=opus';
      } else {
        // Para áudio normal (não PTT), usar o formato original
        finalBuffer = audioBuffer;
        mimetype = this.getMimeType(dto.audioUrl, 'audio');
      }
      
      await socket.sendMessage(to, { 
        audio: finalBuffer, 
        mimetype,
        ptt: dto.ptt !== false,
      });
      
      this.logger.log(`Áudio enviado com sucesso para ${dto.to}`);
    } catch (error) {
      this.logger.error(`Erro ao enviar áudio: ${error.message}`);
      throw new BadRequestException(`Não foi possível enviar o áudio. Erro: ${error.message}`);
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
    
    // Texto formatado do PIX
    const pixText = `💰 *${dto.title || 'Pagamento PIX'}*\n\n${dto.text}\n\n📦 ${dto.productName || 'Produto'}\n💵 Valor: R$ ${dto.amount.toFixed(2)}\n👤 ${dto.merchantName}`;
    
    // Enviar como mensagem interativa com botão de copiar
    await socket.sendMessage(to, {
      text: pixText,
      footer: dto.footer || 'GO-API',
      title: '',
      interactiveButtons: [
        {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            fix: true,
            display_text: '📋 COPIAR CHAVE PIX',
            copy_code: dto.pixKey,
          }),
        },
      ],
    });
    
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
    
    // Mapear botões para o formato interactiveButtons do Baileys (com fix: true)
    const interactiveButtons = dto.buttons.map(btn => {
      if (btn.type === 'cta_url') {
        return {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            fix: true,
            display_text: btn.displayText,
            url: btn.url,
            merchant_url: btn.url,
          }),
        };
      } else if (btn.type === 'cta_call') {
        return {
          name: 'cta_call',
          buttonParamsJson: JSON.stringify({
            fix: true,
            display_text: btn.displayText,
            phone_number: btn.phoneNumber,
          }),
        };
      } else if (btn.type === 'cta_copy') {
        return {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            fix: true,
            display_text: btn.displayText,
            copy_code: btn.copyCode,
          }),
        };
      } else {
        // quick_reply (REPLY no Baileys)
        return {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            fix: true,
            display_text: btn.displayText,
            id: btn.id || btn.displayText,
          }),
        };
      }
    });

    // Construir mensagem com interactiveButtons diretamente (formato Baileys)
    if (dto.imageUrl) {
      // Com imagem: usar caption, media: true, e image: { url }
      await socket.sendMessage(to, {
        caption: dto.text,
        footer: dto.footer || 'GO-API',
        title: dto.title || '',
        media: true,
        image: { url: dto.imageUrl },
        interactiveButtons,
      });
    } else {
      // Sem imagem: usar text
      await socket.sendMessage(to, {
        text: dto.text,
        footer: dto.footer || 'GO-API',
        title: dto.title || '',
        interactiveButtons,
      });
    }

    return this.saveMessage(dto.instanceId, dto.to, 'INTERACTIVE', { text: dto.text, buttons: JSON.parse(JSON.stringify(dto.buttons)) });
  }
}
