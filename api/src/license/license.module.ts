/**
 * License Module para NestJS
 * 
 * Sistema de proteção de licença com verificação em tempo real
 */

import {
  Module,
  DynamicModule,
  Global,
  OnModuleInit,
  Injectable,
  NestMiddleware,
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common';
import { LicenseValidator, LicenseStatus } from './LicenseValidator';

export interface LicenseModuleOptions {
  serverUrl: string;
  apiKey: string;
  cacheDir?: string;
  validateOnStart?: boolean;
  checkInterval?: number;
}

@Injectable()
export class LicenseService implements OnModuleInit {
  private validator: LicenseValidator;

  constructor(private options: LicenseModuleOptions) {
    this.validator = new LicenseValidator(
      options.serverUrl,
      options.apiKey,
      options.cacheDir || '/app/license',
    );
  }

  async onModuleInit() {
    if (this.options.validateOnStart !== false) {
      console.log('🔐 Validando licença...');
      await this.validator.validateOrDie();
    }
  }

  async validate(): Promise<boolean> {
    return this.validator.validate();
  }

  isBlocked(): boolean {
    return this.validator.isLicenseBlocked();
  }

  getBlockReason(): string | null {
    return this.validator.getBlockReason();
  }

  getStatus(): LicenseStatus {
    return this.validator.getStatus();
  }

  onModuleDestroy() {
    this.validator.stopRealtimeCheck();
  }
}

@Injectable()
export class LicenseMiddleware implements NestMiddleware {
  constructor(private licenseService: LicenseService) {}

  async use(req: any, res: any, next: () => void) {
    if (this.licenseService.isBlocked()) {
      return res.status(403).json({
        error: 'LICENSE_BLOCKED',
        message: 'Licença bloqueada',
        reason: this.licenseService.getBlockReason(),
        blocked: true,
        status: this.licenseService.getStatus(),
      });
    }
    next();
  }
}

const licenseServiceFactory = {
  provide: LicenseService,
  useFactory: (opts: LicenseModuleOptions) => new LicenseService(opts),
  inject: ['LICENSE_OPTIONS'],
};

@Global()
@Module({})
export class LicenseModule implements NestModule {
  static forRoot(options: LicenseModuleOptions): DynamicModule {
    return {
      module: LicenseModule,
      providers: [
        {
          provide: 'LICENSE_OPTIONS',
          useValue: options,
        },
        licenseServiceFactory,
        {
          provide: LicenseMiddleware,
          useFactory: (licenseService: LicenseService) => new LicenseMiddleware(licenseService),
          inject: [LicenseService],
        },
      ],
      exports: [LicenseService],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LicenseMiddleware).exclude('health', 'health/(.*)').forRoutes('*');
  }
}
