import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || request.headers['apikey'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key não fornecida. Use o header x-api-key');
    }

    // Buscar instância pela apiKey
    const instance = await this.prisma.instance.findFirst({
      where: { apiKey },
      include: { user: true },
    });

    if (!instance) {
      throw new UnauthorizedException('API Key inválida');
    }

    // Adicionar instância e usuário ao request para uso posterior
    request.instance = instance;
    request.user = instance.user;
    request.instanceId = instance.id;

    return true;
  }
}
