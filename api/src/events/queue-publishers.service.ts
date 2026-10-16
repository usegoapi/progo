import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import * as amqp from 'amqplib';
import * as crypto from 'crypto';
import { safeUrl } from '../common/utils/privacy';
import { EventBus, PublicEvent } from '../shared/event-bus.service';
import { InstanceSettingsService } from '../shared/instance-settings.service';
import { RabbitMQSettings, SQSSettings } from '../shared/settings.types';
import { buildPayload, eventMatches, safeStringify } from './event-filter';

import { describeError } from '../common/utils/errors';
interface RabbitConnection {
  connection: Awaited<ReturnType<typeof amqp.connect>>;
  channel: amqp.Channel;
  exchanges: Set<string>;
}

/** Publica eventos em RabbitMQ (exchange topic) e Amazon SQS conforme as configurações da instância. */
@Injectable()
export class QueuePublishers implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueuePublishers.name);
  private readonly rabbit = new Map<string, Promise<RabbitConnection>>();
  private readonly sqsClients = new Map<string, SQSClient>();
  private readonly lastErrorLog = new Map<string, number>();

  constructor(
    private readonly bus: EventBus,
    private readonly settings: InstanceSettingsService,
  ) {}

  onModuleInit() {
    this.bus.onPublic((event) => this.handle(event));
  }

  async onApplicationShutdown() {
    for (const pending of this.rabbit.values()) {
      pending.then((r) => r.connection.close()).catch(() => undefined);
    }
    for (const client of this.sqsClients.values()) client.destroy();
  }

  private async handle(evt: PublicEvent) {
    const settings = this.settings.peek(evt.instanceId) ?? (await this.settings.get(evt.instanceId));
    const rabbitOn = settings.rabbitmq.enabled && settings.rabbitmq.uri && eventMatches(settings.rabbitmq.events, evt.event);
    const sqsOn = settings.sqs.enabled && settings.sqs.queueUrl && eventMatches(settings.sqs.events, evt.event);
    if (!rabbitOn && !sqsOn) return;

    const meta = await this.settings.getMeta(evt.instanceId);
    if (!meta) return;
    const body = safeStringify(buildPayload(evt.event, meta, evt.data, evt.date));

    if (rabbitOn) await this.publishRabbit(settings.rabbitmq, meta.name, evt.event, body).catch((err) => this.logThrottled('rabbit', err));
    if (sqsOn) await this.publishSqs(settings.sqs, evt.event, evt.instanceId, body).catch((err) => this.logThrottled('sqs', err));
  }

  private async publishRabbit(config: RabbitMQSettings, instanceName: string, event: string, body: string) {
    const exchange = config.exchange || 'goapi';
    const conn = await this.getRabbit(config.uri);
    if (!conn.exchanges.has(exchange)) {
      await conn.channel.assertExchange(exchange, 'topic', { durable: true });
      conn.exchanges.add(exchange);
    }
    const routingKey = `${instanceName.replace(/[^\w-]/g, '_')}.${event.toLowerCase()}`;
    conn.channel.publish(exchange, routingKey, Buffer.from(body), {
      contentType: 'application/json',
      persistent: true,
      type: event,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  private getRabbit(uri: string): Promise<RabbitConnection> {
    let pending = this.rabbit.get(uri);
    if (pending) return pending;

    pending = (async () => {
      const connection = await amqp.connect(uri, { timeout: 10_000 });
      const channel = await connection.createChannel();
      const drop = () => this.rabbit.delete(uri);
      connection.on('error', drop);
      connection.on('close', drop);
      channel.on('error', drop);
      this.logger.log(`RabbitMQ conectado: ${safeUrl(uri.replace(/^amqp/, 'http'))}`);
      return { connection, channel, exchanges: new Set<string>() };
    })();
    pending.catch(() => this.rabbit.delete(uri));
    this.rabbit.set(uri, pending);
    return pending;
  }

  private async publishSqs(config: SQSSettings, event: string, instanceId: string, body: string) {
    const key = `${config.region}:${config.accessKeyId}`;
    let client = this.sqsClients.get(key);
    if (!client) {
      client = new SQSClient({
        region: config.region,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      });
      this.sqsClients.set(key, client);
    }
    const isFifo = config.queueUrl.endsWith('.fifo');
    await client.send(
      new SendMessageCommand({
        QueueUrl: config.queueUrl,
        MessageBody: body,
        MessageAttributes: { event: { DataType: 'String', StringValue: event } },
        ...(isFifo ? { MessageGroupId: instanceId, MessageDeduplicationId: crypto.randomUUID() } : {}),
      }),
    );
  }

  /** Evita inundar o log quando um destino fica fora do ar. */
  private logThrottled(target: string, err: Error) {
    const now = Date.now();
    if (now - (this.lastErrorLog.get(target) ?? 0) < 60_000) return;
    this.lastErrorLog.set(target, now);
    this.logger.warn(`Falha ao publicar no ${target}: ${describeError(err)}`);
  }
}
