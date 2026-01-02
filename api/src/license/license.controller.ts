import { Controller, Get, Inject } from '@nestjs/common';
import { LicenseService } from './license.module';

@Controller('license')
export class LicenseController {
  constructor(
    @Inject(LicenseService) private licenseService: LicenseService,
  ) {}

  @Get('status')
  async getStatus() {
    const status = this.licenseService.getStatus();
    
    return {
      valid: status.valid,
      blocked: status.blocked,
      reason: status.reason,
      machineId: status.machineId,
      ip: status.ip,
      timestamp: new Date().toISOString()
    };
  }

  @Get('check')
  async check() {
    // Força uma verificação com o servidor
    const isValid = await this.licenseService.validate();
    const status = this.licenseService.getStatus();

    if (!isValid || status.blocked) {
      return {
        error: 'LICENSE_BLOCKED',
        message: 'Licença bloqueada ou inválida',
        blocked: true,
        reason: status.reason,
        status
      };
    }

    return {
      success: true,
      message: 'Licença válida',
      blocked: false,
      status
    };
  }
}
