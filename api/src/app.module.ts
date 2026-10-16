import { ExecutionContext, Injectable, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { env } from './config/env';
import { EventsModule } from './events/events.module';
import { HealthController } from './health/health.controller';
import { InstancesModule } from './instances/instances.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MessagesModule } from './messages/messages.module';
import { SharedModule } from './shared/shared.module';
import { WebhooksModule } from './webhooks/webhooks.module';

/** Rate limit apenas para HTTP (gateways WebSocket têm autenticação própria). */
@Injectable()
class HttpThrottlerGuard extends ThrottlerGuard {
  canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') return Promise.resolve(true);
    return super.canActivate(context);
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: env.throttleTtlMs, limit: env.throttleLimit }]),
    SharedModule,
    AuthModule,
    EventsModule,
    InstancesModule,
    MessagesModule,
    WebhooksModule,
    IntegrationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
