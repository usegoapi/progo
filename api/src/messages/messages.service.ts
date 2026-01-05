import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BaileysService } from '../instances/baileys.service';
import {
  SendTextDto, SendImageDto, SendAudioDto, SendVideoDto, SendDocumentDto,
  SendContactDto, SendLocationDto, SendPixDto, SendListDto, SendPollDto,
} from './dto/message.dto';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

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

  // Verifica se número existe no WhatsApp e tenta com/sem o 9
  private async getValidWhatsAppNumber(socket: any, phone: string): Promise<string> {
    let cleaned = phone.replace(/\D/g, '');
    
    // Se já tem o formato completo, retorna
    if (phone.includes('@s.whatsapp.net')) return phone;
    
    // Tenta o número original primeiro
    const jid1 = `${cleaned}@s.whatsapp.net`;
    try {
      const [result1] = await socket.onWhatsApp(cleaned);
      if (result1?.exists) {
        this.logger.debug(`Número válido encontrado: ${cleaned}`);
        return result1.jid;
      }
    } catch (e) {
      this.logger.debug(`Erro ao verificar ${cleaned}: ${e.message}`);
    }

    // Se é número brasileiro (começa com 55), tenta adicionar/remover o 9
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      const ddd = cleaned.substring(2, 4);
      const rest = cleaned.substring(4);
      
      let alternativeNumber: string;
      
      if (rest.length === 9 && rest.startsWith('9')) {
        // Tem 9, tenta sem o 9
        alternativeNumber = `55${ddd}${rest.substring(1)}`;
      } else if (rest.length === 8) {
        // Não tem 9, tenta com o 9
        alternativeNumber = `55${ddd}9${rest}`;
      } else {
        return jid1; // Retorna original se não se encaixa no padrão
      }

      try {
        const [result2] = await socket.onWhatsApp(alternativeNumber);
        if (result2?.exists) {
          this.logger.debug(`Número alternativo válido encontrado: ${alternativeNumber}`);
          return result2.jid;
        }
      } catch (e) {
        this.logger.debug(`Erro ao verificar alternativo ${alternativeNumber}: ${e.message}`);
      }
    }

    // Retorna o original se nenhum foi encontrado
    return jid1;
  }

  private async saveMessage(instanceId: string, to: string, type: string, content: any) {
    return this.prisma.message.create({
      data: { instanceId, from: 'me', to, type, content, status: 'SENT' },
    });
  }

  async sendText(dto: SendTextDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = await this.getValidWhatsAppNumber(socket, dto.to);
    await socket.sendMessage(to, { text: dto.text });
    return this.saveMessage(dto.instanceId, dto.to, 'TEXT', { text: dto.text });
  }

  async sendImage(dto: SendImageDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = await this.getValidWhatsAppNumber(socket, dto.to);
    
    try {
      const imageBuffer = await this.downloadMedia(dto.imageUrl);
      const mimetype = this.getMimeType(dto.imageUrl, 'image');
      
      await socket.sendMessage(to, { 
        image: imageBuffer, 
        mimetype,
        caption: dto.caption 
      });
    } catch (downloadError) {
      this.logger.warn(`Download failed, trying direct URL: ${downloadError.message}`);
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

    const to = await this.getValidWhatsAppNumber(socket, dto.to);
    
    try {
      const audioBuffer = await this.downloadMedia(dto.audioUrl);
      
      let finalBuffer: Buffer;
      let mimetype: string;
      
      if (dto.ptt !== false) {
        this.logger.log('Convertendo áudio para OGG Opus (PTT)...');
        finalBuffer = await this.convertToOggOpus(audioBuffer);
        mimetype = 'audio/ogg; codecs=opus';
      } else {
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

    const to = await this.getValidWhatsAppNumber(socket, dto.to);
    await socket.sendMessage(to, { location: { degreesLatitude: dto.latitude, degreesLongitude: dto.longitude } });
    return this.saveMessage(dto.instanceId, dto.to, 'LOCATION', { latitude: dto.latitude, longitude: dto.longitude });
  }

  async sendVideo(dto: SendVideoDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = await this.getValidWhatsAppNumber(socket, dto.to);
    
    try {
      const videoBuffer = await this.downloadMedia(dto.videoUrl);
      const mimetype = this.getMimeType(dto.videoUrl, 'video');
      
      await socket.sendMessage(to, { 
        video: videoBuffer, 
        mimetype,
        caption: dto.caption 
      });
    } catch (downloadError) {
      this.logger.warn(`Download failed, trying direct URL: ${downloadError.message}`);
      try {
        await socket.sendMessage(to, { video: { url: dto.videoUrl }, caption: dto.caption });
      } catch (urlError) {
        this.logger.error(`Failed to send video: ${urlError.message}`);
        throw new BadRequestException(`Não foi possível enviar o vídeo. Verifique se a URL é acessível: ${dto.videoUrl}`);
      }
    }
    
    return this.saveMessage(dto.instanceId, dto.to, 'VIDEO', { videoUrl: dto.videoUrl, caption: dto.caption });
  }

  async sendDocument(dto: SendDocumentDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = await this.getValidWhatsAppNumber(socket, dto.to);
    const filename = dto.filename || dto.documentUrl.split('/').pop() || 'document';
    
    try {
      const docBuffer = await this.downloadMedia(dto.documentUrl);
      const mimetype = this.getMimeType(dto.documentUrl, 'document');
      
      await socket.sendMessage(to, { 
        document: docBuffer, 
        mimetype,
        fileName: filename,
        caption: dto.caption 
      });
    } catch (downloadError) {
      this.logger.warn(`Download failed, trying direct URL: ${downloadError.message}`);
      try {
        await socket.sendMessage(to, { 
          document: { url: dto.documentUrl }, 
          fileName: filename,
          caption: dto.caption 
        });
      } catch (urlError) {
        this.logger.error(`Failed to send document: ${urlError.message}`);
        throw new BadRequestException(`Não foi possível enviar o documento. Verifique se a URL é acessível: ${dto.documentUrl}`);
      }
    }
    
    return this.saveMessage(dto.instanceId, dto.to, 'DOCUMENT', { documentUrl: dto.documentUrl, filename, caption: dto.caption });
  }

  async sendContact(dto: SendContactDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = await this.getValidWhatsAppNumber(socket, dto.to);
    const phoneClean = dto.contactPhone.replace(/\D/g, '');
    
    // vCard completo com N (nome estruturado) para compatibilidade com Android
    const vcard = `BEGIN:VCARD
VERSION:3.0
N:;${dto.contactName};;;
FN:${dto.contactName}
TEL;type=CELL;type=VOICE;waid=${phoneClean}:+${phoneClean}${dto.organization ? `\nORG:${dto.organization}` : ''}
END:VCARD`;

    await socket.sendMessage(to, {
      contacts: {
        displayName: dto.contactName,
        contacts: [{ vcard }],
      },
    });
    
    return this.saveMessage(dto.instanceId, dto.to, 'CONTACT', { contactName: dto.contactName, contactPhone: dto.contactPhone });
  }

  async sendPix(dto: SendPixDto) {
    const socket = this.baileys.getSocket(dto.instanceId);
    if (!socket) throw new BadRequestException('Instância não conectada');

    const to = await this.getValidWhatsAppNumber(socket, dto.to);
    
    // Determinar o tipo de chave para exibição
    const keyTypeLabels: Record<string, string> = {
      email: 'Email',
      cpf: 'CPF',
      cnpj: 'CNPJ',
      phone: 'Telefone',
      random: 'Chave aleatória',
    };
    const keyTypeLabel = keyTypeLabels[dto.pixKeyType] || 'Chave PIX';
    
    // Texto formatado do PIX
    const pixText = `*${dto.merchantName}*\n${keyTypeLabel}: ${dto.pixKey}`;
    
    // Enviar como mensagem interativa com botão de copiar
    await socket.sendMessage(to, {
      text: pixText,
      footer: dto.footer || 'GO-API',
      interactiveButtons: [
        {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: 'Copiar chave Pix',
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

    const to = await this.getValidWhatsAppNumber(socket, dto.to);
    
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

    const to = await this.getValidWhatsAppNumber(socket, dto.to);
    await socket.sendMessage(to, {
      poll: { name: dto.question, values: dto.options, selectableCount: dto.selectableCount || 1 },
    });

    return this.saveMessage(dto.instanceId, dto.to, 'POLL', { question: dto.question, options: dto.options });
  }
}
