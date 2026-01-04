import { Injectable, Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { BaileysService } from '../instances/baileys.service';
import axios from 'axios';

interface ChatwootContact {
  id: number;
  sourceId: string;
  name: string;
}

interface ChatwootConversation {
  id: number;
  contactId: number;
  inboxId: number;
}

interface ChatwootConfig {
  enabled?: boolean;
  sqs?: boolean;
  url: string;
  accountId: string;
  token: string;
  signMessages: boolean;
  signDelimiter: string;
  nameInbox: string;
  organization: string;
  logo: string;
  conversationPending: boolean;
  reopenConversation: boolean;
  importContacts: boolean;
  importMessages: boolean;
  daysLimitImport: number;
  ignoreJids: string;
  autoCreate: boolean;
}

@Injectable()
export class ChatwootService implements OnModuleInit {
  private readonly logger = new Logger(ChatwootService.name);
  private registeredInstances: Set<string> = new Set();
  // Cache com TTL para evitar duplicatas e melhorar performance
  private contacts: Map<string, { data: ChatwootContact; timestamp: number }> = new Map();
  private conversations: Map<string, { data: ChatwootConversation; timestamp: number }> = new Map();
  private inboxes: Map<string, { id: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(
    @Inject(forwardRef(() => BaileysService))
    private baileys: BaileysService,
  ) {}

  async onModuleInit() {
    this.logger.log('ChatwootService inicializado');
    // Limpar cache periodicamente
    setInterval(() => this.cleanCache(), this.CACHE_TTL);
  }

  private cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.contacts) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.contacts.delete(key);
      }
    }
    for (const [key, value] of this.conversations) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.conversations.delete(key);
      }
    }
    for (const [key, value] of this.inboxes) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.inboxes.delete(key);
      }
    }
  }

  registerInstance(instanceId: string) {
    if (this.registeredInstances.has(instanceId)) {
      this.logger.debug(`Chatwoot: Instância ${instanceId} já registrada`);
      return;
    }

    this.baileys.onMessage(
      instanceId,
      async (remoteJid, message, fromMe) => {
        // Processar imediatamente sem delay
        this.processMessage(instanceId, remoteJid, message, fromMe).catch(err => {
          this.logger.error(`Chatwoot: Erro ao processar mensagem: ${err.message}`);
        });
      },
      `chatwoot_${instanceId}`,
    );

    this.registeredInstances.add(instanceId);
    this.logger.log(`Chatwoot: Registrado para instância ${instanceId}`);
  }

  unregisterInstance(instanceId: string) {
    this.registeredInstances.delete(instanceId);
    this.baileys.offMessage(instanceId, `chatwoot_${instanceId}`);
    this.logger.log(`Chatwoot: Desregistrado da instância ${instanceId}`);
  }

  private getContactKey(instanceId: string, remoteJid: string): string {
    return `${instanceId}:${remoteJid}`;
  }

  private shouldIgnore(remoteJid: string, config: ChatwootConfig): boolean {
    if (!config.ignoreJids) return false;
    const ignoreList = config.ignoreJids.split(',').map((j) => j.trim());
    return ignoreList.some((jid) => remoteJid.includes(jid));
  }

  async processMessage(instanceId: string, remoteJid: string, message: string, fromMe: boolean) {
    const startTime = Date.now();
    
    try {
      // Ignorar grupos, status e newsletters (não têm número de telefone válido)
      if (
        remoteJid.endsWith('@g.us') || 
        remoteJid === 'status@broadcast' ||
        remoteJid.endsWith('@newsletter') ||
        remoteJid.endsWith('@broadcast') ||
        remoteJid.endsWith('@lid')
      ) {
        this.logger.debug(`Chatwoot: Ignorando JID não suportado: ${remoteJid}`);
        return;
      }

      // Validar se o JID tem formato de número de telefone válido
      const phoneNumber = remoteJid.split('@')[0];
      if (!/^\d{10,15}$/.test(phoneNumber)) {
        this.logger.debug(`Chatwoot: Ignorando JID com número inválido: ${remoteJid}`);
        return;
      }

      // Obter configuração do Chatwoot das settings da instância (salvas em settings.json)
      const settings = this.baileys.getSettings(instanceId);
      const config = settings.chatwoot as ChatwootConfig;

      if (!config) {
        this.logger.debug(`Chatwoot: Nenhuma configuração para instância ${instanceId}`);
        return;
      }

      if (!config.enabled) {
        this.logger.debug('Chatwoot: Integração desabilitada');
        return;
      }

      if (!config.url || !config.accountId || !config.token) {
        this.logger.warn('Chatwoot não configurado: falta url, accountId ou token');
        return;
      }

      // Verificar se deve ignorar este JID
      if (this.shouldIgnore(remoteJid, config)) {
        this.logger.debug(`Chatwoot: JID ${remoteJid} está na lista de ignorados`);
        return;
      }

      this.logger.log(`Chatwoot: Processando mensagem de ${remoteJid}: "${message.substring(0, 50)}..."`);

      // Obter ou criar inbox (com cache)
      let inboxId = this.getCachedInbox(instanceId);
      if (!inboxId) {
        inboxId = await this.getOrCreateInbox(instanceId, config);
        if (inboxId) {
          this.setCachedInbox(instanceId, inboxId);
        }
      }

      if (!inboxId) {
        this.logger.error('Chatwoot: Não foi possível obter/criar inbox');
        return;
      }

      // Obter ou criar contato (com cache)
      const contactKey = this.getContactKey(instanceId, remoteJid);
      let contact = this.getCachedContact(contactKey);
      if (!contact) {
        contact = await this.getOrCreateContact(remoteJid, config, inboxId);
        if (contact) {
          this.setCachedContact(contactKey, contact);
        }
      }

      if (!contact) {
        this.logger.error('Chatwoot: Não foi possível obter/criar contato');
        return;
      }

      // Obter ou criar conversa (com cache, mas revalidar se reopenConversation)
      let conversation = this.getCachedConversation(contactKey);
      if (!conversation || (config.reopenConversation && !fromMe)) {
        conversation = await this.getOrCreateConversation(contact, config, inboxId);
        if (conversation) {
          this.setCachedConversation(contactKey, conversation);
        }
      }

      if (!conversation) {
        this.logger.error('Chatwoot: Não foi possível obter/criar conversa');
        return;
      }

      // Enviar mensagem para o Chatwoot
      await this.sendMessageToChatwoot(conversation.id, message, fromMe, config);
      
      const elapsed = Date.now() - startTime;
      this.logger.log(`Chatwoot: Mensagem processada em ${elapsed}ms para conversa ${conversation.id}`);
    } catch (error: any) {
      this.logger.error(`Erro ao processar mensagem Chatwoot: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(`Chatwoot API Error: ${JSON.stringify(error.response.data)}`);
      }
    }
  }

  // Cache helpers
  private getCachedInbox(instanceId: string): number | null {
    const cached = this.inboxes.get(instanceId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.id;
    }
    return null;
  }

  private setCachedInbox(instanceId: string, id: number) {
    this.inboxes.set(instanceId, { id, timestamp: Date.now() });
  }

  private getCachedContact(key: string): ChatwootContact | null {
    const cached = this.contacts.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedContact(key: string, data: ChatwootContact) {
    this.contacts.set(key, { data, timestamp: Date.now() });
  }

  private getCachedConversation(key: string): ChatwootConversation | null {
    const cached = this.conversations.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedConversation(key: string, data: ChatwootConversation) {
    this.conversations.set(key, { data, timestamp: Date.now() });
  }


  private async getOrCreateInbox(instanceId: string, config: ChatwootConfig): Promise<number | null> {
    try {
      const headers = this.getHeaders(config);
      const baseUrl = this.getBaseUrl(config);

      // Listar inboxes existentes
      const response = await axios.get(`${baseUrl}/inboxes`, { headers, timeout: 10000 });

      const inboxName = config.nameInbox || `WhatsApp - ${instanceId.slice(0, 8)}`;
      const existingInbox = response.data?.payload?.find((inbox: any) => inbox.name === inboxName);

      if (existingInbox) {
        this.logger.debug(`Chatwoot: Inbox encontrada: ${existingInbox.id}`);
        return existingInbox.id;
      }

      // Criar nova inbox se autoCreate estiver habilitado
      if (config.autoCreate) {
        const createResponse = await axios.post(
          `${baseUrl}/inboxes`,
          {
            name: inboxName,
            channel: {
              type: 'api',
              webhook_url: '',
            },
          },
          { headers, timeout: 10000 },
        );

        this.logger.log(`Chatwoot: Nova inbox criada: ${createResponse.data?.id}`);
        return createResponse.data?.id;
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Erro ao obter/criar inbox: ${error.message}`);
      return null;
    }
  }

  private async getOrCreateContact(
    remoteJid: string,
    config: ChatwootConfig,
    inboxId: number,
  ): Promise<ChatwootContact | null> {
    try {
      const headers = this.getHeaders(config);
      const baseUrl = this.getBaseUrl(config);
      const phoneNumber = remoteJid.split('@')[0];

      // Buscar contato existente por telefone
      try {
        const searchResponse = await axios.get(`${baseUrl}/contacts/search`, {
          headers,
          params: { q: phoneNumber },
          timeout: 10000,
        });

        const existingContact = searchResponse.data?.payload?.find(
          (c: any) => 
            c.phone_number === `+${phoneNumber}` || 
            c.phone_number === phoneNumber ||
            c.identifier === remoteJid,
        );

        if (existingContact) {
          this.logger.debug(`Chatwoot: Contato encontrado: ${existingContact.id}`);
          
          // Verificar se o contato já está associado à inbox
          await this.ensureContactInbox(existingContact.id, inboxId, remoteJid, config);
          
          return {
            id: existingContact.id,
            sourceId: remoteJid,
            name: existingContact.name || phoneNumber,
          };
        }
      } catch (searchError: any) {
        this.logger.debug(`Chatwoot: Busca de contato falhou: ${searchError.message}`);
      }

      // Criar novo contato
      const createResponse = await axios.post(
        `${baseUrl}/contacts`,
        {
          inbox_id: inboxId,
          name: phoneNumber,
          phone_number: `+${phoneNumber}`,
          identifier: remoteJid,
        },
        { headers, timeout: 10000 },
      );

      const contactData = createResponse.data?.payload?.contact || createResponse.data?.payload;
      const contactId = contactData?.id;

      if (contactId) {
        this.logger.log(`Chatwoot: Novo contato criado: ${contactId}`);
        return {
          id: contactId,
          sourceId: remoteJid,
          name: phoneNumber,
        };
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Erro ao obter/criar contato: ${error.message}`);
      if (error.response) {
        this.logger.error(`Chatwoot response: ${JSON.stringify(error.response.data)}`);
      }
      return null;
    }
  }

  private async ensureContactInbox(contactId: number, inboxId: number, sourceId: string, config: ChatwootConfig) {
    try {
      const headers = this.getHeaders(config);
      const baseUrl = this.getBaseUrl(config);

      // Criar contact_inbox se não existir
      await axios.post(
        `${baseUrl}/contacts/${contactId}/contact_inboxes`,
        {
          inbox_id: inboxId,
          source_id: sourceId,
        },
        { headers, timeout: 10000 },
      );
    } catch (error: any) {
      // Ignorar erro se já existir
      if (error.response?.status !== 422) {
        this.logger.debug(`Chatwoot: Erro ao criar contact_inbox: ${error.message}`);
      }
    }
  }

  private async getOrCreateConversation(
    contact: ChatwootContact,
    config: ChatwootConfig,
    inboxId: number,
  ): Promise<ChatwootConversation | null> {
    try {
      const headers = this.getHeaders(config);
      const baseUrl = this.getBaseUrl(config);

      // Buscar conversa aberta existente
      try {
        const searchResponse = await axios.get(`${baseUrl}/contacts/${contact.id}/conversations`, {
          headers,
          timeout: 10000,
        });

        const conversations = searchResponse.data?.payload || [];
        const openConversation = conversations.find(
          (c: any) => c.status === 'open' || c.status === 'pending',
        );

        if (openConversation) {
          this.logger.debug(`Chatwoot: Conversa encontrada: ${openConversation.id}`);
          return {
            id: openConversation.id,
            contactId: contact.id,
            inboxId: inboxId,
          };
        }
      } catch (searchError: any) {
        this.logger.debug(`Chatwoot: Busca de conversa falhou: ${searchError.message}`);
      }

      // Criar nova conversa
      const status = config.conversationPending ? 'pending' : 'open';
      const createResponse = await axios.post(
        `${baseUrl}/conversations`,
        {
          source_id: contact.sourceId,
          inbox_id: inboxId,
          contact_id: contact.id,
          status: status,
        },
        { headers, timeout: 10000 },
      );

      const conversationId = createResponse.data?.id || createResponse.data?.payload?.id;
      
      if (conversationId) {
        this.logger.log(`Chatwoot: Nova conversa criada: ${conversationId}`);
        return {
          id: conversationId,
          contactId: contact.id,
          inboxId: inboxId,
        };
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Erro ao obter/criar conversa: ${error.message}`);
      if (error.response) {
        this.logger.error(`Chatwoot response: ${JSON.stringify(error.response.data)}`);
      }
      return null;
    }
  }

  private async sendMessageToChatwoot(
    conversationId: number,
    message: string,
    fromMe: boolean,
    config: ChatwootConfig,
  ) {
    try {
      const headers = this.getHeaders(config);
      const baseUrl = this.getBaseUrl(config);

      // Tipo de mensagem: incoming (do cliente) ou outgoing (do agente)
      const messageType = fromMe ? 'outgoing' : 'incoming';

      let content = message;
      if (config.signMessages && fromMe) {
        const delimiter = config.signDelimiter || '\n';
        content = `${config.organization || 'Bot'}${delimiter}${message}`;
      }

      await axios.post(
        `${baseUrl}/conversations/${conversationId}/messages`,
        {
          content: content,
          message_type: messageType,
          private: false,
        },
        { headers, timeout: 10000 },
      );

      this.logger.debug(`Chatwoot: Mensagem enviada para conversa ${conversationId}`);
    } catch (error: any) {
      this.logger.error(`Erro ao enviar mensagem para Chatwoot: ${error.message}`);
    }
  }

  // Enviar mensagem do Chatwoot para o WhatsApp
  async sendToWhatsApp(instanceId: string, remoteJid: string, message: string) {
    try {
      const socket = this.baileys.getSocket(instanceId);
      if (socket) {
        await socket.sendMessage(remoteJid, { text: message });
        this.logger.debug(`Chatwoot: Mensagem enviada para WhatsApp ${remoteJid}`);
      }
    } catch (error: any) {
      this.logger.error(`Erro ao enviar mensagem para WhatsApp: ${error.message}`);
    }
  }

  private getHeaders(config: ChatwootConfig) {
    return {
      'Content-Type': 'application/json',
      api_access_token: config.token,
    };
  }

  private getBaseUrl(config: ChatwootConfig): string {
    const url = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
    return `${url}/api/v1/accounts/${config.accountId}`;
  }
}
