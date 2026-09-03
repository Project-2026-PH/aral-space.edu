import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUCache } from '../LRUCache';

describe('LRUCache', () => {
  it('stores and retrieves cached items', () => {
    const cache = new LRUCache<string, string>({ maxSize: 3, ttlMs: 10_000 });
    cache.set('key1', 'val1');
    cache.set('key2', 'val2');

    expect(cache.get('key1')).toBe('val1');
    expect(cache.get('key2')).toBe('val2');
    expect(cache.get('unknown')).toBeUndefined();
  });

  it('evicts least recently used item when capacity is exceeded', () => {
    const cache = new LRUCache<string, number>({ maxSize: 2, ttlMs: 10_000 });
    cache.set('a', 1);
    cache.set('b', 2);

    // Access 'a' to make 'b' the LRU item
    cache.get('a');

    // Add 'c', should evict 'b'
    cache.set('c', 3);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('b')).toBeUndefined();
  });

  it('evicts items after TTL expires', () => {
    vi.useFakeTimers();
    const cache = new LRUCache<string, string>({ maxSize: 10, ttlMs: 1_000 });
    cache.set('short_lived', 'active');

    expect(cache.get('short_lived')).toBe('active');

    // Advance time by 1500ms
    vi.advanceTimersByTime(1500);

    expect(cache.get('short_lived')).toBeUndefined();
    vi.useRealTimers();
  });

  it('deletes items by prefix', () => {
    const cache = new LRUCache<string, string>();
    cache.set('quizzes:user1', 'data1');
    cache.set('quizzes:user2', 'data2');
    cache.set('subjects:user1', 'subj1');

    cache.deleteByPrefix('quizzes:');

    expect(cache.get('quizzes:user1')).toBeUndefined();
    expect(cache.get('quizzes:user2')).toBeUndefined();
    expect(cache.get('subjects:user1')).toBe('subj1');
  });

  it('clears all items', () => {
    const cache = new LRUCache<string, string>();
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('handles boundary condition when maxSize is <= 0', () => {
    const cacheZero = new LRUCache<string, string>({ maxSize: 0 });
    cacheZero.set('foo', 'bar');
    expect(cacheZero.size).toBe(0);
    expect(cacheZero.get('foo')).toBeUndefined();
    expect(cacheZero.has('foo')).toBe(false);

    expect(() => new LRUCache({ maxSize: -1 })).toThrow(RangeError);
    expect(() => new LRUCache({ ttlMs: -100 })).toThrow(RangeError);
    expect(() => cacheZero.set('test', 'val', -50)).toThrow(RangeError);
  });

  it('implements has() and peek() without mutating LRU order', () => {
    const cache = new LRUCache<string, number>({ maxSize: 2, ttlMs: 10_000 });
    cache.set('a', 1);
    cache.set('b', 2);

    // peek and has on 'a' should NOT make 'b' the LRU item
    expect(cache.has('a')).toBe(true);
    expect(cache.has('unknown')).toBe(false);
    expect(cache.peek('a')).toBe(1);

    // Adding 'c' should evict 'a' (the oldest), NOT 'b'
    cache.set('c', 3);

    expect(cache.peek('a')).toBeUndefined();
    expect(cache.has('a')).toBe(false);
    expect(cache.peek('b')).toBe(2);
    expect(cache.peek('c')).toBe(3);
  });

  it('triggers onEvict callback when items expire or capacity exceeded', () => {
    const evicted: Array<{ key: string; val: number }> = [];
    const cache = new LRUCache<string, number>({
      maxSize: 2,
      ttlMs: 500,
      onEvict: (k, v) => evicted.push({ key: k, val: v })
    });

    cache.set('x', 10);
    cache.set('y', 20);
    cache.set('z', 30); // Evicts 'x' due to maxSize

    expect(evicted).toEqual([{ key: 'x', val: 10 }]);

    vi.useFakeTimers();
    vi.advanceTimersByTime(1000);

    // Expired item access triggers onEvict
    expect(cache.get('y')).toBeUndefined();
    expect(evicted).toEqual([
      { key: 'x', val: 10 },
      { key: 'y', val: 20 }
    ]);
    vi.useRealTimers();
  });
});

