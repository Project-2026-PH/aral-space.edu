import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CachedQuizRepository } from '../CachedQuizRepository';
import { RepositoryFactory } from '../RepositoryFactory';
import { IQuizRepository } from '../IQuizRepository';
import { Quiz, QuizQuestion, Subject } from '@quiz-creator/types';

describe('CachedQuizRepository', () => {
  let mockRepo: IQuizRepository;
  let cachedRepo: CachedQuizRepository;

  const sampleSubject: Subject = {
    id: 'subj-1',
    name: 'Biology',
    color: '#10B981'
  };

  const sampleQuiz: Quiz = {
    id: 'quiz-1',
    title: 'Cellular Biology',
    question_count: 1,
    generated_at: new Date().toISOString(),
    source_model: 'manual'
  };

  const sampleQuestion: QuizQuestion = {
    id: 'q-1',
    quiz_id: 'quiz-1',
    question_text: 'What is ATP?',
    options: ['Energy', 'Protein'],
    correct_answer: 0,
    order_index: 0
  };

  beforeEach(() => {
    mockRepo = {
      listSubjects: vi.fn().mockResolvedValue([sampleSubject]),
      createSubject: vi.fn().mockResolvedValue(sampleSubject),
      updateSubject: vi.fn().mockResolvedValue(sampleSubject),
      getSubjectAccess: vi.fn().mockResolvedValue(null),
      listQuizzesBySubject: vi.fn().mockResolvedValue([sampleQuiz]),
      createSubjectCollaboratorLink: vi.fn().mockResolvedValue({ token: 'collab-token', expires_at: null }),
      redeemSubjectCollaboratorLink: vi.fn().mockResolvedValue(null),
      deleteSubject: vi.fn().mockResolvedValue(true),
      getSubjectShareConfig: vi.fn().mockResolvedValue({ share_token: 'subject-tok-1', is_public: true }),
      updateSubjectShareConfig: vi.fn().mockResolvedValue({ share_token: 'subject-tok-1', is_public: true }),
      getSubjectByShareToken: vi.fn().mockResolvedValue(null),
      listQuizzes: vi.fn().mockResolvedValue([sampleQuiz]),
      getQuizById: vi.fn().mockResolvedValue(sampleQuiz),
      createQuiz: vi.fn().mockResolvedValue(sampleQuiz),
      updateQuiz: vi.fn().mockResolvedValue({ ...sampleQuiz, title: 'Updated Title' }),
      deleteQuiz: vi.fn().mockResolvedValue(true),
      getQuestionsByQuizId: vi.fn().mockResolvedValue([sampleQuestion]),
      addQuestion: vi.fn().mockResolvedValue(sampleQuestion),
      updateQuestion: vi.fn().mockResolvedValue(sampleQuestion),
      deleteQuestion: vi.fn().mockResolvedValue(true),
      reorderQuestions: vi.fn().mockResolvedValue(true),
      getShareConfig: vi.fn().mockResolvedValue({ share_token: 'tok-1', is_public: true, allow_cloning: true }),
      updateShareConfig: vi.fn().mockResolvedValue({ share_token: 'tok-1', is_public: true, allow_cloning: true }),
      getQuizByShareToken: vi.fn().mockResolvedValue(null),
      cloneQuizByShareToken: vi.fn().mockResolvedValue(sampleQuiz)
    };

    cachedRepo = new CachedQuizRepository(mockRepo);
  });

  it('serves listQuizzes from cache on second read without invoking underlying repo', async () => {
    const res1 = await cachedRepo.listQuizzes('user1');
    expect(mockRepo.listQuizzes).toHaveBeenCalledTimes(1);

    const res2 = await cachedRepo.listQuizzes('user1');
    expect(mockRepo.listQuizzes).toHaveBeenCalledTimes(1);
    expect(res1).toEqual(res2);
  });

  it('serves getQuizById from cache on repeated read', async () => {
    const q1 = await cachedRepo.getQuizById('quiz-1', 'user1');
    expect(mockRepo.getQuizById).toHaveBeenCalledTimes(1);
    expect(q1?.title).toBe('Cellular Biology');

    const q2 = await cachedRepo.getQuizById('quiz-1', 'user1');
    expect(mockRepo.getQuizById).toHaveBeenCalledTimes(1);
    expect(q2?.title).toBe('Cellular Biology');
  });

  it('invalidates listQuizzes and getQuizById cache on quiz update', async () => {
    await cachedRepo.getQuizById('quiz-1', 'user1');
    expect(mockRepo.getQuizById).toHaveBeenCalledTimes(1);

    // Update quiz -> triggers cache invalidation
    await cachedRepo.updateQuiz('quiz-1', { title: 'Updated Title' }, 'user1');
    expect(mockRepo.updateQuiz).toHaveBeenCalledTimes(1);

    // Fetch again -> cache missed, calls underlying
    await cachedRepo.getQuizById('quiz-1', 'user1');
    expect(mockRepo.getQuizById).toHaveBeenCalledTimes(2);
  });

  it('invalidates cache on deleteQuiz', async () => {
    await cachedRepo.listQuizzes('user1');
    expect(mockRepo.listQuizzes).toHaveBeenCalledTimes(1);

    await cachedRepo.deleteQuiz('quiz-1', 'user1');

    await cachedRepo.listQuizzes('user1');
    expect(mockRepo.listQuizzes).toHaveBeenCalledTimes(2);
  });

  it('caches and invalidates question lists', async () => {
    // First fetch
    await cachedRepo.getQuestionsByQuizId('quiz-1');
    expect(mockRepo.getQuestionsByQuizId).toHaveBeenCalledTimes(1);

    // Second fetch (cached)
    await cachedRepo.getQuestionsByQuizId('quiz-1');
    expect(mockRepo.getQuestionsByQuizId).toHaveBeenCalledTimes(1);

    // Add question -> invalidates questions cache
    await cachedRepo.addQuestion('quiz-1', {
      question_text: 'New question',
      options: ['A', 'B'],
      correct_answer: 0
    });

    // Third fetch -> cache missed, calls underlying
    await cachedRepo.getQuestionsByQuizId('quiz-1');
    expect(mockRepo.getQuestionsByQuizId).toHaveBeenCalledTimes(2);
  });

  it('shares cache across different repository instances created by RepositoryFactory', async () => {
    RepositoryFactory.clearSharedQuizCache();

    // First factory call (e.g. Request 1)
    const repoInstance1 = RepositoryFactory.createQuizRepository();
    await repoInstance1.createQuiz({
      title: 'Shared Factory Quiz',
      questions: []
    }, 'user-shared-1');

    // Populate cache on instance 1
    const quizzes1 = await repoInstance1.listQuizzes('user-shared-1');
    expect(quizzes1.length).toBeGreaterThan(0);

    // Second factory call (e.g. Request 2)
    const repoInstance2 = RepositoryFactory.createQuizRepository();
    const quizzes2 = await repoInstance2.listQuizzes('user-shared-1');

    // Both instances see the cached data
    expect(quizzes2).toEqual(quizzes1);
  });

  it('serves listQuizzesAndSubjects from cache and delegates to underlying batch fetcher when cold', async () => {
    mockRepo.listQuizzesAndSubjects = vi.fn().mockResolvedValue({
      quizzes: [sampleQuiz],
      subjects: [sampleSubject],
    });

    const first = await cachedRepo.listQuizzesAndSubjects('user-test-1');
    expect(first.quizzes).toEqual([sampleQuiz]);
    expect(first.subjects).toEqual([sampleSubject]);
    expect(mockRepo.listQuizzesAndSubjects).toHaveBeenCalledTimes(1);

    // Second call should hit LRU cache for both quizzes and subjects without DB hit
    const second = await cachedRepo.listQuizzesAndSubjects('user-test-1');
    expect(second.quizzes).toEqual([sampleQuiz]);
    expect(second.subjects).toEqual([sampleSubject]);
    expect(mockRepo.listQuizzesAndSubjects).toHaveBeenCalledTimes(1);
  });
});
