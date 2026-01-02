/**
 * License Module para NestJS
 * 
 * Sistema de proteção de licença com verificação em tempo real
 */

import { Module, DynamicModule, Global, OnModuleInit, Injectable, NestMiddleware, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LicenseValidator, LicenseStatus } from './LicenseValidator';
import { LicenseController } from './license.controller';

export interface LicenseModuleOptions {
  serverUrl: string;
  apiKey: string;
  cacheDir?: string;
  validateOnStart?: boolean;
  checkInterval?: number; // em segundos
}

@Injectable()
export class LicenseService implements OnModuleInit {
  private validator: LicenseValidator;
  private checkInterval: number;

  constructor(private options: LicenseModuleOptions) {
    this.validator = new LicenseValidator(
      options.serverUrl,
      options.apiKey,
      options.cacheDir || '/app/license'
    );
    this.checkInterval = options.checkInterval || 30;
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

  async activate(): Promise<boolean> {
    return this.validator.activate();
  }

  isBlocked(): boolean {
    return this.validator.isLicenseBlocked();
  }

  getBlockReason(): string | null {
    return this.validator.getBlockReason();
  }

  getError(): string | null {
    return this.validator.getError();
  }

  getMachineId(): string {
    return this.validator.getMachineIdValue();
  }

  getIp(): string {
    return this.validator.getIp();
  }

  getStatus(): LicenseStatus {
    return this.validator.getStatus();
  }

  getValidator(): LicenseValidator {
    return this.validator;
  }

  onModuleDestroy() {
    this.validator.stopRealtimeCheck();
  }
}

@Injectable()
export class LicenseMiddleware implements NestMiddleware {
  constructor(private licenseService: LicenseService) {}

  async use(req: any, res: any, next: () => void) {
    // Verificar se está bloqueado
    if (this.licenseService.isBlocked()) {
      return res.status(403).json({
        error: 'LICENSE_BLOCKED',
        message: 'Licença bloqueada',
        reason: this.licenseService.getBlockReason(),
        blocked: true,
        status: this.licenseService.getStatus()
      });
    }

    next();
  }
}

@Global()
@Module({})
export class LicenseModule implements NestModule {
  static forRoot(options: LicenseModuleOptions): DynamicModule {
    return {
      module: LicenseModule,
      controllers: [LicenseController],
      providers: [
        {
          provide: 'LICENSE_OPTIONS',
          useValue: options,
        },
        {
          provide: LicenseService,
          useFactory: (opts: LicenseModuleOptions) => new LicenseService(opts),
          inject: ['LICENSE_OPTIONS'],
        },
        LicenseMiddleware,
      ],
      exports: [LicenseService, LicenseMiddleware],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    // Aplicar middleware em todas as rotas exceto health check e license status
    consumer
      .apply(LicenseMiddleware)
      .exclude('health', 'health/(.*)', 'license/status', 'license/check')
      .forRoutes('*');
  }
}
