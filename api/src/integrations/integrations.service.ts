import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { assertSafeUrl, outbound } from '../common/utils/net';
import { EventBus } from '../shared/event-bus.service';
import { PrismaService } from '../shared/prisma.service';
import { DEFAULT_SETTINGS } from '../shared/settings.types';
import { CreateChatwootDto, CreateN8nDto, CreateTypebotDto, UpdateIntegrationDto } from './dto/integration.dto';
import { IntegrationType } from './integration-config.service';

const describeError = (err: unknown, service: string): string => {
  const e = err as AxiosError & { code?: string };
  const status = e.response?.status;
  if (status === 401 || status === 403) return `${service}: acesso negado. Verifique as credenciais.`;
  if (status === 404) return `${service}: recurso não encontrado. Verifique a URL e os identificadores.`;
  if (status) return `${service} respondeu com HTTP ${status}`;
  if (e.code === 'ECONNREFUSED') return `${service} não está acessível (conexão recusada)`;
  if (e.code === 'ENOTFOUND') return `${service}: endereço não encontrado`;
  if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') return `${service}: tempo de resposta esgotado`;
  return `${service}: ${(err as Error).message}`;
};

/**
 * Integrações globais do usuário: valem como padrão para todas as instâncias
 * que não tiverem a integração habilitada nas próprias configurações.
 */
@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  findAll(userId: string) {
    return this.prisma.integration.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async saveTypebot(dto: CreateTypebotDto, userId: string) {
    if (dto.enabled !== false) await this.testTypebot(dto);
    return this.upsert(userId, 'typebot', { ...DEFAULT_SETTINGS.typebot, ...dto, enabled: dto.enabled !== false });
  }

  async saveN8n(dto: CreateN8nDto, userId: string) {
    if (dto.enabled !== false) {
      if (!dto.webhookUrl) throw new BadRequestException('n8n requer a URL do webhook');
      await assertSafeUrl(dto.webhookUrl, 'URL do n8n');
    }
    return this.upsert(userId, 'n8n', { ...DEFAULT_SETTINGS.n8n, ...dto, enabled: dto.enabled !== false });
  }

  async saveChatwoot(dto: CreateChatwootDto, userId: string) {
    if (dto.enabled !== false) await this.testChatwoot(dto);
    const signDelimiter = (dto.signDelimiter ?? '\n').replace(/\\n/g, '\n');
    return this.upsert(userId, 'chatwoot', { ...DEFAULT_SETTINGS.chatwoot, ...dto, signDelimiter, enabled: dto.enabled !== false });
  }

  async update(id: string, dto: UpdateIntegrationDto, userId: string) {
    const integration = await this.findOwned(id, userId);
    const config = dto.config ? { ...(integration.config as object), ...dto.config } : undefined;
    const updated = await this.prisma.integration.update({ where: { id }, data: { active: dto.active, config: config as any } });
    this.bus.emitConfigChanged('integrations', userId);
    return updated;
  }

  async delete(id: string, userId: string) {
    await this.findOwned(id, userId);
    await this.prisma.integration.delete({ where: { id } });
    this.bus.emitConfigChanged('integrations', userId);
    return { message: 'Integração removida' };
  }

  // ───────── Testes de conexão ─────────

  async testTypebot(dto: CreateTypebotDto) {
    if (!dto.apiUrl || !dto.publicName) throw new BadRequestException('Typebot requer API URL e Public Name');
    const apiUrl = dto.apiUrl.replace(/\/+$/, '');
    await assertSafeUrl(apiUrl, 'URL do Typebot');
    try {
      // Inicia uma sessão de teste para validar que o bot está publicado e acessível.
      const { data } = await outbound.post(
        `${apiUrl}/api/v1/typebots/${encodeURIComponent(dto.publicName)}/startChat`,
        { isStreamEnabled: false },
        { timeout: 15_000 },
      );
      const bubbles = Array.isArray(data?.messages) ? data.messages.length : 0;
      return { success: true, message: `Conexão com o Typebot OK! O fluxo respondeu com ${bubbles} mensagem(ns).` };
    } catch (err) {
      throw new BadRequestException({ success: false, message: describeError(err, 'Typebot') });
    }
  }

  async testN8n(dto: CreateN8nDto) {
    if (!dto.webhookUrl) throw new BadRequestException('Informe a URL do webhook');
    await assertSafeUrl(dto.webhookUrl, 'URL do n8n');
    const headers: Record<string, string> = {};
    if (dto.basicAuthUser) {
      headers.Authorization = `Basic ${Buffer.from(`${dto.basicAuthUser}:${dto.basicAuthPassword ?? ''}`).toString('base64')}`;
    }
    try {
      const res = await outbound.post(
        dto.webhookUrl,
        { test: true, message: 'Teste de conexão', timestamp: new Date().toISOString() },
        { headers, timeout: 15_000, validateStatus: (s) => s < 500 },
      );
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error(), { response: { status: res.status } });
      if (res.status === 404) {
        return { success: false, message: 'Webhook não encontrado (404). O workflow está ativo/em modo de teste?' };
      }
      return { success: true, message: `Conexão com o n8n OK! (HTTP ${res.status})` };
    } catch (err) {
      throw new BadRequestException({ success: false, message: describeError(err, 'n8n') });
    }
  }

  async testChatwoot(dto: CreateChatwootDto) {
    if (!dto.url || !dto.accountId || !dto.token) throw new BadRequestException('Chatwoot requer URL, Account ID e Token');
    const base = dto.url.replace(/\/+$/, '');
    await assertSafeUrl(base, 'URL do Chatwoot');
    try {
      const { data } = await outbound.get(`${base}/api/v1/accounts/${encodeURIComponent(dto.accountId)}/inboxes`, {
        headers: { api_access_token: dto.token },
        timeout: 15_000,
      });
      const inboxes = data?.payload ?? [];
      return {
        success: true,
        message: `Conexão com o Chatwoot OK! ${inboxes.length} inbox(es) encontrada(s).`,
        inboxes: inboxes.map((i: any) => ({ id: i.id, name: i.name })),
      };
    } catch (err) {
      throw new BadRequestException({ success: false, message: describeError(err, 'Chatwoot') });
    }
  }

  private async upsert(userId: string, type: IntegrationType, config: Record<string, unknown>) {
    const active = config.enabled !== false;
    const result = await this.prisma.integration.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, config: config as any, active },
      update: { config: config as any, active },
    });
    this.bus.emitConfigChanged('integrations', userId);
    return result;
  }

  private async findOwned(id: string, userId: string) {
    const integration = await this.prisma.integration.findFirst({ where: { id, userId } });
    if (!integration) throw new NotFoundException('Integração não encontrada');
    return integration;
  }
}
