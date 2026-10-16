export const isGroupJid = (jid?: string | null) => !!jid && jid.endsWith('@g.us');
export const isLidJid = (jid?: string | null) => !!jid && jid.endsWith('@lid');
export const isPnJid = (jid?: string | null) => !!jid && jid.endsWith('@s.whatsapp.net');
export const isBroadcastJid = (jid?: string | null) =>
  !!jid && (jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter'));

/** Apenas os dígitos de um JID de telefone (sem device/sufixo). */
export const jidToPhone = (jid?: string | null): string => (jid ? jid.split('@')[0].split(':')[0] : '');

/**
 * Normaliza o destino informado na API.
 * Aceita: "5511999999999", "+55 (11) 99999-9999", "...@s.whatsapp.net", "...@g.us", "...@lid".
 */
export function normalizeDestination(input: string): string {
  const value = input.trim();
  if (value.includes('@')) return value;
  return `${value.replace(/\D/g, '')}@s.whatsapp.net`;
}
