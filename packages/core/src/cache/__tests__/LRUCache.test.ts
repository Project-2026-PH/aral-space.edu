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

    expect(cache.size()).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });
});
