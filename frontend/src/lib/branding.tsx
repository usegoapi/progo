import { createContext, useContext } from 'react';

export interface Branding {
  name: string;
  logoUrl: string;
  iconUrl: string;
  primaryColor: string;
  tagline: string;
  supportUrl: string;
  copyright: string;
}

export interface PublicConfig {
  apiUrl: string;
  brand: Branding;
}

const DEFAULT_BRAND: Branding = {
  name: 'GO-API',
  logoUrl: '/img/logosite.png',
  iconUrl: '/img/icone.png',
  primaryColor: '#eaa800',
  tagline: 'Gerencie suas instâncias de WhatsApp API, acompanhe mensagens e integre com suas ferramentas favoritas.',
  supportUrl: '',
  copyright: '',
};

const HEX = /^#?([0-9a-f]{6})$/i;

/**
 * Lê a configuração pública a partir das variáveis de ambiente (somente no servidor).
 * Nada sensível passa por aqui: apenas marca e a URL pública da API.
 */
export function readPublicConfig(): PublicConfig {
  const env = process.env;
  const name = env.BRAND_NAME?.trim() || DEFAULT_BRAND.name;
  const color = env.BRAND_PRIMARY_COLOR?.trim() || DEFAULT_BRAND.primaryColor;
  return {
    apiUrl: (env.API_URL || env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, ''),
    brand: {
      name,
      logoUrl: env.BRAND_LOGO_URL?.trim() || DEFAULT_BRAND.logoUrl,
      iconUrl: env.BRAND_ICON_URL?.trim() || DEFAULT_BRAND.iconUrl,
      primaryColor: HEX.test(color) ? `#${HEX.exec(color)![1]}` : DEFAULT_BRAND.primaryColor,
      tagline: env.BRAND_TAGLINE?.trim() || DEFAULT_BRAND.tagline,
      supportUrl: /^https?:\/\/|^mailto:/.test(env.BRAND_SUPPORT_URL ?? '') ? env.BRAND_SUPPORT_URL!.trim() : '',
      copyright: env.BRAND_COPYRIGHT?.trim() || '',
    },
  };
}

export const defaultPublicConfig: PublicConfig = { apiUrl: '', brand: DEFAULT_BRAND };

const BrandContext = createContext<PublicConfig>(defaultPublicConfig);
export const BrandProvider = BrandContext.Provider;
export const usePublicConfig = () => useContext(BrandContext);
export const useBrand = () => useContext(BrandContext).brand;

// ───────────── Cores ─────────────

function hexToRgb(hex: string): [number, number, number] {
  const value = HEX.exec(hex)?.[1] ?? 'eaa800';
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

const shade = ([r, g, b]: [number, number, number], factor: number): [number, number, number] =>
  [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c * factor)))) as [number, number, number];

/** Luminância relativa (WCAG) para escolher texto preto ou branco sobre a cor primária. */
function luminance([r, g, b]: [number, number, number]) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** CSS com as variáveis de tema derivadas da cor da marca. */
export function brandCssVariables(primaryColor: string) {
  const rgb = hexToRgb(primaryColor);
  const hover = shade(rgb, 0.92);
  const onPrimary = luminance(rgb) > 0.45 ? [0, 0, 0] : [255, 255, 255];
  return `:root{--primary-rgb:${rgb.join(' ')};--primary-hover-rgb:${hover.join(' ')};--on-primary-rgb:${onPrimary.join(' ')};--primary:${primaryColor};}`;
}

/** Cor primária atual (para bibliotecas que exigem valor literal, ex: SweetAlert). */
export function brandColor(): string {
  if (typeof window === 'undefined') return DEFAULT_BRAND.primaryColor;
  return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || DEFAULT_BRAND.primaryColor;
}

// ───────────── Componentes ─────────────

export function BrandLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  const brand = useBrand();
  return <img src={brand.logoUrl} alt={brand.name} className={className} />;
}

export function Copyright() {
  const brand = useBrand();
  const text = brand.copyright || `© ${new Date().getFullYear()} ${brand.name}. Todos os direitos reservados.`;
  return <p className="text-sm text-slate-600">{text}</p>;
}
