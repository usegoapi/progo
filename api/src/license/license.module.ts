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
  OnModuleDestroy,
  Injectable,
  NestMiddleware,
  MiddlewareConsumer,
  NestModule,
  Controller,
  Get,
  Inject,
} from '@nestjs/common';
import { LicenseValidator, LicenseStatus } from './LicenseValidator';

export interface LicenseModuleOptions {
  serverUrl: string;
  apiKey: string;
  cacheDir?: string;
  validateOnStart?: boolean;
  checkInterval?: number;
}

// Token para injeção das opções
const LICENSE_OPTIONS = 'LICENSE_OPTIONS';

@Injectable()
export class LicenseService implements OnModuleInit, OnModuleDestroy {
  private validator: LicenseValidator;

  constructor(@Inject(LICENSE_OPTIONS) private options: LicenseModuleOptions) {
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

  // Força verificação com servidor (ignora cache)
  async forceValidate(): Promise<boolean> {
    return this.validator.validate(true);
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

  async use(_req: any, res: any, next: () => void) {
    // SEMPRE força verificação com servidor
    const isValid = await this.licenseService.forceValidate();

    if (!isValid || this.licenseService.isBlocked()) {
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

// Controller para verificar status da licença
@Controller('license')
export class LicenseController {
  constructor(private licenseService: LicenseService) {}

  @Get('check')
  async check() {
    // SEMPRE força verificação com servidor
    const isValid = await this.licenseService.forceValidate();

    if (!isValid || this.licenseService.isBlocked()) {
      return {
        error: 'LICENSE_BLOCKED',
        message: 'Licença bloqueada',
        reason: this.licenseService.getBlockReason(),
        blocked: true,
        status: this.licenseService.getStatus(),
      };
    }

    return {
      success: true,
      blocked: false,
      status: this.licenseService.getStatus(),
    };
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
          provide: LICENSE_OPTIONS,
          useValue: options,
        },
        LicenseService,
        LicenseMiddleware,
      ],
      exports: [LicenseService],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LicenseMiddleware)
      .exclude('health', 'health/(.*)', 'license/check')
      .forRoutes('*');
  }
}
