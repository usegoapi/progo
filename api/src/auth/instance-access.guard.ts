import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';

/**
 * Garante que a instância referenciada (param :id, :instanceId, body.instanceId ou query ?instanceId)
 * pertence ao usuário autenticado. Responde 404 para não revelar ids de terceiros.
 * Deve ser usado depois do JwtAuthGuard.
 */
@Injectable()
export class InstanceAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const instanceId: unknown = req.params?.instanceId ?? req.params?.id ?? req.body?.instanceId ?? req.query?.instanceId;
    if (typeof instanceId !== 'string' || !instanceId) throw new NotFoundException('Instância não encontrada');

    const where = req.user?.role === 'admin' ? { id: instanceId } : { id: instanceId, userId: req.user?.id };
    const instance = await this.prisma.instance.findFirst({ where, select: { id: true, name: true, userId: true } });
    if (!instance) throw new NotFoundException('Instância não encontrada');

    req.instance = instance;
    return true;
  }
}
