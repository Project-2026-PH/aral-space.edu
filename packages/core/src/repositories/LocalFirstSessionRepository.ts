import { ISessionRepository } from './ISessionRepository';
import { QuizSession, QuestionProgress, SessionType, SessionStatus } from '@quiz-creator/types';

const STORAGE_KEY_SESSIONS = 'quiz_creator_sessions_v1';
const STORAGE_KEY_PROGRESS = 'quiz_creator_progress_v1';

export class LocalFirstSessionRepository implements ISessionRepository {
  private sessions: Map<string, QuizSession> = new Map();
  private progress: Map<string, QuestionProgress> = new Map();

  constructor() {
    this.hydrateFromStorage();
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private hydrateFromStorage(): void {
    if (!this.isBrowser()) return;

    try {
      const storedSessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (storedSessions) {
        const parsed: QuizSession[] = JSON.parse(storedSessions);
        parsed.forEach(s => this.sessions.set(s.id, s));
      }

      const storedProgress = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (storedProgress) {
        const parsed: QuestionProgress[] = JSON.parse(storedProgress);
        parsed.forEach(p => {
          const key = `${p.session_id}_${p.question_id}`;
          this.progress.set(key, p);
        });
      }
    } catch (e) {
      console.warn('[LocalFirstSessionRepository] Failed to hydrate from storage:', e);
    }
  }

  private persistToStorage(): void {
    if (!this.isBrowser()) return;

    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(Array.from(this.sessions.values())));
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(Array.from(this.progress.values())));
    } catch (e) {
      console.warn('[LocalFirstSessionRepository] Failed to persist to storage:', e);
    }
  }

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
    this.persistToStorage();
    return session;
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus, completedAt?: string): Promise<QuizSession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    session.status = status;
    if (completedAt) session.completed_at = completedAt;
    this.sessions.set(sessionId, session);
    this.persistToStorage();
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
    this.persistToStorage();
    return updated;
  }

  async batchSaveQuestionProgress(progressList: QuestionProgress[]): Promise<QuestionProgress[]> {
    const saved = progressList.map((p) => {
      const key = `${p.session_id}_${p.question_id}`;
      const id = p.id || `prog-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const updated: QuestionProgress = { ...p, id };
      this.progress.set(key, updated);
      return updated;
    });
    this.persistToStorage();
    return saved;
  }
}
