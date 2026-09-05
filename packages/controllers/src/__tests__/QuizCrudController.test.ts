import { describe, it, expect, vi } from 'vitest';
import { QuizCrudController } from '../QuizCrudController';
import { MasterySessionController } from '../MasterySessionController';
import { MemorySessionRepository } from '@quiz-creator/core/repositories';
import { SAMPLE_QUIZ_ID, SAMPLE_SUBJECT_ID } from '@quiz-creator/core/services';

describe('QuizCrudController & MasterySessionController Sample Defaults', () => {
  it('QuizCrudController prepends sample quiz and subject when repository is empty', async () => {
    const mockRepo: any = {
      listQuizzes: vi.fn().mockResolvedValue([]),
      listSubjects: vi.fn().mockResolvedValue([]),
      getQuizById: vi.fn().mockResolvedValue(null),
      getQuestionsByQuizId: vi.fn().mockResolvedValue([])
    };

    const controller = new QuizCrudController(mockRepo);
    const quizzes = await controller.listQuizzes();
    expect(quizzes.some(q => q.id === SAMPLE_QUIZ_ID)).toBe(true);

    const subjects = await controller.listSubjects();
    expect(subjects.some(s => s.id === SAMPLE_SUBJECT_ID)).toBe(true);

    const fullQuiz = await controller.getQuiz(SAMPLE_QUIZ_ID);
    expect(fullQuiz).not.toBeNull();
    expect(fullQuiz?.id).toBe(SAMPLE_QUIZ_ID);
    expect(fullQuiz?.questions.length).toBe(8);
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
    expect(sampleResult.questions.length).toBe(8);
    expect(sampleResult.progress.length).toBe(8);
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
