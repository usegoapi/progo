import { Injectable, OnModuleInit } from '@nestjs/common';
import { TtlCache } from '../common/utils/ttl-cache';
import { EventBus } from '../shared/event-bus.service';
import { InstanceSettingsService } from '../shared/instance-settings.service';
import { PrismaService } from '../shared/prisma.service';
import { ChatwootSettings, DEFAULT_SETTINGS, N8nSettings, TypebotSettings } from '../shared/settings.types';

export type IntegrationType = 'typebot' | 'n8n' | 'chatwoot';
type ConfigOf<T extends IntegrationType> = T extends 'typebot' ? TypebotSettings : T extends 'n8n' ? N8nSettings : ChatwootSettings;

/**
 * Resolve qual configuração vale para uma instância:
 * 1. Configuração da própria instância, quando habilitada;
 * 2. Caso contrário, a configuração global do usuário (página Integrações), quando ativa.
 */
@Injectable()
export class IntegrationConfigService implements OnModuleInit {
  private readonly userCache = new TtlCache<string, Record<string, unknown> | null>(30_000, 5_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: InstanceSettingsService,
    private readonly bus: EventBus,
  ) {}

  onModuleInit() {
    this.bus.onConfigChanged(({ scope, key }) => {
      if (scope === 'integrations') this.userCache.deleteWhere((k) => k.startsWith(`${key}:`));
    });
  }

  async resolve<T extends IntegrationType>(instanceId: string, type: T): Promise<ConfigOf<T> | null> {
    const settings = await this.settings.get(instanceId);
    const own = settings[type] as ConfigOf<T>;
    if (own?.enabled) return own;

    const meta = await this.settings.getMeta(instanceId);
    if (!meta) return null;
    const global = await this.getUserConfig(meta.userId, type);
    if (!global) return null;
    return { ...(DEFAULT_SETTINGS[type] as ConfigOf<T>), ...(global as Partial<ConfigOf<T>>), enabled: true };
  }

  private async getUserConfig(userId: string, type: IntegrationType) {
    const key = `${userId}:${type}`;
    const cached = this.userCache.get(key);
    if (cached !== undefined) return cached;

    const integration = await this.prisma.integration.findUnique({ where: { userId_type: { userId, type } } });
    const config = integration?.active && (integration.config as any)?.enabled !== false ? (integration.config as Record<string, unknown>) : null;
    this.userCache.set(key, config);
    return config;
  }
}
