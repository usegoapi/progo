import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { MessagesService } from './messages.service';
import {
  SendTextDto, SendImageDto, SendAudioDto, SendVideoDto, SendDocumentDto,
  SendContactDto, SendLocationDto, SendListDto, SendPollDto,
} from './dto/message.dto';

@Controller('api')
@UseGuards(ApiKeyGuard)
export class ApiController {
  constructor(private messagesService: MessagesService) {}

  private withInstanceId(dto: any, req: any) {
    return { ...dto, instanceId: req.instanceId };
  }

  @Post('send/text')
  sendText(@Body() dto: Omit<SendTextDto, 'instanceId'> & { instanceId?: string }, @Req() req: any) {
    return this.messagesService.sendText(this.withInstanceId(dto, req));
  }

  @Post('send/image')
  sendImage(@Body() dto: Omit<SendImageDto, 'instanceId'> & { instanceId?: string }, @Req() req: any) {
    return this.messagesService.sendImage(this.withInstanceId(dto, req));
  }

  @Post('send/audio')
  sendAudio(@Body() dto: Omit<SendAudioDto, 'instanceId'> & { instanceId?: string }, @Req() req: any) {
    return this.messagesService.sendAudio(this.withInstanceId(dto, req));
  }

  @Post('send/video')
  sendVideo(@Body() dto: Omit<SendVideoDto, 'instanceId'> & { instanceId?: string }, @Req() req: any) {
    return this.messagesService.sendVideo(this.withInstanceId(dto, req));
  }

  @Post('send/document')
  sendDocument(@Body() dto: Omit<SendDocumentDto, 'instanceId'> & { instanceId?: string }, @Req() req: any) {
    return this.messagesService.sendDocument(this.withInstanceId(dto, req));
  }

  @Post('send/contact')
  sendContact(@Body() dto: Omit<SendContactDto, 'instanceId'> & { instanceId?: string }, @Req() req: any) {
    return this.messagesService.sendContact(this.withInstanceId(dto, req));
  }

  @Post('send/location')
  sendLocation(@Body() dto: Omit<SendLocationDto, 'instanceId'> & { instanceId?: string }, @Req() req: any) {
    return this.messagesService.sendLocation(this.withInstanceId(dto, req));
  }

  @Post('send/list')
  sendList(@Body() dto: Omit<SendListDto, 'instanceId'> & { instanceId?: string }, @Req() req: any) {
    return this.messagesService.sendList(this.withInstanceId(dto, req));
  }

  @Post('send/poll')
  sendPoll(@Body() dto: Omit<SendPollDto, 'instanceId'> & { instanceId?: string }, @Req() req: any) {
    return this.messagesService.sendPoll(this.withInstanceId(dto, req));
  }
}
