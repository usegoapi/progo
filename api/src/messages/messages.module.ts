import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { InstancesModule } from '../instances/instances.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [InstancesModule, AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
