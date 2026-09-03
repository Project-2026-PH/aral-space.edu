import { ISessionRepository } from './ISessionRepository';
import { QuizSession, QuestionProgress, SessionType, SessionStatus } from '@quiz-creator/types';

export class MemorySessionRepository implements ISessionRepository {
  private sessions: Map<string, QuizSession> = new Map();
  private progress: Map<string, QuestionProgress> = new Map();

  async getActiveSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    for (const session of this.sessions.values()) {
      if (session.quiz_id === quizId && session.status === 'in_progress') {
        if (!userId || session.user_id === userId) {
          return session;
        }
      }
    }
    return null;
  }

  async getScheduledSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    for (const session of this.sessions.values()) {
      if (session.quiz_id === quizId && session.status === 'scheduled') {
        if (!userId || session.user_id === userId) {
          return session;
        }
      }
    }
    return null;
  }

  async getLatestCompletedSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    const completed: QuizSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.quiz_id === quizId && session.status === 'completed') {
        if (!userId || session.user_id === userId) {
          completed.push(session);
        }
      }
    }
    if (completed.length === 0) return null;
    return completed.sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())[0];
  }

  async listSessions(quizId: string, userId?: string): Promise<QuizSession[]> {
    const list: QuizSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.quiz_id === quizId) {
        if (!userId || session.user_id === userId) {
          list.push(session);
        }
      }
    }
    return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async createSession(quizId: string, sessionType: SessionType, availableAt?: string, userId?: string): Promise<QuizSession> {
    const id = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const session: QuizSession = {
      id,
      quiz_id: quizId,
      user_id: userId || null,
      session_type: sessionType,
      status: 'in_progress',
      available_at: availableAt || new Date().toISOString(),
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus, completedAt?: string): Promise<QuizSession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    session.status = status;
    if (completedAt) session.completed_at = completedAt;
    this.sessions.set(sessionId, session);
    return session;
  }

  async getProgressForSession(sessionId: string): Promise<QuestionProgress[]> {
    const list: QuestionProgress[] = [];
    for (const p of this.progress.values()) {
      if (p.session_id === sessionId) list.push(p);
    }
    return list;
  }

  async saveQuestionProgress(p: QuestionProgress): Promise<QuestionProgress> {
    const key = `${p.session_id}_${p.question_id}`;
    const id = p.id || `prog-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const updated: QuestionProgress = { ...p, id };
    this.progress.set(key, updated);
    return updated;
  }

  async batchSaveQuestionProgress(progressList: QuestionProgress[]): Promise<QuestionProgress[]> {
    const saved: QuestionProgress[] = [];
    for (const item of progressList) {
      saved.push(await this.saveQuestionProgress(item));
    }
    return saved;
  }
}
