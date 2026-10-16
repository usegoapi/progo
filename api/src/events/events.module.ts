import { Global, Module } from '@nestjs/common';
import { QueuePublishers } from './queue-publishers.service';
import { WebhookDispatcher } from './webhook-dispatcher.service';
import { EventsGateway } from './websocket.gateway';

@Global()
@Module({
  providers: [WebhookDispatcher, EventsGateway, QueuePublishers],
  exports: [WebhookDispatcher],
})
export class EventsModule {}
