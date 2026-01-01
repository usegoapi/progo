import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';
import { CreateTypebotDto, CreateN8nDto, CreateChatwootDto, UpdateIntegrationDto } from './dto/integration.dto';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Get()
  findAll(@Request() req) {
    return this.integrationsService.findAll(req.user.id);
  }

  @Post('typebot')
  createTypebot(@Body() dto: CreateTypebotDto, @Request() req) {
    return this.integrationsService.createTypebot(dto, req.user.id);
  }

  @Post('n8n')
  createN8n(@Body() dto: CreateN8nDto, @Request() req) {
    return this.integrationsService.createN8n(dto, req.user.id);
  }

  @Post('chatwoot')
  createChatwoot(@Body() dto: CreateChatwootDto, @Request() req) {
    return this.integrationsService.createChatwoot(dto, req.user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIntegrationDto, @Request() req) {
    return this.integrationsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.integrationsService.delete(id, req.user.id);
  }
}
