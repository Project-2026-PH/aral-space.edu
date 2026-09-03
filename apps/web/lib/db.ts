import { RepositoryFactory, IQuizRepository, ISessionRepository } from '@quiz-creator/core';
import { createServerSupabaseClient } from './supabase/server';
import { cache } from 'react';

/**
 * Returns DATABASE_URL if configured in environment
 */
export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
}

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
    return RepositoryFactory.createQuizRepository({ databaseUrl, enableCache });
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
    return RepositoryFactory.createSessionRepository({ databaseUrl });
  }

  const supabase = await createServerSupabaseClient();
  return RepositoryFactory.createSessionRepository({ supabase });
});
