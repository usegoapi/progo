import { Module } from '@nestjs/common';
import { InstancesController } from './instances.controller';
import { InstancesService } from './instances.service';
import { BaileysService } from './baileys.service';

@Module({
  controllers: [InstancesController],
  providers: [InstancesService, BaileysService],
  exports: [BaileysService, InstancesService],
})
export class InstancesModule {}
