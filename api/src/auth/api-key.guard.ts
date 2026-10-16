import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { SAFE_USER_SELECT } from './auth.service';

/** Extrai a API key dos headers aceitos: x-api-key, apikey ou Authorization: Bearer goapikey_... */
export function extractApiKey(headers: Record<string, any>): string | null {
  const direct = headers['x-api-key'] ?? headers['apikey'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const auth = headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer goapikey_')) return auth.slice(7).trim();
  return null;
}

/**
 * Autenticação das rotas /api/* por API key da instância.
 * A instância autenticada fica em req.instance e o dono em req.user.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = extractApiKey(request.headers);
    if (!apiKey) throw new UnauthorizedException('API key não informada. Envie o header x-api-key.');
    if (!/^goapikey_[a-f0-9]{48}$/.test(apiKey)) throw new UnauthorizedException('API key inválida');

    const instance = await this.prisma.instance.findUnique({
      where: { apiKey },
      select: { id: true, name: true, userId: true, user: { select: SAFE_USER_SELECT } },
    });
    if (!instance) throw new UnauthorizedException('API key inválida');

    request.instance = { id: instance.id, name: instance.name, userId: instance.userId };
    request.user = instance.user;
    return true;
  }
}
