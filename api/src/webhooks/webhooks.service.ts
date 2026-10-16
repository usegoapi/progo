import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { assertSafeUrl } from '../common/utils/net';
import { maskSecret } from '../common/utils/privacy';
import { WebhookDispatcher } from '../events/webhook-dispatcher.service';
import { EventBus, resolveEventName } from '../shared/event-bus.service';
import { PrismaService } from '../shared/prisma.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly dispatcher: WebhookDispatcher,
  ) {}

  async findAll(userId: string) {
    const hooks = await this.prisma.webhook.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    // O segredo nunca volta inteiro para o cliente.
    return hooks.map(({ secret, ...hook }) => ({ ...hook, hasSecret: !!secret, secret: maskSecret(secret) }));
  }

  async create(dto: CreateWebhookDto, userId: string) {
    await this.validate(dto.url, dto.events, dto.instanceId, userId);
    const hook = await this.prisma.webhook.create({
      data: { url: dto.url, events: dto.events, secret: dto.secret ?? null, instanceId: dto.instanceId ?? null, userId },
    });
    this.bus.emitConfigChanged('webhooks', userId);
    const { secret, ...rest } = hook;
    return { ...rest, hasSecret: !!secret, secret: maskSecret(secret) };
  }

  async update(id: string, dto: UpdateWebhookDto, userId: string) {
    const hook = await this.findOwned(id, userId);
    await this.validate(dto.url ?? hook.url, dto.events ?? hook.events, dto.instanceId ?? undefined, userId);
    // Um segredo mascarado devolvido pelo cliente significa "manter o atual".
    const data = { ...dto };
    if (typeof data.secret === 'string' && data.secret.includes('****')) delete data.secret;
    const updated = await this.prisma.webhook.update({ where: { id }, data });
    this.bus.emitConfigChanged('webhooks', userId);
    const { secret, ...rest } = updated;
    return { ...rest, hasSecret: !!secret, secret: maskSecret(secret) };
  }

  async delete(id: string, userId: string) {
    await this.findOwned(id, userId);
    await this.prisma.webhook.delete({ where: { id } });
    this.bus.emitConfigChanged('webhooks', userId);
    return { message: 'Webhook removido' };
  }

  async test(id: string, userId: string) {
    const hook = await this.findOwned(id, userId);
    try {
      const { status } = await this.dispatcher.sendTest(hook.url, hook.secret);
      return { success: status < 400, status, message: `O endpoint respondeu com HTTP ${status}` };
    } catch (err) {
      return { success: false, message: `Falha na entrega: ${(err as Error).message}` };
    }
  }

  private async findOwned(id: string, userId: string) {
    const hook = await this.prisma.webhook.findFirst({ where: { id, userId } });
    if (!hook) throw new NotFoundException('Webhook não encontrado');
    return hook;
  }

  private async validate(url: string, events: string[], instanceId: string | undefined, userId: string) {
    await assertSafeUrl(url, 'URL do webhook');
    const invalid = events.filter((e) => !resolveEventName(e));
    if (invalid.length) throw new BadRequestException(`Eventos desconhecidos: ${invalid.join(', ')}`);
    if (instanceId) {
      const owns = await this.prisma.instance.count({ where: { id: instanceId, userId } });
      if (!owns) throw new NotFoundException('Instância não encontrada');
    }
  }
}
