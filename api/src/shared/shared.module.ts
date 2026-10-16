import { Global, Module } from '@nestjs/common';
import { EventBus } from './event-bus.service';
import { InstanceSettingsService } from './instance-settings.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, EventBus, InstanceSettingsService],
  exports: [PrismaService, EventBus, InstanceSettingsService],
})
export class SharedModule {}
