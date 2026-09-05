import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RepositoryFactory } from '../RepositoryFactory';
import { SupabaseQuizRepository } from '../SupabaseQuizRepository';

describe('RepositoryFactory & Supabase Serverless Guards', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('fails fast in production when database config is missing', () => {
    process.env.NODE_ENV = 'production';

    expect(() => {
      RepositoryFactory.createQuizRepository(null);
    }).toThrow(/\[Serverless Guard\] Production database configuration missing/);

    expect(() => {
      RepositoryFactory.createSessionRepository(null);
    }).toThrow(/\[Serverless Guard\] Production database configuration missing/);
  });

  it('allows memory repository fallback in development or test', () => {
    process.env.NODE_ENV = 'test';

    const quizRepo = RepositoryFactory.createQuizRepository(null, { enableCache: false });
    expect(quizRepo).toBeDefined();

    const sessionRepo = RepositoryFactory.createSessionRepository(null);
    expect(sessionRepo).toBeDefined();
  });

  it('blocks silent memory fallback in SupabaseQuizRepository under production', async () => {
    process.env.NODE_ENV = 'production';

    // Mock supabase client that returns error / throws
    const mockSupabase: any = {
      from: () => ({
        select: () => ({
          order: () => ({
            or: () => Promise.resolve({ data: null, error: new Error('Network connection timeout') }),
          }),
        }),
      }),
    };

    const repo = new SupabaseQuizRepository(mockSupabase);

    await expect(repo.listSubjects('anon_123')).rejects.toThrow(
      /\[Serverless Guard\] Supabase query failed: In-memory fallback is disabled in production/
    );
  });
});
