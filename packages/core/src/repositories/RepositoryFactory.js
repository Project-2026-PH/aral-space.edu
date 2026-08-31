import { MemoryQuizRepository } from './MemoryQuizRepository';
import { MemorySessionRepository } from './MemorySessionRepository';
import { SupabaseQuizRepository } from './SupabaseQuizRepository';
import { SupabaseSessionRepository } from './SupabaseSessionRepository';
import { LocalFirstQuizRepository } from './LocalFirstQuizRepository';
import { LocalFirstSessionRepository } from './LocalFirstSessionRepository';
// Singleton in-memory stores for fallback
const sharedMemoryQuizRepo = new MemoryQuizRepository();
const sharedMemorySessionRepo = new MemorySessionRepository();
let sharedLocalFirstQuizRepo = null;
let sharedLocalFirstSessionRepo = null;
export class RepositoryFactory {
    static createQuizRepository(supabase) {
        if (supabase) {
            return new SupabaseQuizRepository(supabase, sharedMemoryQuizRepo);
        }
        return sharedMemoryQuizRepo;
    }
    static createSessionRepository(supabase) {
        if (supabase) {
            return new SupabaseSessionRepository(supabase);
        }
        return sharedMemorySessionRepo;
    }
    static createLocalFirstQuizRepository() {
        if (!sharedLocalFirstQuizRepo) {
            sharedLocalFirstQuizRepo = new LocalFirstQuizRepository();
        }
        return sharedLocalFirstQuizRepo;
    }
    static createLocalFirstSessionRepository() {
        if (!sharedLocalFirstSessionRepo) {
            sharedLocalFirstSessionRepo = new LocalFirstSessionRepository();
        }
        return sharedLocalFirstSessionRepo;
    }
}
