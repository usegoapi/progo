import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { CreateTypebotDto, CreateN8nDto, CreateChatwootDto, UpdateIntegrationDto } from './dto/integration.dto';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

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
    
    if (existing) {
      return this.prisma.integration.update({
        where: { id: existing.id },
        data: { config, active },
      });
    }
    
    return this.prisma.integration.create({
      data: { userId, type, config, active },
    });
  }

  // ==================== TYPEBOT ====================
  async createTypebot(dto: CreateTypebotDto, userId: string) {
    const config = {
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
    return this.upsertIntegration(userId, 'typebot', config);
  }

  // ==================== N8N ====================
  async createN8n(dto: CreateN8nDto, userId: string) {
    const config = {
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
    return this.upsertIntegration(userId, 'n8n', config);
  }

  // ==================== CHATWOOT ====================
  async createChatwoot(dto: CreateChatwootDto, userId: string) {
    const config = {
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
    return this.upsertIntegration(userId, 'chatwoot', config);
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
