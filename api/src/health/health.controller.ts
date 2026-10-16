import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { BaileysService } from '../instances/baileys.service';
import { PrismaService } from '../shared/prisma.service';

const startedAt = Date.now();

@Controller()
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly baileys: BaileysService,
  ) {}

  /** Liveness simples (compatível com a versão anterior). */
  @Get('status')
  status() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Readiness: inclui verificação do banco. Não expõe dados sensíveis. */
  @Get('health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    return {
      status: 'ok',
      database: 'up',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      connectedInstances: this.baileys.countConnected(),
      version: process.env.npm_package_version ?? '2.0.0',
    };
  }
}
