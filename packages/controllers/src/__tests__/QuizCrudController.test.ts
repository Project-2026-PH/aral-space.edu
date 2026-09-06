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
  });

  it('MasterySessionController isolates sample quiz sessions in memory and delegates normal quizzes to sessionRepo', async () => {
    const normalQuizId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
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
    const mockQuizRepo: any = {
      getQuestionsByQuizId: vi.fn().mockResolvedValue([
        { id: 'q-custom-1', question_text: 'Test', options: ['A', 'B'], correct_answer: 0 }
      ])
    };

    const memorySampleRepo = new MemorySessionRepository();
    const controller = new MasterySessionController(mockSessionRepo, mockQuizRepo, memorySampleRepo);
    
    // 1. Starting sample quiz uses sampleSessionRepo without touching mockSessionRepo
    const sampleResult = await controller.getOrStartSession(SAMPLE_QUIZ_ID);
    expect(sampleResult.questions.length).toBe(10);
    expect(sampleResult.progress.length).toBe(10);
    expect(sampleResult.session.quiz_id).toBe(SAMPLE_QUIZ_ID);
    expect(sampleResult.session.id).toBeTruthy();

    // 2. Answering sample question updates in-memory progress seamlessly
    const updatedProgress = await controller.recordAnswer(
      sampleResult.session.id,
      sampleResult.questions[0].id,
      true
    );
    expect(updatedProgress.streak_count).toBe(1);

    // 3. Completing sample session finishes without touching mockSessionRepo
    const completeResult = await controller.completeSession(sampleResult.session.id, SAMPLE_QUIZ_ID);
    expect(completeResult.completedSession.status).toBe('completed');

    // 4. Normal quiz delegates to underlying sessionRepo as expected
    const normalResult = await controller.getOrStartSession(normalQuizId);
    expect(mockSessionRepo.getActiveSession).toHaveBeenCalledWith(normalQuizId, undefined);
    expect(mockSessionRepo.createSession).toHaveBeenCalled();
    expect(normalResult.questions.length).toBe(1);
  });
});
