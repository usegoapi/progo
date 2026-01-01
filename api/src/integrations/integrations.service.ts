import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { CreateTypebotDto, CreateN8nDto, CreateChatwootDto, UpdateIntegrationDto } from './dto/integration.dto';
import { TypebotService } from './typebot.service';
import { N8nService } from './n8n.service';
import { ChatwootService } from './chatwoot.service';
import { BaileysService } from '../instances/baileys.service';

@Injectable()
export class IntegrationsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TypebotService))
    private typebotService: TypebotService,
    @Inject(forwardRef(() => N8nService))
    private n8nService: N8nService,
    @Inject(forwardRef(() => ChatwootService))
    private chatwootService: ChatwootService,
    @Inject(forwardRef(() => BaileysService))
    private baileys: BaileysService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.integration.findMany({ 
      where: { userId }, 
      orderBy: { createdAt: 'desc' } 
    });
  }

  async findByType(userId: string, type: string) {
    return this.prisma.integration.findFirst({ 
      where: { userId, type } 
    });
  }

  // Upsert - Cria ou atualiza integração
  private async upsertIntegration(userId: string, type: string, config: any, active: boolean = true) {
    const existing = await this.findByType(userId, type);
    
    let result;
    if (existing) {
      result = await this.prisma.integration.update({
        where: { id: existing.id },
        data: { config, active },
      });
    } else {
      result = await this.prisma.integration.create({
        data: { userId, type, config, active },
      });
    }

    // Gerenciar registro/desregistro das integrações em todas as instâncias do usuário
    await this.syncIntegrationCallbacks(userId, type, active);
    
    return result;
  }

  // Sincronizar callbacks das integrações com as instâncias conectadas
  private async syncIntegrationCallbacks(userId: string, type: string, active: boolean) {
    // Buscar todas as instâncias do usuário
    const instances = await this.prisma.instance.findMany({
      where: { userId },
    });

    for (const instance of instances) {
      const isConnected = this.baileys.getStatus(instance.id) === 'CONNECTED';
      if (!isConnected) continue;

      if (type === 'typebot') {
        if (active) {
          this.typebotService.registerInstance(instance.id);
        } else {
          this.typebotService.unregisterInstance(instance.id);
        }
      } else if (type === 'n8n') {
        if (active) {
          this.n8nService.registerInstance(instance.id);
        } else {
          this.n8nService.unregisterInstance(instance.id);
        }
      } else if (type === 'chatwoot') {
        if (active) {
          this.chatwootService.registerInstance(instance.id);
        } else {
          this.chatwootService.unregisterInstance(instance.id);
        }
      }
    }
  }

  // ==================== TYPEBOT ====================
  async createTypebot(dto: CreateTypebotDto, userId: string) {
    const config = {
      enabled: dto.enabled !== false, // default true
      description: dto.description || '',
      apiUrl: dto.apiUrl || '',
      publicName: dto.publicName || '',
      triggerType: dto.triggerType || 'keyword',
      triggerOperator: dto.triggerOperator || 'contains',
      keyword: dto.keyword || '',
      expireMinutes: dto.expireMinutes || 0,
      keywordFinish: dto.keywordFinish || '',
      delayMessage: dto.delayMessage || 1000,
      unknownMessage: dto.unknownMessage || '',
      listeningFromMe: dto.listeningFromMe || false,
      stopBotFromMe: dto.stopBotFromMe || false,
      keepOpen: dto.keepOpen || false,
      debounceTime: dto.debounceTime || 10,
    };
    return this.upsertIntegration(userId, 'typebot', config, dto.enabled !== false);
  }

  // ==================== N8N ====================
  async createN8n(dto: CreateN8nDto, userId: string) {
    const config = {
      enabled: dto.enabled !== false, // default true
      description: dto.description || '',
      webhookUrl: dto.webhookUrl || '',
      basicAuthUser: dto.basicAuthUser || '',
      basicAuthPassword: dto.basicAuthPassword || '',
      triggerType: dto.triggerType || 'keyword',
      triggerOperator: dto.triggerOperator || 'contains',
      keyword: dto.keyword || '',
      expireMinutes: dto.expireMinutes || 0,
      keywordFinish: dto.keywordFinish || '',
      delayMessage: dto.delayMessage || 1000,
      unknownMessage: dto.unknownMessage || '',
      listeningFromMe: dto.listeningFromMe || false,
      stopBotFromMe: dto.stopBotFromMe || false,
      keepOpen: dto.keepOpen || false,
      debounceTime: dto.debounceTime || 10,
      splitMessages: dto.splitMessages || false,
    };
    return this.upsertIntegration(userId, 'n8n', config, dto.enabled !== false);
  }

  // ==================== CHATWOOT ====================
  async createChatwoot(dto: CreateChatwootDto, userId: string) {
    const config = {
      enabled: dto.enabled !== false, // default true
      sqs: dto.sqs || false,
      url: dto.url || '',
      accountId: dto.accountId || '',
      token: dto.token || '',
      signMessages: dto.signMessages || false,
      signDelimiter: dto.signDelimiter || '\\n',
      nameInbox: dto.nameInbox || '',
      organization: dto.organization || '',
      logo: dto.logo || '',
      conversationPending: dto.conversationPending || false,
      reopenConversation: dto.reopenConversation !== false, // default true
      importContacts: dto.importContacts || false,
      importMessages: dto.importMessages || false,
      daysLimitImport: dto.daysLimitImport || 3,
      ignoreJids: dto.ignoreJids || '',
      autoCreate: dto.autoCreate !== false, // default true
    };
    return this.upsertIntegration(userId, 'chatwoot', config, dto.enabled !== false);
  }

  // ==================== UPDATE / DELETE ====================
  async update(id: string, dto: UpdateIntegrationDto, userId: string) {
    const integration = await this.prisma.integration.findFirst({ 
      where: { id, userId } 
    });
    if (!integration) throw new NotFoundException('Integração não encontrada');
    
    return this.prisma.integration.update({ 
      where: { id }, 
      data: dto 
    });
  }

  async delete(id: string, userId: string) {
    const integration = await this.prisma.integration.findFirst({ 
      where: { id, userId } 
    });
    if (!integration) throw new NotFoundException('Integração não encontrada');
    
    await this.prisma.integration.delete({ where: { id } });
    return { message: 'Integração removida' };
  }

  // ==================== TOGGLE ACTIVE ====================
  async toggleActive(id: string, userId: string, active: boolean) {
    const integration = await this.prisma.integration.findFirst({ 
      where: { id, userId } 
    });
    if (!integration) throw new NotFoundException('Integração não encontrada');
    
    return this.prisma.integration.update({
      where: { id },
      data: { active },
    });
  }
}
