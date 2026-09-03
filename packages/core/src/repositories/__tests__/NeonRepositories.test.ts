import { describe, it, expect, vi } from 'vitest';
import { NeonQuizRepository } from '../NeonQuizRepository';
import { NeonSessionRepository } from '../NeonSessionRepository';
import { RepositoryFactory } from '../RepositoryFactory';

describe('Neon Repositories Unit Tests', () => {
  it('NeonQuizRepository handles listQuizzes with mock SQL client', async () => {
    const mockRows = [
      {
        id: 'quiz-1',
        title: 'Neon Physics Quiz',
        question_count: 5,
        source_model: 'gemini',
        generated_at: new Date().toISOString(),
        subject: { id: 'subj-1', name: 'Physics', color: '#60A5FA' }
      }
    ];

    const mockSql: any = vi.fn().mockResolvedValue(mockRows);
    const repo = new NeonQuizRepository(mockSql);

    const quizzes = await repo.listQuizzes('user_123');
    expect(quizzes.length).toBe(1);
    expect(quizzes[0].title).toBe('Neon Physics Quiz');
    expect(mockSql).toHaveBeenCalled();
  });

  it('NeonSessionRepository handles session retrieval with mock SQL client', async () => {
    const mockSession = {
      id: 'session-123',
      quiz_id: 'quiz-1',
      user_id: 'user_123',
      session_type: 'initial',
      status: 'in_progress',
      available_at: new Date().toISOString(),
      started_at: new Date().toISOString()
    };

    const mockSql: any = vi.fn().mockResolvedValue([mockSession]);
    const repo = new NeonSessionRepository(mockSql);

    const session = await repo.getActiveSession('quiz-1', 'user_123');
    expect(session?.id).toBe('session-123');
    expect(session?.status).toBe('in_progress');
  });

  it('RepositoryFactory instantiates Neon repositories when databaseUrl is provided', () => {
    const fakeUrl = 'postgresql://user:pass@ep-cool-sample.us-east-2.aws.neon.tech/neondb?sslmode=require';
    const quizRepo = RepositoryFactory.createQuizRepository({ databaseUrl: fakeUrl, enableCache: false });
    const sessionRepo = RepositoryFactory.createSessionRepository({ databaseUrl: fakeUrl });

    expect(quizRepo).toBeInstanceOf(NeonQuizRepository);
    expect(sessionRepo).toBeInstanceOf(NeonSessionRepository);
  });
});
