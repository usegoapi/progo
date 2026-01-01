import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InstancesService } from './instances.service';
import { CreateInstanceDto, UpdateInstanceDto, UpdateSettingsDto, SharedTokenDto } from './dto/instance.dto';

@Controller('instances')
export class InstancesController {
  constructor(private instancesService: InstancesService) {}

  // Endpoint público para QR compartilhado
  @Get('shared/:token')
  getSharedQR(@Param('token') token: string) {
    return this.instancesService.getSharedQR(token);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req: any) {
    return this.instancesService.findAll(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.instancesService.findOne(id, req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateInstanceDto, @Request() req: any) {
    return this.instancesService.create(dto, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateInstanceDto, @Request() req: any) {
    return this.instancesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Request() req: any) {
    return this.instancesService.delete(id, req.user.id);
  }

  @Post(':id/connect')
  @UseGuards(JwtAuthGuard)
  connect(@Param('id') id: string, @Request() req: any) {
    return this.instancesService.connect(id, req.user.id);
  }

  @Post(':id/disconnect')
  @UseGuards(JwtAuthGuard)
  disconnect(@Param('id') id: string, @Request() req: any) {
    return this.instancesService.disconnect(id, req.user.id);
  }

  @Post(':id/reconnect')
  @UseGuards(JwtAuthGuard)
  reconnect(@Param('id') id: string, @Request() req: any) {
    return this.instancesService.reconnect(id, req.user.id);
  }

  @Post(':id/restart')
  @UseGuards(JwtAuthGuard)
  restart(@Param('id') id: string, @Request() req: any) {
    return this.instancesService.restart(id, req.user.id);
  }

  @Get(':id/qr')
  @UseGuards(JwtAuthGuard)
  getQR(@Param('id') id: string, @Request() req: any) {
    return this.instancesService.getQR(id, req.user.id);
  }

  @Get(':id/settings')
  @UseGuards(JwtAuthGuard)
  getSettings(@Param('id') id: string, @Request() req: any) {
    return this.instancesService.getSettings(id, req.user.id);
  }

  @Put(':id/settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(@Param('id') id: string, @Body() dto: UpdateSettingsDto, @Request() req: any) {
    return this.instancesService.updateSettings(id, dto, req.user.id);
  }
}

// Controller separado para manter a rota /auth/shared-token
@Controller('auth')
export class AuthSharedTokenController {
  constructor(private instancesService: InstancesService) {}

  @Post('shared-token')
  @UseGuards(JwtAuthGuard)
  createSharedToken(@Body() dto: SharedTokenDto, @Request() req: any) {
    return this.instancesService.createSharedToken(
      dto.instanceId,
      req.user.id,
      dto.expiresInHours || 24,
      dto.permissions || ['view_qr'],
    );
  }
}
