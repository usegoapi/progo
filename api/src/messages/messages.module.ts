import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { ApiController } from './api.controller';
import { MessagesService } from './messages.service';
import { InstancesModule } from '../instances/instances.module';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyGuard } from '../auth/api-key.guard';

@Module({
  imports: [InstancesModule, AuthModule],
  controllers: [MessagesController, ApiController],
  providers: [MessagesService, ApiKeyGuard],
})
export class MessagesModule {}
