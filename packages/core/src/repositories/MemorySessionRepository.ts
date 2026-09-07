import { ISessionRepository } from './ISessionRepository';
import { QuizSession, QuestionProgress, SessionType, SessionStatus } from '@quiz-creator/types';

export class MemorySessionRepository implements ISessionRepository {
  private sessions: Map<string, QuizSession> = new Map();
  private progress: Map<string, QuestionProgress> = new Map();

  async getActiveSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    return Array.from(this.sessions.values()).find((session) => session.quiz_id === quizId && session.status === 'in_progress' && (userId ? session.user_id === userId : !session.user_id)) || null;
  }

  async getScheduledSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    return Array.from(this.sessions.values()).find((session) => session.quiz_id === quizId && session.status === 'scheduled' && (userId ? session.user_id === userId : !session.user_id)) || null;
  }

  async getLatestCompletedSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    return Array.from(this.sessions.values())
      .filter((session) => session.quiz_id === quizId && session.status === 'completed' && (userId ? session.user_id === userId : !session.user_id))
      .sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())[0] || null;
  }

  async listSessions(quizId: string, userId?: string): Promise<QuizSession[]> {
    return Array.from(this.sessions.values())
      .filter((session) => session.quiz_id === quizId && (userId ? session.user_id === userId : !session.user_id))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async getSessionById(sessionId: string, userId?: string): Promise<QuizSession | null> {
    const session = this.sessions.get(sessionId);
    return session && (!userId || session.user_id === userId) ? session : null;
  }

  async createSession(quizId: string, sessionType: SessionType, availableAt?: string, userId?: string): Promise<QuizSession> {
    const id = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();
    const session: QuizSession = { id, quiz_id: quizId, user_id: userId || null, session_type: sessionType, status: 'in_progress', available_at: availableAt || now, started_at: now, created_at: now };
    this.sessions.set(id, session);
    return session;
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus, completedAt?: string, userId?: string): Promise<QuizSession> {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) throw new Error('Session not found or access is restricted');
    session.status = status;
    if (completedAt) session.completed_at = completedAt;
    this.sessions.set(sessionId, session);
    return session;
  }

  async getProgressForSession(sessionId: string, userId?: string): Promise<QuestionProgress[]> {
    if (userId && !(await this.getSessionById(sessionId, userId))) throw new Error('Session not found or access is restricted');
    return Array.from(this.progress.values()).filter((progress) => progress.session_id === sessionId);
  }

  async saveQuestionProgress(progress: QuestionProgress, userId?: string): Promise<QuestionProgress> {
    if (userId && !(await this.getSessionById(progress.session_id, userId))) throw new Error('Session not found or access is restricted');
    const key = `${progress.session_id}_${progress.question_id}`;
    const id = progress.id || `prog-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const updated = { ...progress, id };
    this.progress.set(key, updated);
    return updated;
  }

  async batchSaveQuestionProgress(progressList: QuestionProgress[], userId?: string): Promise<QuestionProgress[]> {
    if (userId) {
      for (const progress of progressList) await this.saveQuestionProgress(progress, userId);
    }
    return progressList.map((progress) => {
      const key = `${progress.session_id}_${progress.question_id}`;
      const id = progress.id || `prog-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const updated = { ...progress, id };
      this.progress.set(key, updated);
      return updated;
    });
  }
}
