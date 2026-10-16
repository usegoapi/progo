import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateChatwootDto, CreateN8nDto, CreateTypebotDto, UpdateIntegrationDto } from './dto/integration.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.integrations.findAll(user.id);
  }

  @Post('typebot')
  async createTypebot(@Body() dto: CreateTypebotDto, @CurrentUser() user: AuthUser) {
    const result = await this.integrations.saveTypebot(dto, user.id);
    return { ...result, success: true, message: 'Integração Typebot salva com sucesso!' };
  }

  @Post('typebot/test')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  testTypebot(@Body() dto: CreateTypebotDto) {
    return this.integrations.testTypebot(dto);
  }

  @Post('n8n')
  async createN8n(@Body() dto: CreateN8nDto, @CurrentUser() user: AuthUser) {
    const result = await this.integrations.saveN8n(dto, user.id);
    return { ...result, success: true, message: 'Integração n8n salva com sucesso!' };
  }

  @Post('n8n/test')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  testN8n(@Body() dto: CreateN8nDto) {
    return this.integrations.testN8n(dto);
  }

  @Post('chatwoot')
  async createChatwoot(@Body() dto: CreateChatwootDto, @CurrentUser() user: AuthUser) {
    const result = await this.integrations.saveChatwoot(dto, user.id);
    return { ...result, success: true, message: 'Integração Chatwoot salva e validada com sucesso!' };
  }

  @Post('chatwoot/test')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  testChatwoot(@Body() dto: CreateChatwootDto) {
    return this.integrations.testChatwoot(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIntegrationDto, @CurrentUser() user: AuthUser) {
    return this.integrations.update(id, dto, user.id);
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.integrations.delete(id, user.id);
  }
}
