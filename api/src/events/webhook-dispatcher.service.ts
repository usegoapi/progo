import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { assertSafeUrl, outbound } from '../common/utils/net';
import { safeUrl } from '../common/utils/privacy';
import { TtlCache } from '../common/utils/ttl-cache';
import { EventBus, PublicEvent } from '../shared/event-bus.service';
import { InstanceSettingsService } from '../shared/instance-settings.service';
import { PrismaService } from '../shared/prisma.service';
import { buildPayload, eventMatches, safeStringify } from './event-filter';

import { describeError } from '../common/utils/errors';
interface Delivery {
  url: string;
  body: string;
  event: string;
  secret?: string | null;
  attempt: number;
}

interface GlobalWebhook {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  instanceId: string | null;
}

const MAX_CONCURRENCY = 16;
const MAX_QUEUE = 5_000;
const RETRY_DELAYS = [2_000, 10_000, 30_000];

/**
 * Entrega de eventos via HTTP POST:
 * - Webhook da instância (Configurações > Webhook)
 * - Webhooks globais do usuário (página Webhooks)
 *
 * Fila com concorrência limitada, timeout, 3 novas tentativas com backoff
 * e assinatura HMAC-SHA256 (header X-Signature) quando há segredo.
 */
@Injectable()
export class WebhookDispatcher implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatcher.name);
  private readonly globalCache = new TtlCache<string, GlobalWebhook[]>(30_000, 5_000);
  private readonly queue: Delivery[] = [];
  private active = 0;

  constructor(
    private readonly bus: EventBus,
    private readonly settings: InstanceSettingsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.bus.onPublic((event) => this.handle(event));
    this.bus.onConfigChanged(({ scope, key }) => scope === 'webhooks' && this.globalCache.delete(key));
  }

  private async handle(evt: PublicEvent) {
    const meta = await this.settings.getMeta(evt.instanceId);
    if (!meta) return;
    const settings = await this.settings.get(evt.instanceId);

    const targets: Array<{ url: string; secret?: string | null }> = [];
    if (settings.webhook.enabled && settings.webhook.url && eventMatches(settings.webhook.events, evt.event)) {
      targets.push({ url: settings.webhook.url, secret: settings.webhook.secret });
    }
    for (const hook of await this.getGlobalWebhooks(meta.userId)) {
      if (hook.instanceId && hook.instanceId !== evt.instanceId) continue;
      if (hook.events.length > 0 && eventMatches(hook.events, evt.event)) targets.push({ url: hook.url, secret: hook.secret });
    }
    if (targets.length === 0) return;

    const body = safeStringify(buildPayload(evt.event, meta, evt.data, evt.date));
    for (const target of targets) this.enqueue({ ...target, body, event: evt.event, attempt: 0 });
  }

  /** Usado pelo endpoint de teste da página Webhooks. */
  async sendTest(url: string, secret?: string | null) {
    const body = safeStringify({ event: 'TEST', data: { message: 'Teste de webhook' }, date_time: new Date().toISOString() });
    return this.post({ url, body, event: 'TEST', secret, attempt: 0 });
  }

  private async getGlobalWebhooks(userId: string): Promise<GlobalWebhook[]> {
    const cached = this.globalCache.get(userId);
    if (cached) return cached;
    const hooks = await this.prisma.webhook.findMany({
      where: { userId, active: true },
      select: { id: true, url: true, events: true, secret: true, instanceId: true },
    });
    this.globalCache.set(userId, hooks);
    return hooks;
  }

  private enqueue(delivery: Delivery) {
    if (this.queue.length >= MAX_QUEUE) {
      this.queue.shift();
      this.logger.warn('Fila de webhooks cheia: evento mais antigo descartado');
    }
    this.queue.push(delivery);
    this.drain();
  }

  private drain() {
    while (this.active < MAX_CONCURRENCY && this.queue.length > 0) {
      const delivery = this.queue.shift()!;
      this.active++;
      this.post(delivery)
        .catch(() => undefined)
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }

  private async post(delivery: Delivery): Promise<{ status: number }> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Event': delivery.event,
      'X-Delivery-Id': crypto.randomUUID(),
      'X-Timestamp': timestamp,
    };
    if (delivery.secret) {
      const signature = crypto.createHmac('sha256', delivery.secret).update(`${timestamp}.${delivery.body}`).digest('hex');
      headers['X-Signature'] = `sha256=${signature}`;
    }

    try {
      await assertSafeUrl(delivery.url, 'URL do webhook');
      const res = await outbound.post(delivery.url, delivery.body, {
        headers,
        timeout: 10_000,
        validateStatus: () => true,
        transformRequest: [(data) => data],
      });
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      if (res.status >= 400) this.logger.warn(`Webhook ${safeUrl(delivery.url)} respondeu ${res.status} (${delivery.event})`);
      return { status: res.status };
    } catch (err) {
      const message = describeError(err);
      if (delivery.attempt < RETRY_DELAYS.length && !/inválida|bloqueado|http:\/\//.test(message)) {
        const delay = RETRY_DELAYS[delivery.attempt];
        setTimeout(() => this.enqueue({ ...delivery, attempt: delivery.attempt + 1 }), delay).unref();
      } else {
        this.logger.warn(`Webhook ${safeUrl(delivery.url)} falhou (${delivery.event}): ${message}`);
      }
      throw err;
    }
  }
}
