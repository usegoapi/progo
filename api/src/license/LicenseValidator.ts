/**
 * License Validator para NestJS/Node.js
 * 
 * Valida a licença com o servidor GO-API central.
 * Bloqueia a API se a licença for inválida.
 * 
 * USO no main.ts:
 * import { LicenseValidator } from './license/LicenseValidator';
 * 
 * async function bootstrap() {
 *   const license = new LicenseValidator(process.env.LICENSE_SERVER, process.env.LICENSE_KEY);
 *   await license.validateOrDie();
 *   // ... resto do bootstrap
 * }
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

interface LicenseResponse {
  success: boolean;
  status: string;
  reason?: string;
  expires_at?: string;
  check_interval?: number;
  requests_remaining?: number;
}

interface CacheData extends LicenseResponse {
  cached_at: number;
}

export class LicenseValidator {
  private serverUrl: string;
  private apiKey: string;
  private machineId: string;
  private hostname: string;
  private ip: string = '0.0.0.0';
  private cacheDir: string;
  private cacheTimeout: number = 300; // 5 minutos
  private offlineTolerance: number = 1800; // 30 minutos
  private error: string | null = null;

  constructor(serverUrl: string, apiKey: string, cacheDir: string = '/app/license') {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.cacheDir = cacheDir;
    this.machineId = this.getMachineId();
    this.hostname = os.hostname();

    // Criar diretório de cache
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Obter Machine ID único
   */
  private getMachineId(): string {
    // Primeiro: verificar variável de ambiente (para Docker)
    if (process.env.MACHINE_ID) {
      return process.env.MACHINE_ID;
    }

    // Tentar ler machine-id do Linux
    const machineIdPaths = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
    
    for (const filePath of machineIdPaths) {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8').trim();
      }
    }

    // Fallback: gerar baseado em hostname + cpus
    const cpus = os.cpus();
    const data = `${os.hostname()}-${os.platform()}-${cpus[0]?.model || 'unknown'}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Obter IP público
   */
  private async getPublicIp(): Promise<string> {
    const services = [
      'https://api.ipify.org',
      'https://icanhazip.com',
      'https://ifconfig.me/ip'
    ];

    for (const service of services) {
      try {
        const response = await fetch(service, { 
          signal: AbortSignal.timeout(5000) 
        });
        if (response.ok) {
          const ip = (await response.text()).trim();
          if (this.isValidIp(ip)) {
            return ip;
          }
        }
      } catch {
        continue;
      }
    }

    return '0.0.0.0';
  }

  private isValidIp(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipv4Regex.test(ip);
  }

  /**
   * Fazer requisição ao servidor de licenças
   */
  private async request(endpoint: string, data: object): Promise<LicenseResponse | null> {
    const url = `${this.serverUrl}${endpoint}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', this.apiKey)
      .update(`${this.apiKey}${timestamp}`)
      .digest('hex');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': timestamp.toString(),
          'X-Signature': signature,
          'User-Agent': 'LicenseValidator/1.0 Node.js'
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        this.error = `HTTP ${response.status}`;
        return null;
      }

      return await response.json();
    } catch (err) {
      this.error = `Erro de conexão: ${err instanceof Error ? err.message : 'unknown'}`;
      return null;
    }
  }

  /**
   * Salvar cache
   */
  private saveCache(data: LicenseResponse): void {
    const cacheData: CacheData = {
      ...data,
      cached_at: Math.floor(Date.now() / 1000)
    };
    const cachePath = path.join(this.cacheDir, 'license.cache');
    fs.writeFileSync(cachePath, JSON.stringify(cacheData), { mode: 0o600 });
  }

  /**
   * Carregar cache
   */
  private loadCache(): CacheData | null {
    const cachePath = path.join(this.cacheDir, 'license.cache');
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(cachePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Verificar se cache é válido
   */
  private isCacheValid(cached: CacheData): boolean {
    const now = Math.floor(Date.now() / 1000);
    return (now - cached.cached_at) < this.cacheTimeout;
  }

  /**
   * Verificar tolerância offline
   */
  private isWithinOfflineTolerance(cached: CacheData): boolean {
    const now = Math.floor(Date.now() / 1000);
    return (now - cached.cached_at) < this.offlineTolerance;
  }

  /**
   * Ativar licença (primeira execução)
   */
  async activate(): Promise<boolean> {
    this.ip = await this.getPublicIp();

    const response = await this.request('/api/license/activate', {
      api_key: this.apiKey,
      machine_id: this.machineId,
      ip: this.ip,
      hostname: this.hostname
    });

    if (!response) {
      return false;
    }

    if (response.success && response.status === 'active') {
      this.saveCache(response);
      console.log('✅ Licença ativada com sucesso');
      return true;
    }

    this.error = response.reason || 'Falha na ativação';
    return false;
  }

  /**
   * Validar licença
   */
  async validate(): Promise<boolean> {
    // Verificar cache primeiro
    const cached = this.loadCache();
    if (cached && this.isCacheValid(cached)) {
      console.log('✅ Licença válida (cache)');
      return true;
    }

    // Obter IP público
    this.ip = await this.getPublicIp();

    // Validar com servidor
    const response = await this.request('/api/license/validate', {
      api_key: this.apiKey,
      machine_id: this.machineId,
      ip: this.ip
    });

    if (response) {
      if (response.success && response.status === 'active') {
        this.saveCache(response);
        console.log('✅ Licença válida');
        return true;
      }

      this.error = response.reason || 'Licença inválida';
      return false;
    }

    // Servidor offline - verificar tolerância
    if (cached && this.isWithinOfflineTolerance(cached)) {
      console.log('⚠️ Modo offline - usando cache');
      return true;
    }

    this.error = 'Não foi possível validar a licença';
    return false;
  }

  /**
   * Validar ou encerrar aplicação
   */
  async validateOrDie(): Promise<void> {
    const isValid = await this.validate();

    if (!isValid) {
      console.error('❌ LICENÇA INVÁLIDA:', this.error);
      console.error('❌ Machine ID:', this.machineId);
      console.error('❌ Servidor:', this.serverUrl);
      process.exit(1);
    }
  }

  /**
   * Obter erro
   */
  getError(): string | null {
    return this.error;
  }

  /**
   * Obter Machine ID
   */
  getMachineIdValue(): string {
    return this.machineId;
  }

  /**
   * Configurar timeout do cache
   */
  setCacheTimeout(seconds: number): this {
    this.cacheTimeout = seconds;
    return this;
  }

  /**
   * Configurar tolerância offline
   */
  setOfflineTolerance(seconds: number): this {
    this.offlineTolerance = seconds;
    return this;
  }
}

/**
 * Middleware Express/NestJS para validação contínua
 */
export function createLicenseMiddleware(validator: LicenseValidator) {
  let lastCheck = 0;
  const checkInterval = 300000; // 5 minutos

  return async (req: any, res: any, next: any) => {
    const now = Date.now();

    // Verificar a cada 5 minutos
    if (now - lastCheck > checkInterval) {
      const isValid = await validator.validate();
      lastCheck = now;

      if (!isValid) {
        return res.status(403).json({
          error: 'Licença inválida',
          reason: validator.getError(),
          code: 'LICENSE_INVALID'
        });
      }
    }

    next();
  };
}
