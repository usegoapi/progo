import { Module } from '@nestjs/common';
import { InstancesModule } from '../instances/instances.module';
import { ApiController } from './api.controller';
import { MessagesController } from './messages.controller';
import { InteractiveMessagesService } from './interactive-messages.service';
import { MessagesService } from './messages.service';

@Module({
  imports: [InstancesModule],
  controllers: [MessagesController, ApiController],
  providers: [MessagesService, InteractiveMessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
