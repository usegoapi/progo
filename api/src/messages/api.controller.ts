import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { BaileysService } from '../instances/baileys.service';
import { MessageSenderService } from '../instances/message-sender.service';
import {
  CheckNumbersBody,
  SendAudioBody,
  SendContactBody,
  SendDocumentBody,
  SendImageBody,
  SendButtonsBody,
  SendCatalogBody,
  SendProductBody,
  CatalogQuery,
  SendLocationBody,
  SendPollBody,
  SendTextBody,
  SendVideoBody,
} from './dto/message.dto';
import { InteractiveMessagesService } from './interactive-messages.service';
import { MessagesService } from './messages.service';

type ApiRequest = { instance: { id: string; name: string } };

/**
 * API pública para integrações externas. Autenticação por API key da instância
 * (header x-api-key ou apikey); a instância é definida pela chave, nunca pelo corpo.
 */
@Controller('api')
@UseGuards(ApiKeyGuard)
export class ApiController {
  constructor(
    private readonly messages: MessagesService,
    private readonly baileys: BaileysService,
    private readonly sender: MessageSenderService,
    private readonly interactive: InteractiveMessagesService,
  ) {}

  @Get('instance')
  instance(@Req() req: ApiRequest) {
    const info = this.baileys.getInfo(req.instance.id);
    return {
      id: req.instance.id,
      name: req.instance.name,
      status: info.status,
      phone: info.phone,
      profileName: info.profileName,
      queue: this.sender.getQueueSize(req.instance.id),
    };
  }

  @Post('check-numbers')
  @HttpCode(200)
  checkNumbers(@Body() dto: CheckNumbersBody, @Req() req: ApiRequest) {
    return this.sender.checkNumbers(req.instance.id, dto.numbers);
  }

  @Post('send/text')
  sendText(@Body() dto: SendTextBody, @Req() req: ApiRequest) {
    return this.messages.sendText(req.instance.id, dto);
  }

  @Post('send/image')
  sendImage(@Body() dto: SendImageBody, @Req() req: ApiRequest) {
    return this.messages.sendImage(req.instance.id, dto);
  }

  @Post('send/audio')
  sendAudio(@Body() dto: SendAudioBody, @Req() req: ApiRequest) {
    return this.messages.sendAudio(req.instance.id, dto);
  }

  @Post('send/video')
  sendVideo(@Body() dto: SendVideoBody, @Req() req: ApiRequest) {
    return this.messages.sendVideo(req.instance.id, dto);
  }

  @Post('send/document')
  sendDocument(@Body() dto: SendDocumentBody, @Req() req: ApiRequest) {
    return this.messages.sendDocument(req.instance.id, dto);
  }

  @Post('send/contact')
  sendContact(@Body() dto: SendContactBody, @Req() req: ApiRequest) {
    return this.messages.sendContact(req.instance.id, dto);
  }

  @Post('send/location')
  sendLocation(@Body() dto: SendLocationBody, @Req() req: ApiRequest) {
    return this.messages.sendLocation(req.instance.id, dto);
  }

  @Post('send/buttons')
  sendButtons(@Body() dto: SendButtonsBody, @Req() req: ApiRequest) {
    return this.interactive.sendButtons(req.instance.id, dto);
  }

  @Post('send/catalog')
  sendCatalog(@Body() dto: SendCatalogBody, @Req() req: ApiRequest) {
    return this.interactive.sendCatalog(req.instance.id, dto);
  }

  @Post('send/product')
  sendProduct(@Body() dto: SendProductBody, @Req() req: ApiRequest) {
    return this.interactive.sendProduct(req.instance.id, dto);
  }

  @Get('catalog')
  catalog(@Query() query: CatalogQuery, @Req() req: ApiRequest) {
    return this.interactive.listCatalog(req.instance.id, query);
  }

  @Post('send/poll')
  sendPoll(@Body() dto: SendPollBody, @Req() req: ApiRequest) {
    return this.messages.sendPoll(req.instance.id, dto);
  }
}
