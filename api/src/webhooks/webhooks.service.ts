import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.webhook.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateWebhookDto, userId: string) {
    return this.prisma.webhook.create({ data: { ...dto, userId } });
  }

  async update(id: string, dto: UpdateWebhookDto, userId: string) {
    const webhook = await this.prisma.webhook.findFirst({ where: { id, userId } });
    if (!webhook) throw new NotFoundException('Webhook não encontrado');
    return this.prisma.webhook.update({ where: { id }, data: dto });
  }

  async delete(id: string, userId: string) {
    const webhook = await this.prisma.webhook.findFirst({ where: { id, userId } });
    if (!webhook) throw new NotFoundException('Webhook não encontrado');
    await this.prisma.webhook.delete({ where: { id } });
    return { message: 'Webhook removido' };
  }

  async trigger(instanceId: string, event: string, data: any) {
    const instance = await this.prisma.instance.findUnique({ where: { id: instanceId } });
    if (!instance) return;

    const webhooks = await this.prisma.webhook.findMany({
      where: { userId: instance.userId, active: true, events: { has: event } },
    });

    for (const webhook of webhooks) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, instanceId, data, timestamp: new Date().toISOString() }),
        });
      } catch (err) {
        this.logger.error(`Webhook ${webhook.id} falhou: ${err.message}`);
      }
    }
  }
}
