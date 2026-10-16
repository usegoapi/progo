/**
 * Descrição curta e útil de um erro para logs.
 * Cobre casos em que `message` vem vazio (ex: AggregateError do axios com ECONNREFUSED em IPv4+IPv6).
 */
export function describeError(err: unknown): string {
  if (!err) return 'erro desconhecido';
  if (typeof err === 'string') return err;
  const e = err as { message?: string; code?: string; name?: string; response?: { status?: number }; errors?: unknown[] };

  if (e.response?.status) return `HTTP ${e.response.status}`;
  const nested = Array.isArray(e.errors) ? (e.errors[0] as { code?: string; message?: string } | undefined) : undefined;
  const code = e.code ?? nested?.code;
  const message = e.message || nested?.message;

  if (code && message && !message.includes(code)) return `${code}: ${message}`;
  return message || code || e.name || 'erro desconhecido';
}
