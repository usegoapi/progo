import { Injectable, Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { BaileysService } from '../instances/baileys.service';
import axios from 'axios';

interface N8nSession {
  lastActivity: Date;
  active: boolean;
}

interface N8nConfig {
  enabled?: boolean;
  webhookUrl: string;
  basicAuthUser: string;
  basicAuthPassword: string;
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
  splitMessages: boolean;
}

@Injectable()
export class N8nService implements OnModuleInit {
  private readonly logger = new Logger(N8nService.name);
  private sessions: Map<string, N8nSession> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private messageBuffer: Map<string, string[]> = new Map();
  private registeredInstances: Set<string> = new Set();

  constructor(
    @Inject(forwardRef(() => BaileysService))
    private baileys: BaileysService,
  ) {}

  async onModuleInit() {
    this.logger.log('N8nService inicializado');
  }

  registerInstance(instanceId: string) {
    if (this.registeredInstances.has(instanceId)) return;
    
    this.baileys.onMessage(instanceId, async (remoteJid, message, fromMe) => {
      await this.processMessage(instanceId, remoteJid, message, fromMe);
    }, `n8n_${instanceId}`);
    
    this.registeredInstances.add(instanceId);
    this.logger.log(`n8n registrado para instância ${instanceId}`);
  }

  unregisterInstance(instanceId: string) {
    this.registeredInstances.delete(instanceId);
    this.baileys.offMessage(instanceId, `n8n_${instanceId}`);
  }

  private shouldTrigger(message: string, config: N8nConfig): boolean {
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

  private shouldFinish(message: string, config: N8nConfig): boolean {
    if (!config.keywordFinish) return false;
    return message.toLowerCase() === config.keywordFinish.toLowerCase();
  }

  private getSessionKey(instanceId: string, remoteJid: string): string {
    return `${instanceId}:${remoteJid}`;
  }

  async processMessage(instanceId: string, remoteJid: string, message: string, fromMe: boolean) {
    try {
      if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') return;

      // Obter configuração do n8n das settings da instância (salvas em settings.json)
      const settings = this.baileys.getSettings(instanceId);
      const config = settings.n8n as N8nConfig;
      
      if (!config) {
        this.logger.debug(`n8n: Nenhuma configuração n8n para instância ${instanceId}`);
        return;
      }
      
      // Verificar se está habilitado
      if (!config.enabled) {
        this.logger.debug('n8n: Integração desabilitada');
        return;
      }
      
      if (!config.webhookUrl) {
        this.logger.warn('n8n não configurado: falta webhookUrl');
        return;
      }

      this.logger.debug(`n8n: Processando mensagem de ${remoteJid}: "${message}"`);
      
      if (fromMe && !config.listeningFromMe) return;
      
      if (fromMe && config.stopBotFromMe) {
        this.endSession(instanceId, remoteJid);
        return;
      }

      const sessionKey = this.getSessionKey(instanceId, remoteJid);
      const existingSession = this.sessions.get(sessionKey);

      if (this.shouldFinish(message, config)) {
        this.endSession(instanceId, remoteJid);
        return;
      }

      if (existingSession && config.expireMinutes > 0) {
        const elapsed = (Date.now() - existingSession.lastActivity.getTime()) / 1000 / 60;
        if (elapsed > config.expireMinutes) {
          this.endSession(instanceId, remoteJid);
        }
      }

      // Se não tem sessão, verificar trigger
      if (!this.sessions.has(sessionKey)) {
        const shouldTrigger = this.shouldTrigger(message, config);
        this.logger.debug(`n8n: Trigger check - type: ${config.triggerType}, keyword: ${config.keyword}, result: ${shouldTrigger}`);
        
        if (!shouldTrigger) {
          if (config.unknownMessage) {
            await this.sendMessage(instanceId, remoteJid, config.unknownMessage, config.delayMessage);
          }
          return;
        }
        this.sessions.set(sessionKey, { lastActivity: new Date(), active: true });
        this.logger.log(`n8n: Nova sessão criada para ${remoteJid}`);
      }

      if (config.debounceTime > 0) {
        this.addToBuffer(sessionKey, message);
        this.scheduleDebounce(sessionKey, instanceId, remoteJid, config);
      } else {
        await this.sendToN8n(instanceId, remoteJid, message, config);
      }
    } catch (error: any) {
      this.logger.error(`Erro ao processar mensagem n8n: ${error.message}`);
    }
  }

  private addToBuffer(sessionKey: string, message: string) {
    const buffer = this.messageBuffer.get(sessionKey) || [];
    buffer.push(message);
    this.messageBuffer.set(sessionKey, buffer);
  }

  private scheduleDebounce(sessionKey: string, instanceId: string, remoteJid: string, config: N8nConfig) {
    const existingTimer = this.debounceTimers.get(sessionKey);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      const messages = this.messageBuffer.get(sessionKey) || [];
      this.messageBuffer.delete(sessionKey);
      this.debounceTimers.delete(sessionKey);

      if (messages.length > 0) {
        const combinedMessage = config.splitMessages ? messages : [messages.join(' ')];
        for (const msg of combinedMessage) {
          await this.sendToN8n(instanceId, remoteJid, Array.isArray(msg) ? msg.join(' ') : msg, config);
        }
      }
    }, config.debounceTime * 1000);

    this.debounceTimers.set(sessionKey, timer);
  }

  private async sendToN8n(instanceId: string, remoteJid: string, message: string, config: N8nConfig) {
    try {
      const sessionKey = this.getSessionKey(instanceId, remoteJid);
      
      this.logger.log(`n8n: Enviando para webhook: ${config.webhookUrl}`);
      
      const headers: any = { 'Content-Type': 'application/json' };
      if (config.basicAuthUser && config.basicAuthPassword) {
        const auth = Buffer.from(`${config.basicAuthUser}:${config.basicAuthPassword}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const payload = {
        instanceId,
        remoteJid,
        message,
        pushName: remoteJid.split('@')[0],
        timestamp: new Date().toISOString(),
      };

      this.logger.debug(`n8n: Payload: ${JSON.stringify(payload)}`);

      const response = await axios.post(config.webhookUrl, payload, { headers, timeout: 30000 });

      this.logger.log(`n8n: Resposta recebida - status: ${response.status}`);

      const session = this.sessions.get(sessionKey);
      if (session) {
        session.lastActivity = new Date();
        this.sessions.set(sessionKey, session);
      }

      // Processar resposta do n8n se houver
      if (response.data) {
        this.logger.debug(`n8n: Dados da resposta: ${JSON.stringify(response.data)}`);
        
        if (typeof response.data === 'string' && response.data.trim()) {
          await this.sendMessage(instanceId, remoteJid, response.data, config.delayMessage);
        } else if (response.data.message) {
          await this.sendMessage(instanceId, remoteJid, response.data.message, config.delayMessage);
        } else if (response.data.messages && Array.isArray(response.data.messages)) {
          for (const msg of response.data.messages) {
            if (config.delayMessage > 0) {
              await new Promise(resolve => setTimeout(resolve, config.delayMessage));
            }
            await this.sendMessage(instanceId, remoteJid, msg);
          }
        }
      }

      if (!config.keepOpen && response.data?.endSession) {
        this.endSession(instanceId, remoteJid);
      }
    } catch (error: any) {
      this.logger.error(`Erro ao comunicar com n8n: ${error.message}`);
      if (error.response) {
        this.logger.error(`n8n response error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
    }
  }

  private async sendMessage(instanceId: string, remoteJid: string, text: string, delay = 0) {
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    
    const socket = this.baileys.getSocket(instanceId);
    if (socket) {
      await socket.sendMessage(remoteJid, { text });
    }
  }

  private endSession(instanceId: string, remoteJid: string) {
    const sessionKey = this.getSessionKey(instanceId, remoteJid);
    this.sessions.delete(sessionKey);
    this.messageBuffer.delete(sessionKey);
    
    const timer = this.debounceTimers.get(sessionKey);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(sessionKey);
    }
    
    this.logger.log(`Sessão n8n finalizada: ${sessionKey}`);
  }
}
