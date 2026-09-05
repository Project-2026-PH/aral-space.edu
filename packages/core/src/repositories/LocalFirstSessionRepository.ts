import { ISessionRepository } from './ISessionRepository';
import { QuizSession, QuestionProgress, SessionType, SessionStatus } from '@quiz-creator/types';

const STORAGE_KEY_SESSIONS = 'quiz_creator_sessions_v2';
const STORAGE_KEY_PROGRESS = 'quiz_creator_progress_v2';
const LOCAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class LocalFirstSessionRepository implements ISessionRepository {
  private sessions: Map<string, QuizSession> = new Map();
  private progress: Map<string, QuestionProgress> = new Map();

  constructor() { this.hydrateFromStorage(); }
  private isBrowser(): boolean { return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'; }
  private hydrateFromStorage(): void {
    if (!this.isBrowser()) return;
    try {
      const sessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
      const progress = localStorage.getItem(STORAGE_KEY_PROGRESS);
      const now = Date.now();
      if (sessions) (JSON.parse(sessions) as QuizSession[]).forEach((session) => {
        const createdAt = new Date(session.created_at || session.started_at || 0).getTime();
        if (Number.isFinite(createdAt) && now - createdAt <= LOCAL_RETENTION_MS) this.sessions.set(session.id, session);
      });
      if (progress) (JSON.parse(progress) as QuestionProgress[]).forEach((item) => {
        if (this.sessions.has(item.session_id)) this.progress.set(`${item.session_id}_${item.question_id}`, item);
      });
    } catch (error) { console.warn('[LocalFirstSessionRepository] Failed to hydrate from storage:', error); }
  }
  private persistToStorage(): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(Array.from(this.sessions.values())));
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(Array.from(this.progress.values())));
    } catch (error) { console.warn('[LocalFirstSessionRepository] Failed to persist to storage:', error); }
  }

  async getActiveSession(quizId: string, userId?: string) { return Array.from(this.sessions.values()).find((session) => session.quiz_id === quizId && session.status === 'in_progress' && (!userId || session.user_id === userId)) || null; }
  async getScheduledSession(quizId: string, userId?: string) { return Array.from(this.sessions.values()).find((session) => session.quiz_id === quizId && session.status === 'scheduled' && (!userId || session.user_id === userId)) || null; }
  async getLatestCompletedSession(quizId: string, userId?: string) { return Array.from(this.sessions.values()).filter((session) => session.quiz_id === quizId && session.status === 'completed' && (!userId || session.user_id === userId)).sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())[0] || null; }
  async listSessions(quizId: string, userId?: string) { return Array.from(this.sessions.values()).filter((session) => session.quiz_id === quizId && (!userId || session.user_id === userId)).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()); }
  async getSessionById(sessionId: string, userId?: string) { const session = this.sessions.get(sessionId); return session && (!userId || session.user_id === userId) ? session : null; }

  async createSession(quizId: string, sessionType: SessionType, availableAt?: string, userId?: string) {
    const id = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();
    const session: QuizSession = { id, quiz_id: quizId, user_id: userId || null, session_type: sessionType, status: 'in_progress', available_at: availableAt || now, started_at: now, created_at: now };
    this.sessions.set(id, session); this.persistToStorage(); return session;
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus, completedAt?: string, userId?: string) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) throw new Error('Session not found or access is restricted');
    session.status = status; if (completedAt) session.completed_at = completedAt;
    this.sessions.set(sessionId, session); this.persistToStorage(); return session;
  }

  async getProgressForSession(sessionId: string, userId?: string) {
    if (userId && !(await this.getSessionById(sessionId, userId))) throw new Error('Session not found or access is restricted');
    return Array.from(this.progress.values()).filter((progress) => progress.session_id === sessionId);
  }

  async saveQuestionProgress(progress: QuestionProgress, userId?: string) {
    if (userId && !(await this.getSessionById(progress.session_id, userId))) throw new Error('Session not found or access is restricted');
    const id = progress.id || `prog-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const updated = { ...progress, id };
    this.progress.set(`${progress.session_id}_${progress.question_id}`, updated); this.persistToStorage(); return updated;
  }

  async batchSaveQuestionProgress(progressList: QuestionProgress[], userId?: string) {
    if (userId) for (const progress of progressList) await this.saveQuestionProgress(progress, userId);
    const saved = progressList.map((progress) => {
      const id = progress.id || `prog-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const updated = { ...progress, id };
      this.progress.set(`${progress.session_id}_${progress.question_id}`, updated);
      return updated;
    });
    this.persistToStorage(); return saved;
  }
}
