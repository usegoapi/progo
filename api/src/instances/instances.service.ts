import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { assertSafeUrl } from '../common/utils/net';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { InstanceSettingsService } from '../shared/instance-settings.service';
import { PrismaService } from '../shared/prisma.service';
import { InstanceSettings } from '../shared/settings.types';
import { BaileysService } from './baileys.service';
import { CreateInstanceDto, UpdateInstanceDto, UpdateSettingsDto } from './dto/instance.dto';

const INSTANCE_SELECT = { id: true, name: true, status: true, apiKey: true, phone: true, createdAt: true, userId: true } as const;
const MAX_INSTANCES_PER_USER = Number(process.env.MAX_INSTANCES_PER_USER || 50);

export const generateApiKey = () => `goapikey_${crypto.randomBytes(24).toString('hex')}`;
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

@Injectable()
export class InstancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly baileys: BaileysService,
    private readonly settings: InstanceSettingsService,
  ) {}

  async findAll(user: AuthUser) {
    const instances = await this.prisma.instance.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: INSTANCE_SELECT,
    });
    return instances.map((i) => this.present(i));
  }

  async findOne(id: string) {
    const instance = await this.prisma.instance.findUnique({ where: { id }, select: INSTANCE_SELECT });
    if (!instance) throw new NotFoundException('Instância não encontrada');
    return this.present(instance);
  }

  async create(dto: CreateInstanceDto, user: AuthUser) {
    const total = await this.prisma.instance.count({ where: { userId: user.id } });
    if (total >= MAX_INSTANCES_PER_USER) {
      throw new BadRequestException(`Limite de ${MAX_INSTANCES_PER_USER} instâncias atingido`);
    }
    const instance = await this.prisma.instance.create({
      data: { name: dto.name.trim(), userId: user.id, apiKey: generateApiKey() },
      select: INSTANCE_SELECT,
    });
    return this.present(instance);
  }

  async update(id: string, dto: UpdateInstanceDto) {
    const instance = await this.prisma.instance.update({
      where: { id },
      data: { name: dto.name.trim() },
      select: INSTANCE_SELECT,
    });
    this.settings.rename(id, instance.name);
    return this.present(instance);
  }

  async rotateApiKey(id: string) {
    const instance = await this.prisma.instance.update({
      where: { id },
      data: { apiKey: generateApiKey() },
      select: { apiKey: true },
    });
    return { apiKey: instance.apiKey };
  }

  async delete(id: string) {
    await this.baileys.remove(id);
    await this.prisma.instance.delete({ where: { id } });
    this.settings.invalidate(id);
    return { message: 'Instância removida com sucesso' };
  }

  async connect(id: string) {
    const { status, qr } = await this.baileys.connect(id);
    return { status, qr, qrCode: qr ? await QRCode.toDataURL(qr) : null };
  }

  async restart(id: string) {
    const { status } = await this.baileys.restart(id);
    return { message: 'Instância reiniciada', status };
  }

  async reconnect(id: string) {
    const { status, qr } = await this.baileys.restart(id);
    return { status, qr, qrCode: qr ? await QRCode.toDataURL(qr) : null };
  }

  async disconnect(id: string) {
    await this.baileys.logout(id);
    return { message: 'Desconectado com sucesso' };
  }

  async getQR(id: string) {
    const info = this.baileys.getInfo(id);
    if (info.status === 'CONNECTED') {
      return { status: 'CONNECTED', qrCode: null, phone: info.phone, profilePic: info.profilePic, profileName: info.profileName };
    }
    const qr = this.baileys.getQR(id);
    if (!qr) return { status: info.status === 'DISCONNECTED' ? 'DISCONNECTED' : 'WAITING', qrCode: null, reason: info.lastError };
    return { status: 'QR_READY', qrCode: await QRCode.toDataURL(qr) };
  }

  getSettings(id: string): Promise<InstanceSettings> {
    return this.settings.get(id);
  }

  async updateSettings(id: string, dto: UpdateSettingsDto) {
    await this.validateOutboundUrls(dto);
    const before = await this.settings.get(id);
    const updated = await this.settings.update(id, dto as any);

    const proxyChanged = JSON.stringify(before.proxy) !== JSON.stringify(updated.proxy);
    const connected = this.baileys.getStatus(id) === 'CONNECTED';
    await this.baileys.applySettings(id);
    return { ...updated, restartRequired: proxyChanged && connected };
  }

  // ───────── Link público de QR Code ─────────

  async createSharedToken(instanceId: string, expiresInHours = 24, permissions = ['view_qr']) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60_000);
    await this.prisma.sharedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.prisma.sharedToken.create({ data: { instanceId, token: hashToken(token), permissions, expiresAt } });
    return { token, expiresAt };
  }

  async getSharedQR(token: string) {
    if (!token || token.length > 128) throw new BadRequestException('Link inválido ou expirado');
    const shared = await this.prisma.sharedToken.findUnique({
      where: { token: hashToken(token) },
      include: { instance: { select: { id: true, name: true } } },
    });
    if (!shared || shared.expiresAt < new Date() || !shared.permissions.includes('view_qr')) {
      throw new BadRequestException('Link inválido ou expirado');
    }

    const { instance } = shared;
    const info = this.baileys.getInfo(instance.id);
    if (info.status === 'CONNECTED') return { status: 'CONNECTED', qrCode: null, instanceName: instance.name };

    // start() é idempotente: múltiplos acessos ao link não abrem conexões duplicadas.
    if (info.status === 'DISCONNECTED') await this.baileys.start(instance.id);
    const qr = this.baileys.getQR(instance.id);
    return {
      status: qr ? 'QR_READY' : 'WAITING',
      qrCode: qr ? await QRCode.toDataURL(qr) : null,
      instanceName: instance.name,
      expiresAt: shared.expiresAt,
    };
  }

  private present(instance: { id: string; name: string; status: string; apiKey: string | null; phone: string | null; createdAt: Date }) {
    const live = this.baileys.getInfo(instance.id);
    return {
      id: instance.id,
      name: instance.name,
      apiKey: instance.apiKey,
      createdAt: instance.createdAt,
      status: live.status,
      phone: live.phone ?? instance.phone,
      profileName: live.profileName,
      profilePic: live.profilePic,
      lastError: live.lastError,
    };
  }

  private async validateOutboundUrls(dto: UpdateSettingsDto) {
    const checks: Array<[boolean | undefined, string | undefined, string]> = [
      [dto.webhook?.enabled, dto.webhook?.url, 'URL do webhook'],
      [dto.typebot?.enabled, dto.typebot?.apiUrl, 'URL do Typebot'],
      [dto.n8n?.enabled, dto.n8n?.webhookUrl, 'URL do n8n'],
      [dto.chatwoot?.enabled, dto.chatwoot?.url, 'URL do Chatwoot'],
    ];
    for (const [enabled, url, label] of checks) {
      if (!enabled) continue;
      if (!url) throw new BadRequestException(`${label} é obrigatória quando a integração está ativa`);
      await assertSafeUrl(url, label);
    }
    if (dto.rabbitmq?.enabled && !/^amqps?:\/\//.test(dto.rabbitmq.uri ?? '')) {
      throw new BadRequestException('URI do RabbitMQ deve começar com amqp:// ou amqps://');
    }
    if (dto.sqs?.enabled && !(dto.sqs.queueUrl && dto.sqs.region && dto.sqs.accessKeyId && dto.sqs.secretAccessKey)) {
      throw new BadRequestException('SQS requer Access Key, Secret, Região e URL da fila');
    }
  }
}
