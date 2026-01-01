import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { InstancesModule } from './instances/instances.module';
import { MessagesModule } from './messages/messages.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    SharedModule,
    AuthModule,
    InstancesModule,
    MessagesModule,
    WebhooksModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
