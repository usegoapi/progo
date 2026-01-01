import { Controller, Post, Body, UseGuards, Request, Inject, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, SharedTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InstancesService } from '../instances/instances.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @Inject(forwardRef(() => InstancesService))
    private instancesService: InstancesService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('shared-token')
  @UseGuards(JwtAuthGuard)
  createSharedToken(@Body() dto: SharedTokenDto, @Request() req) {
    return this.instancesService.createSharedToken(
      dto.instanceId,
      req.user.id,
      dto.expiresInHours || 24,
      dto.permissions || ['view_qr'],
    );
  }
}
