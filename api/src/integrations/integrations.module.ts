import { Module } from '@nestjs/common';
import { InstancesModule } from '../instances/instances.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatwootController } from './chatwoot.controller';
import { ChatwootService } from './chatwoot.service';
import { IntegrationConfigService } from './integration-config.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { N8nService } from './n8n.service';
import { TypebotService } from './typebot.service';

@Module({
  imports: [InstancesModule, MessagesModule],
  controllers: [IntegrationsController, ChatwootController],
  providers: [IntegrationsService, IntegrationConfigService, TypebotService, N8nService, ChatwootService],
})
export class IntegrationsModule {}
