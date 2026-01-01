import { Module, forwardRef } from '@nestjs/common';
import { InstancesController, AuthSharedTokenController } from './instances.controller';
import { InstancesService } from './instances.service';
import { BaileysService } from './baileys.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [forwardRef(() => IntegrationsModule)],
  controllers: [InstancesController, AuthSharedTokenController],
  providers: [InstancesService, BaileysService],
  exports: [BaileysService, InstancesService],
})
export class InstancesModule {}
