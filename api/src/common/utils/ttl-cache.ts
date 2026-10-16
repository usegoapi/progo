/**
 * Cache em memória com TTL e limite de tamanho (descarta as entradas mais antigas).
 * Leve o suficiente para caches quentes (números validados, metadados de grupo, ids de mensagem).
 */
export class TtlCache<K, V> {
  private readonly store = new Map<K, { value: V; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxSize = 10_000,
  ) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  set(key: K, value: V, ttlMs = this.ttlMs): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.store.size > this.maxSize) {
      const oldest = this.store.keys().next().value as K;
      this.store.delete(oldest);
    }
  }

  delete(key: K): void {
    this.store.delete(key);
  }

  deleteWhere(predicate: (key: K, value: V) => boolean): void {
    for (const [key, entry] of this.store) if (predicate(key, entry.value)) this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
