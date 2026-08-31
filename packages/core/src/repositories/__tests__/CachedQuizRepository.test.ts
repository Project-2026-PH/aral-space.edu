import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CachedQuizRepository } from '../CachedQuizRepository';
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
      listQuizzes: vi.fn().mockResolvedValue([sampleQuiz]),
      getQuizById: vi.fn().mockResolvedValue(sampleQuiz),
      createQuiz: vi.fn().mockResolvedValue(sampleQuiz),
      updateQuiz: vi.fn().mockResolvedValue({ ...sampleQuiz, title: 'Updated Title' }),
      deleteQuiz: vi.fn().mockResolvedValue(true),
      getQuestionsByQuizId: vi.fn().mockResolvedValue([sampleQuestion]),
      addQuestion: vi.fn().mockResolvedValue(sampleQuestion),
      updateQuestion: vi.fn().mockResolvedValue(sampleQuestion),
      deleteQuestion: vi.fn().mockResolvedValue(true),
      reorderQuestions: vi.fn().mockResolvedValue(true)
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
});
