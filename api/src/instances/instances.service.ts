import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BaileysService, InstanceSettings, InstanceSettingsUpdate } from './baileys.service';
import { CreateInstanceDto, UpdateInstanceDto, UpdateSettingsDto } from './dto/instance.dto';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

// Store para tokens compartilhados
const sharedTokens = new Map<string, { instanceId: string; expiresAt: Date; permissions: string[] }>();

@Injectable()
export class InstancesService {
  constructor(
    private prisma: PrismaService,
    private baileys: BaileysService,
  ) {}

  async findAll(userId: string) {
    const instances = await this.prisma.instance.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return instances.map((i) => ({
      ...i,
      status: this.baileys.getStatus(i.id) || i.status,
      phone: this.baileys.getPhone(i.id),
      profilePic: this.baileys.getProfilePic(i.id),
      profileName: this.baileys.getProfileName(i.id),
    }));
  }

  async findOne(id: string, userId: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id, userId },
    });
    if (!instance) throw new NotFoundException('Instância não encontrada');
    return {
      ...instance,
      status: this.baileys.getStatus(id) || instance.status,
      phone: this.baileys.getPhone(id),
      profilePic: this.baileys.getProfilePic(id),
      profileName: this.baileys.getProfileName(id),
    };
  }

  async create(dto: CreateInstanceDto, userId: string) {
    return this.prisma.instance.create({
      data: { name: dto.name, userId },
    });
  }

  async update(id: string, dto: UpdateInstanceDto, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.instance.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.baileys.deleteSession(id);
    await this.prisma.instance.delete({ where: { id } });
    return { message: 'Instância removida com sucesso' };
  }

  async connect(id: string, userId: string) {
    await this.findOne(id, userId);
    const qr = await this.baileys.connect(id);
    
    await this.prisma.instance.update({
      where: { id },
      data: { status: qr ? 'WAITING_QR' : 'CONNECTED' },
    });

    return { qr, status: qr ? 'WAITING_QR' : 'CONNECTED' };
  }

  async disconnect(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.baileys.disconnect(id);
    
    await this.prisma.instance.update({
      where: { id },
      data: { status: 'DISCONNECTED' },
    });

    return { message: 'Desconectado com sucesso' };
  }

  async reconnect(id: string, userId: string) {
    await this.findOne(id, userId);
    const qr = await this.baileys.reconnect(id);
    
    await this.prisma.instance.update({
      where: { id },
      data: { status: qr ? 'WAITING_QR' : 'CONNECTED' },
    });

    return { qr, status: qr ? 'WAITING_QR' : 'CONNECTED' };
  }

  async getQR(id: string, userId: string) {
    await this.findOne(id, userId);
    const qr = this.baileys.getQR(id);
    const status = this.baileys.getStatus(id);
    
    if (status === 'CONNECTED') {
      return { 
        status: 'CONNECTED', 
        qrCode: null,
        phone: this.baileys.getPhone(id),
        profilePic: this.baileys.getProfilePic(id),
        profileName: this.baileys.getProfileName(id),
      };
    }
    
    if (!qr) {
      return { status: 'WAITING', qrCode: null };
    }

    const qrCode = await QRCode.toDataURL(qr);
    return { status: 'QR_READY', qrCode };
  }

  async getSettings(id: string, userId: string): Promise<InstanceSettings> {
    await this.findOne(id, userId);
    return this.baileys.getSettings(id);
  }

  async updateSettings(id: string, dto: UpdateSettingsDto, userId: string): Promise<InstanceSettings> {
    await this.findOne(id, userId);
    return this.baileys.setSettings(id, dto);
  }

  // Shared Token Methods
  async createSharedToken(instanceId: string, userId: string, expiresInHours = 24, permissions = ['view_qr']) {
    // Verificar se a instância pertence ao usuário
    const instance = await this.prisma.instance.findFirst({
      where: { id: instanceId, userId },
    });
    if (!instance) throw new NotFoundException('Instância não encontrada');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    sharedTokens.set(token, { instanceId, expiresAt, permissions });

    return { token, expiresAt };
  }

  async getSharedQR(token: string) {
    const tokenData = sharedTokens.get(token);
    
    if (!tokenData) {
      throw new BadRequestException('Token inválido ou expirado');
    }
    
    if (new Date() > tokenData.expiresAt) {
      sharedTokens.delete(token);
      throw new BadRequestException('Token expirado');
    }

    const instance = await this.prisma.instance.findUnique({
      where: { id: tokenData.instanceId },
    });
    if (!instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    const qr = this.baileys.getQR(tokenData.instanceId);
    const status = this.baileys.getStatus(tokenData.instanceId);

    if (status === 'CONNECTED') {
      return {
        status: 'CONNECTED',
        qrCode: null,
        instanceName: instance.name,
      };
    }

    if (!qr) {
      // Tentar conectar se não estiver conectado
      await this.baileys.connect(tokenData.instanceId);
      return {
        status: 'WAITING',
        qrCode: null,
        instanceName: instance.name,
      };
    }

    const qrCode = await QRCode.toDataURL(qr);
    return {
      status: 'QR_READY',
      qrCode,
      instanceName: instance.name,
    };
  }
}
