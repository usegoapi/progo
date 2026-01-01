import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BaileysService, InstanceSettings, InstanceSettingsUpdate } from './baileys.service';
import { CreateInstanceDto, UpdateInstanceDto, UpdateSettingsDto } from './dto/instance.dto';
import { TypebotService } from '../integrations/typebot.service';
import { N8nService } from '../integrations/n8n.service';
import { ChatwootService } from '../integrations/chatwoot.service';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

@Injectable()
export class InstancesService {
  constructor(
    private prisma: PrismaService,
    private baileys: BaileysService,
    @Inject(forwardRef(() => TypebotService))
    private typebot: TypebotService,
    @Inject(forwardRef(() => N8nService))
    private n8n: N8nService,
    @Inject(forwardRef(() => ChatwootService))
    private chatwoot: ChatwootService,
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
    
    // Registrar callbacks das integrações para esta instância
    this.typebot.registerInstance(id);
    this.n8n.registerInstance(id);
    this.chatwoot.registerInstance(id);
    
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
    
    // Registrar callbacks das integrações para esta instância
    this.typebot.registerInstance(id);
    this.n8n.registerInstance(id);
    this.chatwoot.registerInstance(id);
    
    await this.prisma.instance.update({
      where: { id },
      data: { status: qr ? 'WAITING_QR' : 'CONNECTED' },
    });

    return { qr, status: qr ? 'WAITING_QR' : 'CONNECTED' };
  }

  // Reiniciar instância mantendo a sessão (sem precisar de QR)
  async restart(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.baileys.restart(id);
    
    // Registrar callbacks das integrações para esta instância
    this.typebot.registerInstance(id);
    this.n8n.registerInstance(id);
    this.chatwoot.registerInstance(id);
    
    return { message: 'Instância reiniciada com sucesso' };
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

  // Shared Token Methods - Persistido no banco de dados
  async createSharedToken(instanceId: string, userId: string, expiresInHours = 24, permissions = ['view_qr']) {
    // Verificar se a instância pertence ao usuário
    const instance = await this.prisma.instance.findFirst({
      where: { id: instanceId, userId },
    });
    if (!instance) throw new NotFoundException('Instância não encontrada');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Salvar no banco de dados
    await this.prisma.sharedToken.create({
      data: {
        instanceId,
        token,
        permissions,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async getSharedQR(token: string) {
    // Buscar token no banco de dados
    const tokenData = await this.prisma.sharedToken.findUnique({
      where: { token },
      include: { instance: true },
    });
    
    if (!tokenData) {
      throw new BadRequestException('Token inválido ou expirado');
    }
    
    if (new Date() > tokenData.expiresAt) {
      // Deletar token expirado
      await this.prisma.sharedToken.delete({ where: { id: tokenData.id } });
      throw new BadRequestException('Token expirado');
    }

    const instance = tokenData.instance;
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
