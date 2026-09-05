import type { ISessionRepository, IQuizRepository } from '@quiz-creator/core/repositories';
import { MemorySessionRepository } from '@quiz-creator/core/repositories';
import { MasteryEngineService, SAMPLE_QUIZ_ID, SAMPLE_QUIZ_QUESTIONS } from '@quiz-creator/core/services';
import { SessionType, QuestionProgress, SessionMasterySummary, QuizQuestion } from '@quiz-creator/types';

function isUuid(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export class MasterySessionController {
  private static sampleSessionRepo: ISessionRepository = new MemorySessionRepository();

  constructor(
    private sessionRepo: ISessionRepository,
    private quizRepo?: IQuizRepository,
    sampleSessionRepo?: ISessionRepository
  ) {
    if (sampleSessionRepo) {
      MasterySessionController.sampleSessionRepo = sampleSessionRepo;
    }
  }

  async getOrStartSession(
    quizId: string,
    sessionType: SessionType = 'initial',
    userId?: string,
    providedQuestions?: QuizQuestion[]
  ) {
    if (!isUuid(quizId)) {
      // In-memory quiz (e.g. SAMPLE_QUIZ_ID). Never send non-UUID to Postgres.
      const sessionPromise = MasterySessionController.sampleSessionRepo.getActiveSession(quizId, userId);
      const questionsPromise = providedQuestions
        ? Promise.resolve(providedQuestions)
        : quizId === SAMPLE_QUIZ_ID
          ? Promise.resolve(SAMPLE_QUIZ_QUESTIONS)
          : this.quizRepo
            ? this.quizRepo.getQuestionsByQuizId(quizId)
            : Promise.reject(new Error('Quiz repository is required to start this session'));

      const [existingSession, questions] = await Promise.all([sessionPromise, questionsPromise]);
      let session = existingSession;
      let progressList: QuestionProgress[] = [];

      if (!session) {
        session = await MasterySessionController.sampleSessionRepo.createSession(quizId, sessionType, new Date().toISOString(), userId);
      } else {
        progressList = await MasterySessionController.sampleSessionRepo.getProgressForSession(session.id);
      }

      const existingMap = new Map(progressList.map(p => [p.question_id, p]));
      const missing = questions.filter(q => !existingMap.has(q.id));

      if (missing.length > 0) {
        const newProgressRows: QuestionProgress[] = missing.map(q => ({
          session_id: session!.id,
          question_id: q.id,
          streak_count: 0,
          has_missed: false,
          locked: false
        }));
        const saved = await MasterySessionController.sampleSessionRepo.batchSaveQuestionProgress(newProgressRows);
        progressList = [...progressList, ...saved];
      }

      return { session, questions, progress: progressList };
    }

    if (!this.quizRepo && !providedQuestions) {
      throw new Error('Quiz repository is required to start this session');
    }

    const sessionPromise = this.sessionRepo.getActiveSession(quizId, userId);
    const questionsPromise = providedQuestions
      ? Promise.resolve(providedQuestions)
      : this.quizRepo!.getQuestionsByQuizId(quizId);

    const [existingSession, questions] = await Promise.all([sessionPromise, questionsPromise]);
    let session = existingSession;
    let progressList: QuestionProgress[] = [];

    if (!session) {
      session = await this.sessionRepo.createSession(quizId, sessionType, new Date().toISOString(), userId);
    } else {
      progressList = await this.sessionRepo.getProgressForSession(session.id);
    }

    const existingMap = new Map(progressList.map(p => [p.question_id, p]));
    const missing = questions.filter(q => !existingMap.has(q.id));

    if (missing.length > 0) {
      const newProgressRows: QuestionProgress[] = missing.map(q => ({
        session_id: session!.id,
        question_id: q.id,
        streak_count: 0,
        has_missed: false,
        locked: false
      }));
      const saved = await this.sessionRepo.batchSaveQuestionProgress(newProgressRows);
      progressList = [...progressList, ...saved];
    }

    return { session, questions, progress: progressList };
  }

  async recordAnswer(
    sessionId: string,
    questionId: string,
    isCorrect: boolean,
    sessionType: SessionType = 'initial',
    _latencyMs?: number
  ) {
    if (!isUuid(sessionId)) {
      // In-memory session. Never send non-UUID to Postgres.
      const progressList = await MasterySessionController.sampleSessionRepo.getProgressForSession(sessionId);
      const current = progressList.find(p => p.question_id === questionId) || {
        session_id: sessionId,
        question_id: questionId,
        streak_count: 0,
        has_missed: false,
        locked: false
      };

      const nextState = MasteryEngineService.calculateNextProgress(current, isCorrect, sessionType);
      const updated: QuestionProgress = {
        ...current,
        ...nextState
      };

      return await MasterySessionController.sampleSessionRepo.saveQuestionProgress(updated);
    }

    const progressList = await this.sessionRepo.getProgressForSession(sessionId);
    const current = progressList.find(p => p.question_id === questionId) || {
      session_id: sessionId,
      question_id: questionId,
      streak_count: 0,
      has_missed: false,
      locked: false
    };

    const nextState = MasteryEngineService.calculateNextProgress(current, isCorrect, sessionType);
    const updated: QuestionProgress = {
      ...current,
      ...nextState
    };

    return await this.sessionRepo.saveQuestionProgress(updated);
  }

  async completeSession(
    sessionId: string,
    quizId: string,
    userId?: string,
    summary?: SessionMasterySummary
  ) {
    if (!isUuid(sessionId) || !isUuid(quizId)) {
      // In-memory session / quiz. Never send non-UUID to Postgres.
      try {
        const completed = await MasterySessionController.sampleSessionRepo.updateSessionStatus(sessionId, 'completed', new Date().toISOString());
        const nextPlan = MasteryEngineService.planNextSession(completed);
        let scheduledSession = null;
        if (nextPlan) {
          scheduledSession = await MasterySessionController.sampleSessionRepo.createSession(quizId, nextPlan.sessionType, nextPlan.availableAt, userId);
          await MasterySessionController.sampleSessionRepo.updateSessionStatus(scheduledSession.id, 'scheduled');
        }
        return { completedSession: completed, scheduledSession, nextPlan, summary: summary || null };
      } catch {
        return {
          completedSession: {
            id: sessionId,
            quiz_id: quizId,
            user_id: userId || null,
            session_type: 'initial',
            status: 'completed' as const,
            available_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          },
          scheduledSession: null,
          nextPlan: null,
          summary: summary || null
        };
      }
    }

    const completed = await this.sessionRepo.updateSessionStatus(sessionId, 'completed', new Date().toISOString());
    const nextPlan = MasteryEngineService.planNextSession(completed);

    let scheduledSession = null;
    if (nextPlan) {
      scheduledSession = await this.sessionRepo.createSession(quizId, nextPlan.sessionType, nextPlan.availableAt, userId);
      await this.sessionRepo.updateSessionStatus(scheduledSession.id, 'scheduled');
    }

    return { completedSession: completed, scheduledSession, nextPlan, summary: summary || null };
  }
}

