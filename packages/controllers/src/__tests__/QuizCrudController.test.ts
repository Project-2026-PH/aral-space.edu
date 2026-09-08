import { describe, it, expect, vi } from 'vitest';
import { QuizCrudController } from '../QuizCrudController';
import { MasterySessionController } from '../MasterySessionController';
import { MemorySessionRepository } from '@quiz-creator/core/repositories';
import { SAMPLE_QUIZ_ID } from '@quiz-creator/core/services';

describe('QuizCrudController & MasterySessionController', () => {
  it('QuizCrudController delegates directly to repository without injecting hardcoded sample', async () => {
    const mockRepo: any = {
      listQuizzes: vi.fn().mockResolvedValue([{ id: 'quiz-1', title: 'Test Quiz' }]),
      listSubjects: vi.fn().mockResolvedValue([{ id: 'sub-1', name: 'Test Subject' }]),
      getQuizById: vi.fn().mockResolvedValue({ id: 'quiz-1', title: 'Test Quiz' }),
      getQuestionsByQuizId: vi.fn().mockResolvedValue([{ id: 'q-1', question_text: 'Q1' }])
    };

    const controller = new QuizCrudController(mockRepo);
    const quizzes = await controller.listQuizzes('user-1');
    expect(quizzes).toEqual([{ id: 'quiz-1', title: 'Test Quiz' }]);
    expect(mockRepo.listQuizzes).toHaveBeenCalledWith('user-1');

    const subjects = await controller.listSubjects('user-1');
    expect(subjects).toEqual([{ id: 'sub-1', name: 'Test Subject' }]);
    expect(mockRepo.listSubjects).toHaveBeenCalledWith('user-1');

    const fullQuiz = await controller.getQuiz('quiz-1', 'user-1');
    expect(fullQuiz).not.toBeNull();
    expect(fullQuiz?.id).toBe('quiz-1');
    expect(fullQuiz?.questions.length).toBe(1);

    const quizById = await controller.getQuizById('quiz-1', 'user-1');
    expect(quizById).toEqual({ id: 'quiz-1', title: 'Test Quiz' });
    expect(mockRepo.getQuizById).toHaveBeenCalledWith('quiz-1', 'user-1');
  });

  it('uses the injected repository for sample sessions and preserves the legacy non-UUID fallback', async () => {
    const normalQuizId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const sharedSessionRepo = new MemorySessionRepository();
    const legacySessionRepo = new MemorySessionRepository();
    const mockQuizRepo: any = {
      getQuestionsByQuizId: vi.fn().mockResolvedValue([
        { id: 'q-custom-1', question_text: 'Test', options: ['A', 'B'], correct_answer: 0 }
      ])
    };
    const userId = 'anon-user-1';

    const controllerA = new MasterySessionController(sharedSessionRepo, mockQuizRepo, legacySessionRepo);
    const controllerB = new MasterySessionController(sharedSessionRepo, mockQuizRepo, legacySessionRepo);

    // Sample questions remain bundled, but the session and progress are shared.
    const sampleResult = await controllerA.getOrStartSession(SAMPLE_QUIZ_ID, 'initial', userId);
    expect(sampleResult.questions).toHaveLength(10);
    expect(sampleResult.progress).toHaveLength(10);
    expect(sampleResult.session.quiz_id).toBe(SAMPLE_QUIZ_ID);

    const updatedProgress = await controllerB.recordAnswer(
      sampleResult.session.id,
      sampleResult.questions[0].id,
      true,
      'initial',
      userId
    );
    expect(updatedProgress.streak_count).toBe(1);

    const resumedResult = await controllerB.getOrStartSession(SAMPLE_QUIZ_ID, 'initial', userId);
    expect(resumedResult.session.id).toBe(sampleResult.session.id);
    expect(resumedResult.progress.find((progress) => progress.question_id === sampleResult.questions[0].id)?.streak_count).toBe(1);

    const surrenderProgress = await controllerB.recordAnswer(
      sampleResult.session.id,
      sampleResult.questions[1].id,
      false,
      'initial',
      userId,
      1000,
      { selectedOptionId: -1 }
    );
    expect(surrenderProgress.streak_count).toBe(0);
    expect(surrenderProgress.has_missed).toBe(true);

    await expect(
      controllerB.recordAnswer(sampleResult.session.id, sampleResult.questions[0].id, true, 'initial', 'different-user')
    ).rejects.toThrow('Session not found or access is restricted');

    const completeResult = await controllerB.completeSession(sampleResult.session.id, SAMPLE_QUIZ_ID, userId);
    expect(completeResult.completedSession.status).toBe('completed');
    expect(completeResult.scheduledSession?.session_type).toBe('review_24h');
    expect((await sharedSessionRepo.getScheduledSession(SAMPLE_QUIZ_ID, userId))?.id).toBe(completeResult.scheduledSession?.id);

    // Normal UUID quizzes still delegate to the injected session repository.
    const mockSessionRepo: any = {
      getActiveSession: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue({
        id: 'sess-custom-1',
        quiz_id: normalQuizId,
        session_type: 'initial',
        created_at: new Date().toISOString()
      }),
      getProgressForSession: vi.fn().mockResolvedValue([]),
      batchSaveQuestionProgress: vi.fn().mockImplementation((rows) => Promise.resolve(rows))
    };
    const normalController = new MasterySessionController(mockSessionRepo, mockQuizRepo, legacySessionRepo);
    const normalResult = await normalController.getOrStartSession(normalQuizId);
    expect(mockSessionRepo.getActiveSession).toHaveBeenCalledWith(normalQuizId, undefined);
    expect(mockSessionRepo.createSession).toHaveBeenCalled();
    expect(normalResult.questions).toHaveLength(1);
  });
});
