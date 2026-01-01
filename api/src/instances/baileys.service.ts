import { Injectable, Logger } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from 'baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import P from 'pino';

interface SocketInstance {
  socket: any;
  qr: string | null;
  status: string;
  phone: string | null;
  profilePic: string | null;
  name: string | null;
}

export interface InstanceSettings {
  rejectCalls: boolean;
  ignoreGroups: boolean;
  alwaysOnline: boolean;
  readMessages: boolean;
  syncFullHistory: boolean;
  readStatus: boolean;
}

@Injectable()
export class BaileysService {
  private readonly logger = new Logger(BaileysService.name);
  private sockets: Map<string, SocketInstance> = new Map();
  private settings: Map<string, InstanceSettings> = new Map();
  private qrCallbacks: Map<string, (qr: string) => void> = new Map();
  private statusCallbacks: Map<string, (status: string) => void> = new Map();

  getSocket(instanceId: string) {
    return this.sockets.get(instanceId)?.socket;
  }

  getQR(instanceId: string) {
    return this.sockets.get(instanceId)?.qr || null;
  }

  getStatus(instanceId: string) {
    return this.sockets.get(instanceId)?.status || 'DISCONNECTED';
  }

  getPhone(instanceId: string) {
    return this.sockets.get(instanceId)?.phone || null;
  }

  getProfilePic(instanceId: string) {
    return this.sockets.get(instanceId)?.profilePic || null;
  }

  getProfileName(instanceId: string) {
    return this.sockets.get(instanceId)?.name || null;
  }

  getSettings(instanceId: string): InstanceSettings {
    return this.settings.get(instanceId) || {
      rejectCalls: false,
      ignoreGroups: false,
      alwaysOnline: false,
      readMessages: false,
      syncFullHistory: false,
      readStatus: false,
    };
  }

  setSettings(instanceId: string, newSettings: Partial<InstanceSettings>) {
    const current = this.getSettings(instanceId);
    const updated = { ...current, ...newSettings };
    this.settings.set(instanceId, updated);
    
    // Aplicar configurações no socket ativo
    this.applySettings(instanceId);
    
    // Salvar em arquivo
    this.saveSettingsToFile(instanceId, updated);
    
    return updated;
  }

  private applySettings(instanceId: string) {
    const instance = this.sockets.get(instanceId);
    const settings = this.getSettings(instanceId);
    
    if (!instance?.socket) return;
    
    const socket = instance.socket;
    
    // Always Online
    if (settings.alwaysOnline) {
      socket.sendPresenceUpdate('available');
    }
  }

