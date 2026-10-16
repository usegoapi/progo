/** Mascara números/JIDs para logs: 5511987654321@s.whatsapp.net -> 5511*****4321 */
export function maskJid(jid?: string | null): string {
  if (!jid) return '-';
  const [user, server] = jid.split('@');
  const masked = user.length <= 6 ? `${user.slice(0, 2)}***` : `${user.slice(0, 4)}*****${user.slice(-4)}`;
  return server && server !== 's.whatsapp.net' ? `${masked}@${server}` : masked;
}

/** Mascara um segredo mantendo apenas um prefixo identificável. */
export function maskSecret(secret?: string | null, visible = 4): string {
  if (!secret) return '';
  return secret.length <= visible ? '****' : `${secret.slice(0, visible)}${'*'.repeat(8)}`;
}

/** Remove a parte de credenciais de uma URL (user:pass@) para logs. */
export function safeUrl(raw?: string | null): string {
  if (!raw) return '-';
  try {
    const url = new URL(raw);
    url.username = '';
    url.password = '';
    url.search = '';
    return url.toString();
  } catch {
    return '[url inválida]';
  }
}
