import { IQuizRepository } from './IQuizRepository';
import { ISessionRepository } from './ISessionRepository';
import { MemoryQuizRepository } from './MemoryQuizRepository';
import { MemorySessionRepository } from './MemorySessionRepository';
import { SupabaseQuizRepository } from './SupabaseQuizRepository';
import { SupabaseSessionRepository } from './SupabaseSessionRepository';
import { LocalFirstQuizRepository } from './LocalFirstQuizRepository';
import { LocalFirstSessionRepository } from './LocalFirstSessionRepository';
import { SupabaseClient } from '@supabase/supabase-js';

// Singleton in-memory stores for fallback
const sharedMemoryQuizRepo = new MemoryQuizRepository();
const sharedMemorySessionRepo = new MemorySessionRepository();
let sharedLocalFirstQuizRepo: LocalFirstQuizRepository | null = null;
let sharedLocalFirstSessionRepo: LocalFirstSessionRepository | null = null;

export class RepositoryFactory {
  static createQuizRepository(supabase?: SupabaseClient | null): IQuizRepository {
    if (supabase) {
      return new SupabaseQuizRepository(supabase);
    }
    return sharedMemoryQuizRepo;
  }

  static createSessionRepository(supabase?: SupabaseClient | null): ISessionRepository {
    if (supabase) {
      return new SupabaseSessionRepository(supabase);
    }
    return sharedMemorySessionRepo;
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
