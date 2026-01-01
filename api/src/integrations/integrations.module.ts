import { Module, forwardRef } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { TypebotService } from './typebot.service';
import { N8nService } from './n8n.service';
import { ChatwootService } from './chatwoot.service';
import { InstancesModule } from '../instances/instances.module';

@Module({
  imports: [forwardRef(() => InstancesModule)],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, TypebotService, N8nService, ChatwootService],
  exports: [IntegrationsService, TypebotService, N8nService, ChatwootService],
})
export class IntegrationsModule {}
