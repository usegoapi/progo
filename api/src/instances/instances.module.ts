import { Module } from '@nestjs/common';
import { BaileysService } from './baileys.service';
import { ContactsController } from './contacts.controller';
import { InstancesController, SharedTokenController } from './instances.controller';
import { InstancesService } from './instances.service';
import { MessageSenderService } from './message-sender.service';

@Module({
  controllers: [InstancesController, SharedTokenController, ContactsController],
  providers: [InstancesService, BaileysService, MessageSenderService],
  exports: [BaileysService, InstancesService, MessageSenderService],
})
export class InstancesModule {}
