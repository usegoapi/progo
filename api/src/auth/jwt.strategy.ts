import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../config/env';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.jwtSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub: string; tv?: number }) {
    const user = await this.authService.validateTokenPayload(payload);
    if (!user) throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    return user;
  }
}
