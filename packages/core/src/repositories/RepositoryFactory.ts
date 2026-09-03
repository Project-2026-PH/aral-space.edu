import { IQuizRepository } from './IQuizRepository';
import { ISessionRepository } from './ISessionRepository';
import { MemoryQuizRepository } from './MemoryQuizRepository';
import { MemorySessionRepository } from './MemorySessionRepository';
import { SupabaseQuizRepository } from './SupabaseQuizRepository';
import { SupabaseSessionRepository } from './SupabaseSessionRepository';
import { NeonQuizRepository } from './NeonQuizRepository';
import { NeonSessionRepository } from './NeonSessionRepository';
import { CachedQuizRepository } from './CachedQuizRepository';
import { LocalFirstQuizRepository } from './LocalFirstQuizRepository';
import { LocalFirstSessionRepository } from './LocalFirstSessionRepository';
import { LRUCache } from '../cache/LRUCache';
import { SupabaseClient } from '@supabase/supabase-js';

// Singleton in-memory stores for fallback and cross-request cache
const sharedQuizLruCache = new LRUCache<string, any>({ maxSize: 1000, ttlMs: 60_000 });
const sharedMemoryQuizRepo = new MemoryQuizRepository();
const sharedMemorySessionRepo = new MemorySessionRepository();
let sharedLocalFirstQuizRepo: LocalFirstQuizRepository | null = null;
let sharedLocalFirstSessionRepo: LocalFirstSessionRepository | null = null;

export interface RepositoryOptions {
  supabase?: SupabaseClient | null;
  databaseUrl?: string | null;
  enableCache?: boolean;
}

export class RepositoryFactory {
  static createQuizRepository(
    source?: SupabaseClient | RepositoryOptions | null,
    options?: { enableCache?: boolean }
  ): IQuizRepository {
    let repo: IQuizRepository;
    let shouldCache = options?.enableCache ?? true;

    if (source && typeof source === 'object' && ('databaseUrl' in source || 'supabase' in source || 'enableCache' in source)) {
      const opts = source as RepositoryOptions;
      if (opts.enableCache !== undefined) {
        shouldCache = opts.enableCache;
      }

      if (opts.databaseUrl) {
        repo = new NeonQuizRepository(opts.databaseUrl);
      } else if (opts.supabase) {
        repo = new SupabaseQuizRepository(opts.supabase, sharedMemoryQuizRepo);
      } else {
        repo = sharedMemoryQuizRepo;
      }
    } else if (source) {
      repo = new SupabaseQuizRepository(source as SupabaseClient, sharedMemoryQuizRepo);
    } else {
      repo = sharedMemoryQuizRepo;
    }

    if (shouldCache) {
      return new CachedQuizRepository(repo, sharedQuizLruCache);
    }
    return repo;
  }

  static createSessionRepository(
    source?: SupabaseClient | RepositoryOptions | null
  ): ISessionRepository {
    if (source && typeof source === 'object' && ('databaseUrl' in source || 'supabase' in source)) {
      const opts = source as RepositoryOptions;
      if (opts.databaseUrl) {
        return new NeonSessionRepository(opts.databaseUrl);
      } else if (opts.supabase) {
        return new SupabaseSessionRepository(opts.supabase);
      }
      return sharedMemorySessionRepo;
    } else if (source) {
      return new SupabaseSessionRepository(source as SupabaseClient);
    }
    return sharedMemorySessionRepo;
  }

  static createNeonQuizRepository(databaseUrl: string, enableCache: boolean = true): IQuizRepository {
    const repo = new NeonQuizRepository(databaseUrl);
    return enableCache ? new CachedQuizRepository(repo, sharedQuizLruCache) : repo;
  }

  static getSharedQuizCache(): LRUCache<string, any> {
    return sharedQuizLruCache;
  }

  static clearSharedQuizCache(): void {
    sharedQuizLruCache.clear();
  }

  static createNeonSessionRepository(databaseUrl: string): ISessionRepository {
    return new NeonSessionRepository(databaseUrl);
  }

  static createLocalFirstQuizRepository(): IQuizRepository {
    if (!sharedLocalFirstQuizRepo) {
      sharedLocalFirstQuizRepo = new LocalFirstQuizRepository();
    }
    return sharedLocalFirstQuizRepo;
  }

  static createLocalFirstSessionRepository(): ISessionRepository {
    if (!sharedLocalFirstSessionRepo) {
      sharedLocalFirstSessionRepo = new LocalFirstSessionRepository();
    }
    return sharedLocalFirstSessionRepo;
  }
}
