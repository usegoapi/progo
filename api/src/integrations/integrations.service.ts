import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { CreateTypebotDto, CreateN8nDto, CreateChatwootDto, UpdateIntegrationDto } from './dto/integration.dto';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.integration.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async createTypebot(dto: CreateTypebotDto, userId: string) {
    return this.prisma.integration.create({
      data: { userId, type: 'typebot', config: JSON.parse(JSON.stringify(dto)) },
    });
  }

  async createN8n(dto: CreateN8nDto, userId: string) {
    return this.prisma.integration.create({
      data: { userId, type: 'n8n', config: JSON.parse(JSON.stringify(dto)) },
    });
  }

  async createChatwoot(dto: CreateChatwootDto, userId: string) {
    return this.prisma.integration.create({
      data: { userId, type: 'chatwoot', config: JSON.parse(JSON.stringify(dto)) },
    });
  }

  async update(id: string, dto: UpdateIntegrationDto, userId: string) {
    const integration = await this.prisma.integration.findFirst({ where: { id, userId } });
    if (!integration) throw new NotFoundException('Integração não encontrada');
    return this.prisma.integration.update({ where: { id }, data: dto });
  }

  async delete(id: string, userId: string) {
    const integration = await this.prisma.integration.findFirst({ where: { id, userId } });
    if (!integration) throw new NotFoundException('Integração não encontrada');
    await this.prisma.integration.delete({ where: { id } });
    return { message: 'Integração removida' };
  }
}
