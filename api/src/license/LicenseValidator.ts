/**
 * License Validator para NestJS/Node.js
 * 
 * Sistema de proteção de licença com:
 * - Verificação em tempo real (sem cache quando bloqueado)
 * - Detecção de fraude
 * - Bloqueio imediato
 * - Logs seguros (sem dados sensíveis)
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
  blocked?: boolean;
  fraud_detected?: boolean;
}

interface CacheData extends LicenseResponse {
  cached_at: number;
}

export interface LicenseStatus {
  valid: boolean;
  blocked: boolean;
  reason: string | null;
  machineId: string;
  ip: string;
  expiresAt: string | null;
}

export class LicenseValidator {
  private serverUrl: string;
  private apiKey: string;
  private machineId: string;
  private hostname: string;
  private ip: string = '0.0.0.0';
  private cacheDir: string;
  private cacheTimeout: number = 15; // 15 segundos - cache curto para segurança
  private offlineTolerance: number = 60; // 1 minuto máximo offline (reduzido)
  private error: string | null = null;
  private isBlocked: boolean = false;
  private blockReason: string | null = null;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private onBlockCallback: ((reason: string) => void) | null = null;
  private lastServerCheck: number = 0;

  constructor(serverUrl: string, apiKey: string, cacheDir: string = '/app/license') {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.cacheDir = cacheDir;
    this.machineId = this.getMachineId();
    this.hostname = os.hostname();

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getMachineId(): string {
    if (process.env.MACHINE_ID) {
      return process.env.MACHINE_ID;
    }

    const machineIdPaths = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
    
    for (const filePath of machineIdPaths) {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8').trim();
      }
    }

    const cpus = os.cpus();
    const data = `${os.hostname()}-${os.platform()}-${cpus[0]?.model || 'unknown'}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

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

  private async request(endpoint: string, data: object): Promise<LicenseResponse | null> {
    const url = `${this.serverUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-API-Key': this.apiKey,
          'User-Agent': 'LicenseValidator/2.0'
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(10000)
      });

      const responseText = await response.text();

      if (!response.ok) {
        this.error = `Erro na validação`;
        return null;
      }

      try {
        return JSON.parse(responseText);
      } catch {
        this.error = `Resposta inválida do servidor`;
        return null;
      }
    } catch (err) {
      this.error = `Erro de conexão com servidor de licenças`;
      return null;
    }
  }

  private saveCache(data: LicenseResponse): void {
    // NÃO salvar cache se estiver bloqueado
    if (this.isBlocked || data.blocked || data.status === 'blocked') {
      this.clearCache();
      return;
    }

    const cacheData: CacheData = {
      ...data,
      cached_at: Math.floor(Date.now() / 1000)
    };
    const cachePath = path.join(this.cacheDir, 'license.cache');
    fs.writeFileSync(cachePath, JSON.stringify(cacheData), { mode: 0o600 });
  }

  private loadCache(): CacheData | null {
    // NUNCA usar cache se estiver bloqueado
    if (this.isBlocked) {
      return null;
    }

    const cachePath = path.join(this.cacheDir, 'license.cache');
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(cachePath, 'utf8');
      const cached = JSON.parse(content) as CacheData;
      
      // Verificar se o cache indica bloqueio
      if (cached.blocked || cached.status === 'blocked') {
        this.clearCache();
        return null;
      }
      
      return cached;
    } catch {
      return null;
    }
  }

  private clearCache(): void {
    const cachePath = path.join(this.cacheDir, 'license.cache');
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  }

  private isCacheValid(cached: CacheData): boolean {
    // Cache NUNCA é válido se bloqueado
    if (this.isBlocked || cached.blocked || cached.status === 'blocked') {
      return false;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return (now - cached.cached_at) < this.cacheTimeout;
  }

  private isWithinOfflineTolerance(cached: CacheData): boolean {
    // Tolerância offline NUNCA se aplica se bloqueado
    if (this.isBlocked || cached.blocked || cached.status === 'blocked') {
      return false;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return (now - cached.cached_at) < this.offlineTolerance;
  }

  onBlock(callback: (reason: string) => void): this {
    this.onBlockCallback = callback;
    return this;
  }

  private block(reason: string): void {
    this.isBlocked = true;
    this.blockReason = reason;
    this.clearCache(); // Limpar cache imediatamente
    console.error(`🚫 Licença bloqueada`);
    
    if (this.onBlockCallback) {
      this.onBlockCallback(reason);
    }
  }

  isLicenseBlocked(): boolean {
    return this.isBlocked;
  }

  getBlockReason(): string | null {
    return this.blockReason;
  }

  getStatus(): LicenseStatus {
    return {
      valid: !this.isBlocked,
      blocked: this.isBlocked,
      reason: this.blockReason || this.error,
      machineId: this.machineId.substring(0, 8) + '...', // Mascarar
      ip: this.ip.split('.').slice(0, 2).join('.') + '.*.*', // Mascarar IP
      expiresAt: null
    };
  }

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

    if (response.fraud_detected) {
      this.block('Fraude detectada');
      return false;
    }

    if (response.blocked || response.status === 'blocked') {
      this.block(response.reason || 'Licença bloqueada');
      return false;
    }

    if (response.success && response.status === 'active') {
      this.saveCache(response);
      console.log('✅ Licença ativada');
      return true;
    }

    this.error = response.reason || 'Falha na ativação';
    return false;
  }

  /**
   * Validar licença - SEMPRE verifica com servidor se bloqueado
   */
  async validate(forceCheck: boolean = false): Promise<boolean> {
    // Se já está bloqueado, SEMPRE verificar com servidor (sem cache)
    if (this.isBlocked) {
      // Tentar desbloquear verificando com servidor
      const response = await this.request('/api/license/validate', {
        api_key: this.apiKey,
        machine_id: this.machineId,
        ip: this.ip || await this.getPublicIp()
      });

      if (response && response.success && response.status === 'active' && !response.blocked) {
        // Licença foi desbloqueada no servidor
        this.isBlocked = false;
        this.blockReason = null;
        this.saveCache(response);
        console.log('✅ Licença reativada');
        return true;
      }
      
      return false; // Continua bloqueado
    }

    // Verificar cache apenas se não for forçado e não estiver bloqueado
    if (!forceCheck) {
      const cached = this.loadCache();
      if (cached && this.isCacheValid(cached)) {
        // Verificar se cache indica bloqueio
        if (cached.blocked || cached.status === 'blocked') {
          this.block(cached.reason || 'Licença bloqueada');
          return false;
        }
        return true;
      }
    }

    this.ip = await this.getPublicIp();
    this.lastServerCheck = Date.now();

    const response = await this.request('/api/license/validate', {
      api_key: this.apiKey,
      machine_id: this.machineId,
      ip: this.ip
    });

    if (response) {
      // Verificar fraude
      if (response.fraud_detected) {
        this.block('Fraude detectada');
        return false;
      }

      // Verificar bloqueio - PRIORIDADE MÁXIMA
      if (response.blocked || response.status === 'blocked') {
        this.block(response.reason || 'Licença bloqueada');
        return false;
      }

      // Verificar se expirou
      if (response.status === 'expired') {
        this.block('Licença expirada');
        return false;
      }

      // Verificar se está pendente
      if (response.status === 'pending') {
        return await this.activate();
      }

      if (response.success && response.status === 'active') {
        this.saveCache(response);
        return true;
      }

      this.error = response.reason || 'Licença inválida';
      return false;
    }

    // Servidor offline - tolerância MUITO reduzida
    const cached = this.loadCache();
    if (cached && this.isWithinOfflineTolerance(cached)) {
      // Verificar novamente se cache indica bloqueio
      if (cached.blocked || cached.status === 'blocked') {
        this.block('Licença bloqueada');
        return false;
      }
      return true;
    }

    // Sem conexão e sem cache válido = bloqueado por segurança
    this.error = 'Não foi possível validar a licença';
    return false;
  }

  /**
   * Verificação periódica em tempo real - intervalo curto
   */
  startRealtimeCheck(intervalSeconds: number = 15): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    console.log('🔄 Verificação de licença em tempo real iniciada');

    this.checkIntervalId = setInterval(async () => {
      const isValid = await this.validate(true); // SEMPRE força verificação
      
      if (!isValid && !this.isBlocked) {
        this.block(this.error || 'Licença inválida');
      }
    }, intervalSeconds * 1000);
  }

  stopRealtimeCheck(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  async validateOrDie(): Promise<void> {
    console.log('🔐 Validando licença...');
    
    // Verificar se as variáveis de ambiente estão configuradas
    if (!this.apiKey || this.apiKey === '') {
      console.warn('⚠️ LICENSE_KEY não configurada - sistema funcionando sem validação de licença');
      return;
    }
    
    if (!this.serverUrl || this.serverUrl === '') {
      console.warn('⚠️ LICENSE_SERVER não configurado - sistema funcionando sem validação de licença');
      return;
    }
    
    const isValid = await this.validate();

    if (!isValid) {
      console.error('❌ Licença inválida ou bloqueada');
      // NÃO mata o processo - apenas marca como bloqueado
      // O middleware vai bloquear as requisições
      this.block(this.error || 'Licença inválida');
      return;
    }

    console.log('✅ Licença válida');
    
    // Iniciar verificação em tempo real - a cada 15 segundos
    this.startRealtimeCheck(15);
  }

  getError(): string | null {
    return this.error;
  }

  getMachineIdValue(): string {
    return this.machineId;
  }

  getIp(): string {
    return this.ip;
  }

  setCacheTimeout(seconds: number): this {
    this.cacheTimeout = Math.min(seconds, 30); // Máximo 30 segundos
    return this;
  }

  setOfflineTolerance(seconds: number): this {
    this.offlineTolerance = Math.min(seconds, 120); // Máximo 2 minutos
    return this;
  }
}

/**
 * Guard para verificação em todas as requisições
 */
export function createLicenseGuard(validator: LicenseValidator) {
  return async (req: any, res: any, next: any) => {
    if (validator.isLicenseBlocked()) {
      return res.status(403).json({
        error: 'LICENSE_BLOCKED',
        message: 'Licença bloqueada',
        reason: validator.getBlockReason(),
        blocked: true,
        status: validator.getStatus()
      });
    }

    const isValid = await validator.validate();

    if (!isValid) {
      return res.status(403).json({
        error: 'LICENSE_INVALID',
        message: 'Licença inválida',
        reason: validator.getError(),
        blocked: validator.isLicenseBlocked(),
        status: validator.getStatus()
      });
    }

    next();
  };
}
