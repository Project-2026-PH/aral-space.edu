export interface CacheOptions {
  maxSize?: number;
  ttlMs?: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<K = string, V = any> {
  private maxSize: number;
  private ttlMs: number;
  private cache: Map<K, CacheEntry<V>>;

  constructor(options?: CacheOptions) {
    this.maxSize = options?.maxSize ?? 500;
    this.ttlMs = options?.ttlMs ?? 60_000; // Default 60 seconds
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh LRU order (delete and re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest item (first key in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    const expiresAt = Date.now() + (ttlMs ?? this.ttlMs);
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
