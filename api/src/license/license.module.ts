/**
 * License Module para NestJS
 * 
 * Módulo que integra validação de licença no NestJS.
 * 
 * USO no app.module.ts:
 * import { LicenseModule } from './license/license.module';
 * 
 * @Module({
 *   imports: [
 *     LicenseModule.forRoot({
 *       serverUrl: process.env.LICENSE_SERVER,
 *       apiKey: process.env.LICENSE_KEY,
 *     }),
 *     // ... outros módulos
 *   ],
 * })
 * export class AppModule {}
 */

import { Module, DynamicModule, Global, OnModuleInit, Injectable } from '@nestjs/common';
import { LicenseValidator } from './LicenseValidator';

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
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private options: LicenseModuleOptions) {
    this.validator = new LicenseValidator(
      options.serverUrl,
      options.apiKey,
      options.cacheDir || '/app/license'
    );
    this.checkInterval = (options.checkInterval || 300) * 1000; // default 5 min
  }

  async onModuleInit() {
    if (this.options.validateOnStart !== false) {
      console.log('🔐 Validando licença...');
      await this.validator.validateOrDie();
      
      // Iniciar verificação periódica
      this.startPeriodicCheck();
    }
  }

  private startPeriodicCheck() {
    this.intervalId = setInterval(async () => {
      const isValid = await this.validator.validate();
      if (!isValid) {
        console.error('❌ Licença inválida durante verificação periódica');
        console.error('❌ Erro:', this.validator.getError());
        process.exit(1);
      }
    }, this.checkInterval);
  }

  async validate(): Promise<boolean> {
    return this.validator.validate();
  }

  async activate(): Promise<boolean> {
    return this.validator.activate();
  }

  getError(): string | null {
    return this.validator.getError();
  }

  getMachineId(): string {
    return this.validator.getMachineIdValue();
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

@Global()
@Module({})
export class LicenseModule {
  static forRoot(options: LicenseModuleOptions): DynamicModule {
    return {
      module: LicenseModule,
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
      ],
      exports: [LicenseService],
    };
  }
}
