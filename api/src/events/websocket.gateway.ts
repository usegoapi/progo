import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { extractApiKey } from '../auth/api-key.guard';
import { AuthService } from '../auth/auth.service';
import { EventBus, PublicEvent } from '../shared/event-bus.service';
import { InstanceSettingsService } from '../shared/instance-settings.service';
import { PrismaService } from '../shared/prisma.service';
import { buildPayload, eventMatches } from './event-filter';

/**
 * Eventos em tempo real via Socket.IO (path /ws).
 * Autenticação: { auth: { apikey } } para uma instância ou { auth: { token } } (JWT) para todas do usuário.
 * Só recebe eventos de instâncias com WebSocket habilitado nas configurações.
 */
@WebSocketGateway({ path: '/ws', cors: { origin: true } })
export class EventsGateway implements OnGatewayConnection, OnModuleInit {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly bus: EventBus,
    private readonly settings: InstanceSettingsService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  onModuleInit() {
    this.bus.onPublic((event) => this.broadcast(event));
  }

  async handleConnection(client: Socket) {
    try {
      const handshake = { ...client.handshake.headers, ...client.handshake.auth, ...client.handshake.query } as Record<string, any>;
      const apiKey = extractApiKey(handshake) ?? (typeof handshake.apikey === 'string' ? handshake.apikey : null);

      if (apiKey) {
        const instance = await this.prisma.instance.findUnique({ where: { apiKey }, select: { id: true } });
        if (!instance) throw new Error('API key inválida');
        await client.join(`instance:${instance.id}`);
        return;
      }

      const token = typeof handshake.token === 'string' ? handshake.token.replace(/^Bearer\s+/i, '') : null;
      if (token) {
        const payload = this.jwt.verify(token);
        const user = await this.auth.validateTokenPayload(payload);
        if (!user) throw new Error('Token inválido');
        const instances = await this.prisma.instance.findMany({ where: { userId: user.id }, select: { id: true } });
        await client.join(instances.map((i) => `instance:${i.id}`));
        return;
      }
      throw new Error('Credenciais ausentes');
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
      client.disconnect(true);
    }
  }

  private async broadcast(evt: PublicEvent) {
    if (!this.server) return;
    const room = `instance:${evt.instanceId}`;
    if (!this.server.sockets.adapter.rooms?.get(room)?.size) return;

    const settings = await this.settings.get(evt.instanceId);
    if (!settings.websocket.enabled || !eventMatches(settings.websocket.events, evt.event)) return;
    const meta = await this.settings.getMeta(evt.instanceId);
    if (!meta) return;

    this.server.to(room).emit(evt.event, buildPayload(evt.event, meta, evt.data, evt.date));
  }
}
