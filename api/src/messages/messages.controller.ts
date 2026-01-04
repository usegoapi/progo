import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';
import {
  SendTextDto, SendImageDto, SendAudioDto, SendVideoDto, SendDocumentDto,
  SendContactDto, SendLocationDto, SendPixDto, SendListDto, SendPollDto,
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

  @Post('video')
  sendVideo(@Body() dto: SendVideoDto) {
    return this.messagesService.sendVideo(dto);
  }

  @Post('document')
  sendDocument(@Body() dto: SendDocumentDto) {
    return this.messagesService.sendDocument(dto);
  }

  @Post('contact')
  sendContact(@Body() dto: SendContactDto) {
    return this.messagesService.sendContact(dto);
  }

  @Post('location')
  sendLocation(@Body() dto: SendLocationDto) {
    return this.messagesService.sendLocation(dto);
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
}
