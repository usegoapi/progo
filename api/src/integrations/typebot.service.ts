import { Injectable, Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { BaileysService } from '../instances/baileys.service';
import axios from 'axios';

interface TypebotSession {
  sessionId: string;
  typebotId: string;
  lastActivity: Date;
}

interface TypebotConfig {
  enabled?: boolean;
  apiUrl: string;
  publicName: string;
  triggerType: string;
  triggerOperator: string;
  keyword: string;
  expireMinutes: number;
  keywordFinish: string;
  delayMessage: number;
  unknownMessage: string;
  listeningFromMe: boolean;
  stopBotFromMe: boolean;
  keepOpen: boolean;
  debounceTime: number;
}

@Injectable()
export class TypebotService implements OnModuleInit {
  private readonly logger = new Logger(TypebotService.name);
  private sessions: Map<string, TypebotSession> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private messageBuffer: Map<string, string[]> = new Map();
  private registeredInstances: Set<string> = new Set();

  constructor(
    @Inject(forwardRef(() => BaileysService))
    private baileys: BaileysService,
  ) {}

  async onModuleInit() {
    this.logger.log('TypebotService inicializado');
  }

  // Registrar callback para uma instância específica
  registerInstance(instanceId: string) {
    if (this.registeredInstances.has(instanceId)) return;
    
    this.baileys.onMessage(instanceId, async (remoteJid, message, fromMe) => {
      await this.processMessage(instanceId, remoteJid, message, fromMe);
    }, `typebot_${instanceId}`);
    
    this.registeredInstances.add(instanceId);
    this.logger.log(`Typebot registrado para instância ${instanceId}`);
  }

  // Desregistrar instância
  unregisterInstance(instanceId: string) {
    this.registeredInstances.delete(instanceId);
    this.baileys.offMessage(instanceId, `typebot_${instanceId}`);
  }

  // Verificar se a mensagem deve acionar o Typebot
  private shouldTrigger(message: string, config: TypebotConfig): boolean {
    if (config.triggerType === 'all') return true;
    if (config.triggerType === 'none') return false;
    if (config.triggerType === 'keyword' && config.keyword) {
      const keyword = config.keyword.toLowerCase();
      const msg = message.toLowerCase();
      
      switch (config.triggerOperator) {
        case 'equals': return msg === keyword;
        case 'startsWith': return msg.startsWith(keyword);
        case 'endsWith': return msg.endsWith(keyword);
        case 'regex': return new RegExp(config.keyword, 'i').test(message);
        case 'contains':
        default: return msg.includes(keyword);
      }
    }
    return false;
  }

  // Verificar se deve finalizar a sessão
  private shouldFinish(message: string, config: TypebotConfig): boolean {
    if (!config.keywordFinish) return false;
    return message.toLowerCase() === config.keywordFinish.toLowerCase();
  }

  // Obter ou criar sessão
  private getSessionKey(instanceId: string, remoteJid: string): string {
    return `${instanceId}:${remoteJid}`;
  }

  // Processar mensagem recebida
  async processMessage(instanceId: string, remoteJid: string, message: string, fromMe: boolean) {
    try {
      // Ignorar mensagens de grupos e status
      if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') return;

      // Obter configuração do Typebot das settings da instância (salvas em settings.json)
      const settings = this.baileys.getSettings(instanceId);
      const config = settings.typebot as TypebotConfig;
      
      if (!config) {
        this.logger.debug(`Typebot: Nenhuma configuração para instância ${instanceId}`);
        return;
      }
      
      // Verificar se está habilitado
      if (!config.enabled) return;
      
      // Verificar se tem URL da API configurada
      if (!config.apiUrl || !config.publicName) {
        this.logger.warn('Typebot não configurado corretamente: falta apiUrl ou publicName');
        return;
      }
      
      // Verificar se deve ignorar mensagens próprias
      if (fromMe && !config.listeningFromMe) return;
      
      // Verificar se deve parar o bot com mensagem própria
      if (fromMe && config.stopBotFromMe) {
        this.endSession(instanceId, remoteJid);
        return;
      }

      const sessionKey = this.getSessionKey(instanceId, remoteJid);
      const existingSession = this.sessions.get(sessionKey);

      // Verificar se deve finalizar
      if (this.shouldFinish(message, config)) {
        this.endSession(instanceId, remoteJid);
        return;
      }

      // Verificar expiração da sessão
      if (existingSession && config.expireMinutes > 0) {
        const elapsed = (Date.now() - existingSession.lastActivity.getTime()) / 1000 / 60;
        if (elapsed > config.expireMinutes) {
          this.endSession(instanceId, remoteJid);
        }
      }

      // Se não tem sessão, verificar trigger
      if (!this.sessions.has(sessionKey)) {
        if (!this.shouldTrigger(message, config)) {
          // Enviar mensagem de comando desconhecido se configurado
          if (config.unknownMessage) {
            await this.sendMessage(instanceId, remoteJid, config.unknownMessage, config.delayMessage);
          }
          return;
        }
      }

      // Aplicar debounce
      if (config.debounceTime > 0) {
        this.addToBuffer(sessionKey, message);
        this.scheduleDebounce(sessionKey, instanceId, remoteJid, config);
      } else {
        await this.sendToTypebot(instanceId, remoteJid, message, config);
      }
    } catch (error) {
      this.logger.error(`Erro ao processar mensagem Typebot: ${error.message}`);
    }
  }

  // Adicionar mensagem ao buffer de debounce
  private addToBuffer(sessionKey: string, message: string) {
    const buffer = this.messageBuffer.get(sessionKey) || [];
    buffer.push(message);
    this.messageBuffer.set(sessionKey, buffer);
  }

  // Agendar envio após debounce
  private scheduleDebounce(sessionKey: string, instanceId: string, remoteJid: string, config: TypebotConfig) {
    // Cancelar timer anterior
    const existingTimer = this.debounceTimers.get(sessionKey);
    if (existingTimer) clearTimeout(existingTimer);

    // Criar novo timer
    const timer = setTimeout(async () => {
      const messages = this.messageBuffer.get(sessionKey) || [];
      this.messageBuffer.delete(sessionKey);
      this.debounceTimers.delete(sessionKey);

      if (messages.length > 0) {
        const combinedMessage = messages.join(' ');
        await this.sendToTypebot(instanceId, remoteJid, combinedMessage, config);
      }
    }, config.debounceTime * 1000);

    this.debounceTimers.set(sessionKey, timer);
  }

  // Enviar mensagem para o Typebot
  private async sendToTypebot(instanceId: string, remoteJid: string, message: string, config: TypebotConfig) {
    try {
      const sessionKey = this.getSessionKey(instanceId, remoteJid);
      let session = this.sessions.get(sessionKey);
      
      // Normalizar URL (remover barra final se existir)
      const apiUrl = config.apiUrl.endsWith('/') ? config.apiUrl.slice(0, -1) : config.apiUrl;

      // Criar nova sessão se não existir
      if (!session) {
        this.logger.log(`Typebot: Iniciando nova sessão para ${remoteJid}`);
        
        // Typebot API v1 - startChat endpoint
        // Formato: POST /api/v1/typebots/{publicId}/startChat
        const startResponse = await axios.post(
          `${apiUrl}/api/v1/typebots/${config.publicName}/startChat`,
          {
            message,
            prefilledVariables: {
              remoteJid,
              instanceId,
              pushName: remoteJid.split('@')[0],
              phoneNumber: remoteJid.split('@')[0],
            },
          },
          { timeout: 30000 }
        );

        this.logger.debug(`Typebot: startChat response: ${JSON.stringify(startResponse.data)}`);

        session = {
          sessionId: startResponse.data.sessionId,
          typebotId: config.publicName,
          lastActivity: new Date(),
        };
        this.sessions.set(sessionKey, session);

        // Processar mensagens iniciais do bot
        if (startResponse.data.messages && startResponse.data.messages.length > 0) {
          await this.processTypebotMessages(instanceId, remoteJid, startResponse.data.messages, config.delayMessage);
        }
        
        return;
      }

      // Enviar mensagem do usuário para sessão existente
      // Formato: POST /api/v1/sessions/{sessionId}/continueChat
      this.logger.log(`Typebot: Continuando sessão ${session.sessionId}`);
      
      const response = await axios.post(
        `${apiUrl}/api/v1/sessions/${session.sessionId}/continueChat`,
        { message },
        { timeout: 30000 }
      );

      this.logger.debug(`Typebot: continueChat response: ${JSON.stringify(response.data)}`);

      // Atualizar última atividade
      session.lastActivity = new Date();
      this.sessions.set(sessionKey, session);

      // Processar respostas do bot
      if (response.data.messages && response.data.messages.length > 0) {
        await this.processTypebotMessages(instanceId, remoteJid, response.data.messages, config.delayMessage);
      }

      // Verificar se o fluxo terminou (input === null significa que não há mais inputs esperados)
      if (!config.keepOpen && response.data.input === null) {
        this.endSession(instanceId, remoteJid);
      }
    } catch (error: any) {
      this.logger.error(`Erro ao comunicar com Typebot: ${error.message}`);
      if (error.response) {
        this.logger.error(`Typebot response error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      
      // Se a sessão expirou ou não existe mais, remover e tentar novamente
      if (error.response?.status === 404 || error.response?.status === 400) {
        const sessionKey = this.getSessionKey(instanceId, remoteJid);
        this.sessions.delete(sessionKey);
        this.logger.log('Typebot: Sessão removida, será criada nova na próxima mensagem');
      }
    }
  }

  // Processar mensagens do Typebot e enviar para o WhatsApp
  private async processTypebotMessages(instanceId: string, remoteJid: string, messages: any[], delayMs: number) {
    for (const msg of messages) {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
        switch (msg.type) {
          case 'text':
            // Extrair texto de diferentes formatos possíveis
            let text = '';
            if (msg.content?.richText) {
              // Formato richText - extrair texto de todos os blocos
              text = this.extractTextFromRichText(msg.content.richText);
            } else if (msg.content?.plainText) {
              text = msg.content.plainText;
            } else if (typeof msg.content === 'string') {
              text = msg.content;
            }
            
            if (text) {
              await this.sendMessage(instanceId, remoteJid, text);
            }
            break;
            
          case 'image':
            if (msg.content?.url) {
              await this.sendImage(instanceId, remoteJid, msg.content.url, msg.content?.caption);
            }
            break;
            
          case 'video':
            if (msg.content?.url) {
              await this.sendVideo(instanceId, remoteJid, msg.content.url, msg.content?.caption);
            }
            break;
            
          case 'audio':
            if (msg.content?.url) {
              await this.sendAudio(instanceId, remoteJid, msg.content.url);
            }
            break;
            
          default:
            // Tentar extrair texto de qualquer formato
            if (msg.content?.plainText) {
              await this.sendMessage(instanceId, remoteJid, msg.content.plainText);
            } else if (typeof msg.content === 'string') {
              await this.sendMessage(instanceId, remoteJid, msg.content);
            }
        }
      } catch (error: any) {
        this.logger.error(`Erro ao processar mensagem Typebot tipo ${msg.type}: ${error.message}`);
      }
    }
  }

  // Extrair texto de richText do Typebot
  private extractTextFromRichText(richText: any[]): string {
    if (!Array.isArray(richText)) return '';
    
    return richText.map(block => {
      if (block.children && Array.isArray(block.children)) {
        return block.children.map((child: any) => {
          if (typeof child.text === 'string') return child.text;
          if (child.children) return this.extractTextFromRichText([child]);
          return '';
        }).join('');
      }
      if (typeof block.text === 'string') return block.text;
      return '';
    }).join('\n');
  }

  // Enviar mensagem de texto
  private async sendMessage(instanceId: string, remoteJid: string, text: string, delay = 0) {
    if (!text || !text.trim()) return;
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    
    const socket = this.baileys.getSocket(instanceId);
    if (socket) {
      await socket.sendMessage(remoteJid, { text: text.trim() });
      this.logger.debug(`Typebot: Mensagem enviada para ${remoteJid}`);
    }
  }

  // Enviar imagem
  private async sendImage(instanceId: string, remoteJid: string, url: string, caption?: string) {
    const socket = this.baileys.getSocket(instanceId);
    if (socket) {
      await socket.sendMessage(remoteJid, { 
        image: { url },
        caption: caption || undefined
      });
      this.logger.debug(`Typebot: Imagem enviada para ${remoteJid}`);
    }
  }

  // Enviar vídeo
  private async sendVideo(instanceId: string, remoteJid: string, url: string, caption?: string) {
    const socket = this.baileys.getSocket(instanceId);
    if (socket) {
      await socket.sendMessage(remoteJid, { 
        video: { url },
        caption: caption || undefined
      });
      this.logger.debug(`Typebot: Vídeo enviado para ${remoteJid}`);
    }
  }

  // Enviar áudio
  private async sendAudio(instanceId: string, remoteJid: string, url: string) {
    const socket = this.baileys.getSocket(instanceId);
    if (socket) {
      await socket.sendMessage(remoteJid, { audio: { url }, ptt: true });
      this.logger.debug(`Typebot: Áudio enviado para ${remoteJid}`);
    }
  }

  // Finalizar sessão
  private endSession(instanceId: string, remoteJid: string) {
    const sessionKey = this.getSessionKey(instanceId, remoteJid);
    this.sessions.delete(sessionKey);
    this.messageBuffer.delete(sessionKey);
    
    const timer = this.debounceTimers.get(sessionKey);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(sessionKey);
    }
    
    this.logger.log(`Sessão Typebot finalizada: ${sessionKey}`);
  }
}
