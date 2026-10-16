/**
 * Proteção do console contra vazamento de material criptográfico.
 *
 * A libsignal (dependência da Baileys) escreve no console objetos SessionEntry inteiros
 * (privKey, rootKey, chainKey...) ao abrir/fechar sessões. Este módulo:
 * - Suprime as mensagens de rotina da libsignal (exibidas apenas com LOG_LEVEL=debug/verbose);
 * - Substitui QUALQUER objeto com chaves sensíveis por um marcador, independentemente da origem.
 *
 * Deve ser importado antes de qualquer outro módulo (primeira linha do main.ts).
 */

const SENSITIVE_KEYS = new Set([
  'privKey',
  'privateKey',
  'rootKey',
  'chainKey',
  'ephemeralKeyPair',
  'baseKey',
  'remoteIdentityKey',
  'signedPreKey',
  'noiseKey',
  'signedIdentityKey',
  'advSecretKey',
  'macKey',
  'encKey',
]);

const LIBSIGNAL_ROUTINE = /^(Closing session|Opening session|Removing old closed session|Migrating session|Session already (closed|open)|Closing open session in favor|Decrypted message with closed session)/;
const REDACTED = '[dados criptográficos omitidos]';

function containsSecrets(value: unknown, depth = 0, seen = new WeakSet<object>()): boolean {
  if (!value || typeof value !== 'object' || depth > 4) return false;
  if (seen.has(value as object)) return false;
  seen.add(value as object);
  if ((value as object).constructor?.name === 'SessionEntry') return true;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) return true;
    if (containsSecrets(child, depth + 1, seen)) return true;
  }
  return false;
}

const sanitize = (args: unknown[]) => args.map((arg) => (containsSecrets(arg) ? REDACTED : arg));

let installed = false;

export function installConsoleGuard() {
  if (installed) return;
  installed = true;
  const verbose = ['debug', 'verbose'].includes((process.env.LOG_LEVEL ?? '').toLowerCase());

  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && LIBSIGNAL_ROUTINE.test(args[0])) {
        if (verbose) original(`[libsignal] ${args[0]}`);
        return;
      }
      original(...sanitize(args));
    };
  }
}

installConsoleGuard();
