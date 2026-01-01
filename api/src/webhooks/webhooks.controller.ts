import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Get()
  findAll(@Request() req) {
    return this.webhooksService.findAll(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateWebhookDto, @Request() req) {
    return this.webhooksService.create(dto, req.user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto, @Request() req) {
    return this.webhooksService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.webhooksService.delete(id, req.user.id);
  }
}
