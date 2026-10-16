import { BadRequestException } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import * as dns from 'dns/promises';
import * as net from 'net';
import { env } from '../../config/env';

const PRIVATE_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const value = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

/**
 * Valida uma URL de saída (webhooks, mídia, integrações).
 * Sempre exige http/https; com BLOCK_PRIVATE_NETWORK=true também bloqueia destinos internos (SSRF).
 */
export async function assertSafeUrl(raw: string, label = 'URL'): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException(`${label} inválida`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BadRequestException(`${label} deve usar http:// ou https://`);
  }
  if (!env.blockPrivateNetwork) return url;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new BadRequestException(`${label}: host não encontrado`);
  if (addresses.some(isPrivateIp)) throw new BadRequestException(`${label} aponta para uma rede interna (bloqueado)`);
  return url;
}

/** Cliente HTTP para chamadas de saída com limites sensatos. */
export const outbound = axios.create({
  timeout: 15_000,
  maxRedirects: 3,
  maxContentLength: 5 * 1024 * 1024,
  headers: { 'User-Agent': `${env.waBrowserName}/2.0` },
});

/** Baixa um arquivo respeitando tamanho máximo, timeout e validação de destino. */
export async function downloadBuffer(
  rawUrl: string,
  options: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<{ buffer: Buffer; contentType?: string }> {
  const dataUri = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(rawUrl);
  if (dataUri) {
    const buffer = dataUri[2] ? Buffer.from(dataUri[3], 'base64') : Buffer.from(decodeURIComponent(dataUri[3]));
    if (buffer.length > (options.maxBytes ?? env.mediaMaxBytes)) throw new BadRequestException('Arquivo excede o tamanho máximo');
    return { buffer, contentType: dataUri[1] };
  }

  await assertSafeUrl(rawUrl, 'URL da mídia');
  const config: AxiosRequestConfig = {
    responseType: 'arraybuffer',
    timeout: options.timeoutMs ?? 60_000,
    maxContentLength: options.maxBytes ?? env.mediaMaxBytes,
    maxBodyLength: options.maxBytes ?? env.mediaMaxBytes,
    maxRedirects: 3,
  };
  const response = await outbound.get<ArrayBuffer>(rawUrl, config);
  return { buffer: Buffer.from(response.data), contentType: response.headers['content-type'] as string | undefined };
}
