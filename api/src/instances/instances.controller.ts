import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InstanceAccessGuard } from '../auth/instance-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateInstanceDto, SharedTokenDto, UpdateInstanceDto, UpdateSettingsDto } from './dto/instance.dto';
import { InstancesService } from './instances.service';

@Controller('instances')
export class InstancesController {
  constructor(private readonly instances: InstancesService) {}

  /** Público: página de QR compartilhado (token de uso limitado). */
  @Get('shared/:token')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  getSharedQR(@Param('token') token: string) {
    return this.instances.getSharedQR(token);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() user: AuthUser) {
    return this.instances.findAll(user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateInstanceDto, @CurrentUser() user: AuthUser) {
    return this.instances.create(dto, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  findOne(@Param('id') id: string) {
    return this.instances.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  update(@Param('id') id: string, @Body() dto: UpdateInstanceDto) {
    return this.instances.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  delete(@Param('id') id: string) {
    return this.instances.delete(id);
  }

  @Post(':id/connect')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  connect(@Param('id') id: string) {
    return this.instances.connect(id);
  }

  @Post(':id/disconnect')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  disconnect(@Param('id') id: string) {
    return this.instances.disconnect(id);
  }

  @Post(':id/reconnect')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  reconnect(@Param('id') id: string) {
    return this.instances.reconnect(id);
  }

  @Post(':id/restart')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  restart(@Param('id') id: string) {
    return this.instances.restart(id);
  }

  @Post(':id/rotate-key')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  rotateApiKey(@Param('id') id: string) {
    return this.instances.rotateApiKey(id);
  }

  @Get(':id/qr')
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  getQR(@Param('id') id: string) {
    return this.instances.getQR(id);
  }

  @Get(':id/settings')
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  getSettings(@Param('id') id: string) {
    return this.instances.getSettings(id);
  }

  @Put(':id/settings')
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  updateSettings(@Param('id') id: string, @Body() dto: UpdateSettingsDto) {
    return this.instances.updateSettings(id, dto);
  }
}

/** Mantém a rota /auth/shared-token usada pelo painel. */
@Controller('auth')
export class SharedTokenController {
  constructor(private readonly instances: InstancesService) {}

  @Post('shared-token')
  @UseGuards(JwtAuthGuard, InstanceAccessGuard)
  createSharedToken(@Body() dto: SharedTokenDto) {
    return this.instances.createSharedToken(dto.instanceId, dto.expiresInHours ?? 24, dto.permissions ?? ['view_qr']);
  }
}
