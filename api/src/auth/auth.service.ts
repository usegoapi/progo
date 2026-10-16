import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { env } from '../config/env';
import { PrismaService } from '../shared/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;
// Hash fixo usado para equalizar o tempo de resposta quando o e-mail não existe.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', BCRYPT_ROUNDS);

export const SAFE_USER_SELECT = { id: true, email: true, name: true, role: true } as const;

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Cria o administrador inicial. Nunca sobrescreve a senha sem ADMIN_RESET_PASSWORD=true. */
  async onApplicationBootstrap() {
    try {
      const existing = await this.prisma.user.findUnique({ where: { email: env.adminEmail } });
      if (existing) {
        if (env.adminResetPassword && env.adminPassword) {
          await this.prisma.user.update({
            where: { id: existing.id },
            data: {
              password: await bcrypt.hash(env.adminPassword, BCRYPT_ROUNDS),
              role: 'admin',
              tokenVersion: { increment: 1 },
            },
          });
          this.logger.warn(`Senha do admin ${env.adminEmail} redefinida via ADMIN_RESET_PASSWORD.`);
        }
        return;
      }

      const usersCount = await this.prisma.user.count();
      if (usersCount > 0 && !env.adminPassword) return;

      const generated = !env.adminPassword;
      const password = env.adminPassword || crypto.randomBytes(12).toString('base64url');
      await this.prisma.user.create({
        data: {
          email: env.adminEmail,
          name: 'Administrador',
          role: 'admin',
          password: await bcrypt.hash(password, BCRYPT_ROUNDS),
        },
      });
      this.logger.log(`Administrador criado: ${env.adminEmail}`);
      if (generated) {
        // Exibido uma única vez, apenas no log do servidor.
        this.logger.warn(`ADMIN_PASSWORD não definido. Senha gerada (troque após o login): ${password}`);
      }
    } catch (err) {
      this.logger.error(`Falha ao preparar usuário administrador: ${(err as Error).message}`);
    }
  }

  async register(dto: RegisterDto, requester?: AuthUser) {
    const isAdmin = requester?.role === 'admin';
    if (!env.allowRegistration && !isAdmin) {
      throw new ForbiddenException('Cadastro desativado. Solicite acesso ao administrador.');
    }

    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name?.trim() || dto.email.split('@')[0],
        password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      },
    });

    // Admin cadastrando outro usuário não troca a própria sessão.
    if (isAdmin) return { user: this.toPublicUser(user) };
    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = await bcrypt.compare(dto.password, user?.password ?? DUMMY_HASH);
    if (!user || !valid) throw new UnauthorizedException('Credenciais inválidas');
    return this.issueToken(user);
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: SAFE_USER_SELECT });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS), tokenVersion: { increment: 1 } },
    });
    return this.issueToken(updated);
  }

  /** Usado pela estratégia JWT: garante que o usuário existe e que o token não foi revogado. */
  async validateTokenPayload(payload: { sub: string; tv?: number }): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { ...SAFE_USER_SELECT, tokenVersion: true },
    });
    if (!user || (payload.tv ?? 0) !== user.tokenVersion) return null;
    const { tokenVersion: _tv, ...safe } = user;
    return safe;
  }

  private issueToken(user: { id: string; email: string; name: string | null; role: string; tokenVersion: number }) {
    return {
      token: this.jwt.sign({ sub: user.id, role: user.role, tv: user.tokenVersion }),
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: { id: string; email: string; name: string | null; role: string }) {
    return { id: user.id, email: user.email, name: user.name || user.email.split('@')[0], role: user.role };
  }
}
