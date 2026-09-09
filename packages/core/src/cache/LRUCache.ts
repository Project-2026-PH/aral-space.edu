export interface CacheOptions<K = string, V = unknown> {
  maxSize?: number;
  ttlMs?: number;
  onEvict?: (key: K, value: V) => void;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory LRU cache using Map insertion order.
 *
 * Expiration model:
 * Lazy (passive) expiration. Entries expire only when accessed via `get()`,
 * `has()`, or `peek()`, or when evicted due to `maxSize`. No background timers run.
 */
export class LRUCache<K = string, V = unknown> {
  private maxSize: number;
  private ttlMs: number;
  private onEvict?: (key: K, value: V) => void;
  private cache: Map<K, CacheEntry<V>>;

  constructor(options?: CacheOptions<K, V>) {
    if (options?.ttlMs !== undefined && options.ttlMs < 0) {
      throw new RangeError('ttlMs must be non-negative');
    }
    if (options?.maxSize !== undefined && options.maxSize < 0) {
      throw new RangeError('maxSize must be non-negative');
    }
    this.maxSize = options?.maxSize ?? 500;
    this.ttlMs = options?.ttlMs ?? 60_000; // Default 60 seconds
    this.onEvict = options?.onEvict;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.onEvict?.(key, entry.value);
      return undefined;
    }

    // Refresh LRU order (delete and re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  peek(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.onEvict?.(key, entry.value);
      return undefined;
    }

    return entry.value;
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.onEvict?.(key, entry.value);
      return false;
    }

    return true;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (ttlMs !== undefined && ttlMs < 0) {
      throw new RangeError('ttlMs must be non-negative');
    }

    if (this.maxSize <= 0) {
      return;
    }

    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest item (first key in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        const evictedEntry = this.cache.get(oldestKey);
        this.cache.delete(oldestKey);
        if (evictedEntry) {
          this.onEvict?.(oldestKey, evictedEntry.value);
        }
      }
    }

    const effectiveTtl = ttlMs ?? this.ttlMs;
    const expiresAt = Date.now() + effectiveTtl;
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  deleteByPrefix(this: LRUCache<string, V>, prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  deleteWhere(predicate: (key: K) => boolean): void {
    for (const key of this.cache.keys()) {
      if (predicate(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export class StringLRUCache<V = unknown> extends LRUCache<string, V> {}

