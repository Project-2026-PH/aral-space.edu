import { RepositoryFactory } from '@quiz-creator/core/repositories';
import type { IQuizRepository, ISessionRepository } from '@quiz-creator/core/repositories';
import { createServerSupabaseClient } from './supabase/server';
import { cache } from 'react';
import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';

/**
 * Returns DATABASE_URL if configured in environment
 */
export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
}

// Persistent process-level singletons for stateless Neon HTTP queries
let cachedNeonQuizRepo: IQuizRepository | null = null;
let cachedNeonSessionRepo: ISessionRepository | null = null;

/**
 * Unified Quiz Repository Provider for Next.js App Router
 * Automatically handles:
 * 1. Neon Serverless Postgres (via DATABASE_URL / NEON_DATABASE_URL)
 * 2. Supabase Postgres (fallback)
 * 3. In-memory storage (local fallback)
 * + High performance LRU and React Cache layers for hot reads.
 */
export const getQuizRepository = cache(async (enableCache: boolean = true): Promise<IQuizRepository> => {
  const databaseUrl = getDatabaseUrl();
  if (databaseUrl) {
    if (enableCache) {
      if (!cachedNeonQuizRepo) {
        cachedNeonQuizRepo = RepositoryFactory.createQuizRepository({ databaseUrl, enableCache: true });
      }
      return cachedNeonQuizRepo;
    }
    return RepositoryFactory.createQuizRepository({ databaseUrl, enableCache: false });
  }

  const supabase = await createServerSupabaseClient();
  return RepositoryFactory.createQuizRepository({ supabase, enableCache });
});

/**
 * Unified Session Repository Provider for Next.js App Router
 */
export const getSessionRepository = cache(async (): Promise<ISessionRepository> => {
  const databaseUrl = getDatabaseUrl();
  if (databaseUrl) {
    if (!cachedNeonSessionRepo) {
      cachedNeonSessionRepo = RepositoryFactory.createSessionRepository({ databaseUrl });
    }
    return cachedNeonSessionRepo;
  }

  const supabase = await createServerSupabaseClient();
  return RepositoryFactory.createSessionRepository({ supabase });
});

export interface DatabasePingResult {
  ok: boolean;
  provider: 'neon' | 'supabase' | 'memory';
  latencyMs: number;
}

/**
 * Executes a lightweight ping query against active database backend.
 * Keeps serverless Neon compute / Supabase sessions warm and prevents cold starts.
 */
export async function pingDatabase(): Promise<DatabasePingResult> {
  const start = performance.now();
  const databaseUrl = getDatabaseUrl();

  if (databaseUrl) {
    const sql = neon(databaseUrl);
    await sql`SELECT 1 as ping`;
    return {
      ok: true,
      provider: 'neon',
      latencyMs: Math.round(performance.now() - start),
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from('subjects').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) {
      throw new Error(`Supabase ping failed: ${error.message}`);
    }
    return {
      ok: true,
      provider: 'supabase',
      latencyMs: Math.round(performance.now() - start),
    };
  }

  return {
    ok: true,
    provider: 'memory',
    latencyMs: Math.round(performance.now() - start),
  };
}

