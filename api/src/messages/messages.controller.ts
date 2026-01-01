import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';
import {
  SendTextDto, SendImageDto, SendAudioDto, SendLocationDto,
  SendButtonsDto, SendCarouselDto, SendPixDto, SendListDto,
  SendPollDto, SendInteractiveButtonsDto,
} from './dto/message.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post('text')
  sendText(@Body() dto: SendTextDto) {
    return this.messagesService.sendText(dto);
  }

  @Post('image')
  sendImage(@Body() dto: SendImageDto) {
    return this.messagesService.sendImage(dto);
  }

  @Post('audio')
  sendAudio(@Body() dto: SendAudioDto) {
    return this.messagesService.sendAudio(dto);
  }

  @Post('location')
  sendLocation(@Body() dto: SendLocationDto) {
    return this.messagesService.sendLocation(dto);
  }

  @Post('buttons')
  sendButtons(@Body() dto: SendButtonsDto) {
    return this.messagesService.sendButtons(dto);
  }

  @Post('carousel')
  sendCarousel(@Body() dto: SendCarouselDto) {
    return this.messagesService.sendCarousel(dto);
  }

  @Post('pix')
  sendPix(@Body() dto: SendPixDto) {
    return this.messagesService.sendPix(dto);
  }

  @Post('list')
  sendList(@Body() dto: SendListDto) {
    return this.messagesService.sendList(dto);
  }

  @Post('poll')
  sendPoll(@Body() dto: SendPollDto) {
    return this.messagesService.sendPoll(dto);
  }

  @Post('interactive')
  sendInteractiveButtons(@Body() dto: SendInteractiveButtonsDto) {
    return this.messagesService.sendInteractiveButtons(dto);
  }
}
