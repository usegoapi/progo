import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import { EventBus } from './event-bus.service';
import { PrismaService } from './prisma.service';
import { DEFAULT_SETTINGS, InstanceSettings, InstanceSettingsPatch, mergeSettings } from './settings.types';

export interface InstanceMeta {
  id: string;
  name: string;
  userId: string;
}

/**
 * Fonte única das configurações por instância (persistidas no banco).
 * Mantém cache em memória para o caminho quente (cada mensagem recebida).
 * Migra automaticamente o antigo sessions/<id>/settings.json.
 */
@Injectable()
export class InstanceSettingsService {
  private readonly logger = new Logger(InstanceSettingsService.name);
  private readonly cache = new Map<string, { settings: InstanceSettings; meta: InstanceMeta }>();
  private readonly loading = new Map<string, Promise<{ settings: InstanceSettings; meta: InstanceMeta } | null>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  async get(instanceId: string): Promise<InstanceSettings> {
    return (await this.load(instanceId))?.settings ?? structuredClone(DEFAULT_SETTINGS);
  }

  async getMeta(instanceId: string): Promise<InstanceMeta | null> {
    return (await this.load(instanceId))?.meta ?? null;
  }

  /** Acesso síncrono ao que já está em cache (usado em handlers de alta frequência). */
  peek(instanceId: string): InstanceSettings | null {
    return this.cache.get(instanceId)?.settings ?? null;
  }

  async update(instanceId: string, patch: InstanceSettingsPatch): Promise<InstanceSettings> {
    const current = await this.get(instanceId);
    const next = mergeSettings(current, patch);
    await this.prisma.instance.update({ where: { id: instanceId }, data: { settings: next as any } });
    const entry = this.cache.get(instanceId);
    if (entry) entry.settings = next;
    this.bus.emitConfigChanged('instance', instanceId);
    return next;
  }

  rename(instanceId: string, name: string) {
    const entry = this.cache.get(instanceId);
    if (entry) entry.meta.name = name;
  }

  invalidate(instanceId: string) {
    this.cache.delete(instanceId);
  }

  private load(instanceId: string) {
    const cached = this.cache.get(instanceId);
    if (cached) return Promise.resolve(cached);

    let pending = this.loading.get(instanceId);
    if (!pending) {
      pending = this.fetch(instanceId).finally(() => this.loading.delete(instanceId));
      this.loading.set(instanceId, pending);
    }
    return pending;
  }

  private async fetch(instanceId: string) {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: { id: true, name: true, userId: true, settings: true },
    });
    if (!instance) return null;

    let stored = instance.settings as InstanceSettingsPatch | null;
    if (!stored) {
      stored = this.readLegacyFile(instanceId);
      if (stored) {
        await this.prisma.instance
          .update({ where: { id: instanceId }, data: { settings: mergeSettings(DEFAULT_SETTINGS, stored) as any } })
          .catch(() => undefined);
        this.logger.log(`Configurações da instância ${instanceId} migradas do settings.json para o banco`);
      }
    }

    const entry = {
      settings: mergeSettings(DEFAULT_SETTINGS, stored),
      meta: { id: instance.id, name: instance.name, userId: instance.userId },
    };
    this.cache.set(instanceId, entry);
    return entry;
  }

  private readLegacyFile(instanceId: string): InstanceSettingsPatch | null {
    const file = path.join(path.resolve(env.sessionsDir), instanceId, 'settings.json');
    try {
      if (!fs.existsSync(file)) return null;
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      fs.renameSync(file, `${file}.migrated`);
      return parsed;
    } catch {
      return null;
    }
  }
}
