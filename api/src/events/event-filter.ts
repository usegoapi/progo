import { resolveEventName, WaEvent } from '../shared/event-bus.service';

/** Lista vazia = todos os eventos. Aceita nomes canônicos e apelidos legados. */
export function eventMatches(selected: string[] | undefined, event: WaEvent): boolean {
  if (!selected || selected.length === 0) return true;
  return selected.some((name) => resolveEventName(name) === event);
}

/** Payload padrão entregue a todos os transportes. Nunca inclui credenciais. */
export function buildPayload(event: WaEvent, instance: { id: string; name: string }, data: unknown, date: string) {
  return {
    event,
    instance: { id: instance.id, name: instance.name },
    data,
    date_time: date,
  };
}

/** JSON seguro para Buffers/BigInt/Long presentes nos objetos do Baileys. */
export function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'bigint') return val.toString();
    if (val && typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
      return Buffer.from(val.data).toString('base64');
    }
    if (val instanceof Uint8Array) return Buffer.from(val).toString('base64');
    if (val && typeof val === 'object' && typeof val.low === 'number' && typeof val.high === 'number' && 'unsigned' in val) {
      return Number(BigInt(val.high) * 2n ** 32n + BigInt(val.low >>> 0));
    }
    return val;
  });
}
