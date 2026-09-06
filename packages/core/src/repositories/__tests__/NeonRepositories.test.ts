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

  it('creates a quiz and its questions in one SQL statement', async () => {
    const createdQuiz = {
      id: 'quiz-1',
      title: 'Atomic Biology Quiz',
      question_count: 1,
      source_model: 'manual',
      generated_at: new Date().toISOString()
    };
    const mockSql: any = vi.fn().mockResolvedValue([createdQuiz]);
    const repo = new NeonQuizRepository(mockSql);

    const quiz = await repo.createQuiz({
      title: 'Atomic Biology Quiz',
      subject_id: null,
      questions: [{
        question_text: 'What is ATP?',
        options: ['Energy', 'Protein'],
        correct_answer: 0
      }]
    });

    expect(quiz).toEqual(createdQuiz);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('initializes user-scoped progress in one atomic upsert', async () => {
    const inputProgress = [{
      session_id: 'session-1',
      question_id: 'question-1',
      streak_count: 0,
      has_missed: false,
      locked: false
    }];
    const savedProgress = [{
      id: 'progress-1',
      ...inputProgress[0]
    }];
    const mockSql: any = vi.fn().mockResolvedValue(savedProgress);
    const repo = new NeonSessionRepository(mockSql);

    const progress = await repo.batchSaveQuestionProgress(inputProgress, 'user-1');

    expect(progress).toEqual(savedProgress);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('RepositoryFactory instantiates Neon repositories when databaseUrl is provided', () => {
    const fakeUrl = 'postgresql://user:pass@ep-cool-sample.us-east-2.aws.neon.tech/neondb?sslmode=require';
    const quizRepo = RepositoryFactory.createQuizRepository({ databaseUrl: fakeUrl, enableCache: false });
    const sessionRepo = RepositoryFactory.createSessionRepository({ databaseUrl: fakeUrl });

    expect(quizRepo).toBeInstanceOf(NeonQuizRepository);
    expect(sessionRepo).toBeInstanceOf(NeonSessionRepository);
  });
});
