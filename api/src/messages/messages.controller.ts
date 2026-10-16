import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { InstanceAccessGuard } from '../auth/instance-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { MessageSenderService } from '../instances/message-sender.service';
import {
  CheckNumbersDto,
  SendAudioDto,
  SendContactDto,
  SendDocumentDto,
  SendImageDto,
  SendButtonsDto,
  SendCatalogDto,
  SendProductDto,
  CatalogQuery,
  SendLocationDto,
  SendPollDto,
  SendTextDto,
  SendVideoDto,
} from './dto/message.dto';
import { InteractiveMessagesService } from './interactive-messages.service';
import { MessagesService } from './messages.service';

/** Envio pelo painel (JWT). A posse da instância (body.instanceId) é verificada. */
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly sender: MessageSenderService,
    private readonly interactive: InteractiveMessagesService,
  ) {}

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.messages.stats(user.id);
  }

  @Post('text')
  @UseGuards(InstanceAccessGuard)
  sendText(@Body() dto: SendTextDto) {
    return this.messages.sendText(dto.instanceId, dto, 'panel');
  }

  @Post('image')
  @UseGuards(InstanceAccessGuard)
  sendImage(@Body() dto: SendImageDto) {
    return this.messages.sendImage(dto.instanceId, dto, 'panel');
  }

  @Post('audio')
  @UseGuards(InstanceAccessGuard)
  sendAudio(@Body() dto: SendAudioDto) {
    return this.messages.sendAudio(dto.instanceId, dto, 'panel');
  }

  @Post('video')
  @UseGuards(InstanceAccessGuard)
  sendVideo(@Body() dto: SendVideoDto) {
    return this.messages.sendVideo(dto.instanceId, dto, 'panel');
  }

  @Post('document')
  @UseGuards(InstanceAccessGuard)
  sendDocument(@Body() dto: SendDocumentDto) {
    return this.messages.sendDocument(dto.instanceId, dto, 'panel');
  }

  @Post('contact')
  @UseGuards(InstanceAccessGuard)
  sendContact(@Body() dto: SendContactDto) {
    return this.messages.sendContact(dto.instanceId, dto, 'panel');
  }

  @Post('location')
  @UseGuards(InstanceAccessGuard)
  sendLocation(@Body() dto: SendLocationDto) {
    return this.messages.sendLocation(dto.instanceId, dto, 'panel');
  }

  @Post('buttons')
  @UseGuards(InstanceAccessGuard)
  sendButtons(@Body() dto: SendButtonsDto) {
    return this.interactive.sendButtons(dto.instanceId, dto, 'panel');
  }

  @Post('catalog')
  @UseGuards(InstanceAccessGuard)
  sendCatalog(@Body() dto: SendCatalogDto) {
    return this.interactive.sendCatalog(dto.instanceId, dto, 'panel');
  }

  @Post('product')
  @UseGuards(InstanceAccessGuard)
  sendProduct(@Body() dto: SendProductDto) {
    return this.interactive.sendProduct(dto.instanceId, dto, 'panel');
  }

  /** Produtos do catálogo da instância (ou de outro número Business via ?phone=). */
  @Get('catalog')
  @UseGuards(InstanceAccessGuard)
  catalog(@Query('instanceId') instanceId: string, @Query() query: CatalogQuery) {
    return this.interactive.listCatalog(instanceId, query);
  }

  @Post('poll')
  @UseGuards(InstanceAccessGuard)
  sendPoll(@Body() dto: SendPollDto) {
    return this.messages.sendPoll(dto.instanceId, dto, 'panel');
  }

  @Post('check-numbers')
  @UseGuards(InstanceAccessGuard)
  checkNumbers(@Body() dto: CheckNumbersDto) {
    return this.sender.checkNumbers(dto.instanceId, dto.numbers);
  }
}
