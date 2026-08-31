import { ISessionRepository, IQuizRepository, MasteryEngineService } from '@quiz-creator/core';
import { SessionType, QuestionProgress } from '@quiz-creator/types';

export class MasterySessionController {
  constructor(
    private sessionRepo: ISessionRepository,
    private quizRepo: IQuizRepository
  ) {}

  async getOrStartSession(quizId: string, sessionType: SessionType = 'initial', userId?: string) {
    let session = await this.sessionRepo.getActiveSession(quizId, userId);
    if (!session) {
      session = await this.sessionRepo.createSession(quizId, sessionType, new Date().toISOString(), userId);
    }

    const questions = await this.quizRepo.getQuestionsByQuizId(quizId);
    let progressList = await this.sessionRepo.getProgressForSession(session.id);

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

  async recordAnswer(sessionId: string, questionId: string, isCorrect: boolean, sessionType: SessionType = 'initial') {
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

  async completeSession(sessionId: string, quizId: string, userId?: string) {
    const completed = await this.sessionRepo.updateSessionStatus(sessionId, 'completed', new Date().toISOString());
    const nextPlan = MasteryEngineService.planNextSession(completed);

    let scheduledSession = null;
    if (nextPlan) {
      scheduledSession = await this.sessionRepo.createSession(quizId, nextPlan.sessionType, nextPlan.availableAt, userId);
      await this.sessionRepo.updateSessionStatus(scheduledSession.id, 'scheduled');
    }

    return { completedSession: completed, scheduledSession, nextPlan };
  }
}
