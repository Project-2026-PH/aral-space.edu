import { RepositoryFactory } from '@quiz-creator/core';
import type { IQuizRepository, ISessionRepository } from '@quiz-creator/core';
import { createServerSupabaseClient } from './supabase/server';
import { cache } from 'react';

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
