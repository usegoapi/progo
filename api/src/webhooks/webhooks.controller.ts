import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { WA_EVENTS } from '../shared/event-bus.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get('events')
  events() {
    return { events: WA_EVENTS };
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.webhooks.findAll(user.id);
  }

  @Post()
  create(@Body() dto: CreateWebhookDto, @CurrentUser() user: AuthUser) {
    return this.webhooks.create(dto, user.id);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWebhookDto, @CurrentUser() user: AuthUser) {
    return this.webhooks.update(id, dto, user.id);
  }

  @Post(':id/test')
  @HttpCode(200)
  test(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.webhooks.test(id, user.id);
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.webhooks.delete(id, user.id);
  }
}