  private saveSettingsToFile(instanceId: string, settings: InstanceSettings) {
    const settingsDir = path.join(process.cwd(), 'sessions', instanceId);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );
  }

  private loadSettingsFromFile(instanceId: string): InstanceSettings {
    const settingsPath = path.join(process.cwd(), 'sessions', instanceId, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      } catch {
        return this.getSettings(instanceId);
      }
    }
    return this.getSettings(instanceId);
  }

  onQR(instanceId: string, callback: (qr: string) => void) {
    this.qrCallbacks.set(instanceId, callback);
  }

  onStatus(instanceId: string, callback: (status: string) => void) {
    this.statusCallbacks.set(instanceId, callback);
  }


  async connect(instanceId: string): Promise<string | null> {
    // Carregar configurações salvas
    const savedSettings = this.loadSettingsFromFile(instanceId);
    this.settings.set(instanceId, savedSettings);
    
    const authDir = path.join(process.cwd(), 'sessions', instanceId);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const logger = P({ level: 'silent' });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      generateHighQualityLinkPreview: true,
      syncFullHistory: savedSettings.syncFullHistory,
    });

    this.sockets.set(instanceId, { 
      socket, 
      qr: null, 
      status: 'CONNECTING',
      phone: null,
      profilePic: null,
      name: null,
    });

    socket.ev.on('creds.update', saveCreds);

    // Eventos de mensagens
    socket.ev.on('messages.upsert', async (m) => {
      const settings = this.getSettings(instanceId);
      
      for (const msg of m.messages) {
        // Ignorar grupos se configurado
        if (settings.ignoreGroups && msg.key.remoteJid?.endsWith('@g.us')) {
          continue;
        }
        
        // Marcar como lida se configurado
        if (settings.readMessages && !msg.key.fromMe) {
          await socket.readMessages([msg.key]);
        }
      }
    });

    // Rejeitar chamadas
    socket.ev.on('call', async (calls) => {
      const settings = this.getSettings(instanceId);
      if (settings.rejectCalls) {
        for (const call of calls) {
          if (call.status === 'offer') {
            await socket.rejectCall(call.id, call.from);
            this.logger.log(`Chamada rejeitada de ${call.from}`);
          }
        }
      }
    });

    // Marcar status como visualizado
    socket.ev.on('messages.update', async (updates) => {
      const settings = this.getSettings(instanceId);
      if (settings.readStatus) {
        for (const update of updates) {
          if (update.key.remoteJid === 'status@broadcast') {
            // Status visualizado automaticamente
          }
        }
      }
    });

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const instance = this.sockets.get(instanceId);
        if (instance) instance.qr = qr;
        this.qrCallbacks.get(instanceId)?.(qr);
        this.logger.log(`QR Code gerado para instância ${instanceId}`);
      }

      if (connection === 'close') {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const instance = this.sockets.get(instanceId);
        if (instance) instance.status = 'DISCONNECTED';
        this.statusCallbacks.get(instanceId)?.('DISCONNECTED');

        if (reason !== DisconnectReason.loggedOut) {
          this.logger.warn(`Reconectando instância ${instanceId}...`);
          setTimeout(() => this.connect(instanceId), 3000);
        } else {
          this.logger.log(`Instância ${instanceId} deslogada`);
          this.sockets.delete(instanceId);
        }
      }

      if (connection === 'open') {
        const instance = this.sockets.get(instanceId);
        if (instance) {
          instance.status = 'CONNECTED';
          instance.qr = null;
          
          // Obter informações do perfil
          try {
            const user = socket.user;
            if (user) {
              instance.phone = user.id.split(':')[0].split('@')[0];
              instance.name = user.name || user.verifiedName || null;
              
              // Buscar foto do perfil
              try {
                const ppUrl = await socket.profilePictureUrl(user.id, 'image');
                instance.profilePic = ppUrl;
              } catch {
                instance.profilePic = null;
              }
            }
          } catch (e) {
            this.logger.warn(`Erro ao obter perfil: ${e}`);
          }
          
          // Aplicar configurações
          this.applySettings(instanceId);
        }
        this.statusCallbacks.get(instanceId)?.('CONNECTED');
        this.logger.log(`Instância ${instanceId} conectada!`);
      }
    });

    return new Promise((resolve) => {
      const checkQR = setInterval(() => {
        const instance = this.sockets.get(instanceId);
        if (instance?.qr) {
          clearInterval(checkQR);
          resolve(instance.qr);
        }
        if (instance?.status === 'CONNECTED') {
          clearInterval(checkQR);
          resolve(null);
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkQR);
        resolve(this.sockets.get(instanceId)?.qr || null);
      }, 30000);
    });
  }

  async disconnect(instanceId: string) {
    const instance = this.sockets.get(instanceId);
    if (instance?.socket) {
      await instance.socket.logout();
      this.sockets.delete(instanceId);
    }
  }

  async deleteSession(instanceId: string) {
    await this.disconnect(instanceId);
    const authDir = path.join(process.cwd(), 'sessions', instanceId);
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true });
    }
    this.settings.delete(instanceId);
  }

  // Reconectar instância (sem logout, apenas reconecta)
  async reconnect(instanceId: string): Promise<string | null> {
    const instance = this.sockets.get(instanceId);
    if (instance?.socket) {
      try {
        instance.socket.end();
      } catch {}
      this.sockets.delete(instanceId);
    }
    return this.connect(instanceId);
  }
}
