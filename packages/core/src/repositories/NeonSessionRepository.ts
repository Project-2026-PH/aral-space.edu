import { ISessionRepository } from './ISessionRepository';
import { QuizSession, QuestionProgress, SessionType, SessionStatus } from '@quiz-creator/types';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

export class NeonSessionRepository implements ISessionRepository {
  private sql: NeonQueryFunction<false, false>;
  constructor(clientOrUrl: string | NeonQueryFunction<false, false>) { this.sql = typeof clientOrUrl === 'string' ? neon(clientOrUrl) : clientOrUrl; }

  async getActiveSession(quizId: string, userId?: string) {
    const rows = userId
      ? await this.sql`SELECT * FROM quiz_sessions WHERE quiz_id = ${quizId} AND user_id = ${userId} AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1`
      : await this.sql`SELECT * FROM quiz_sessions WHERE quiz_id = ${quizId} AND user_id IS NULL AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1`;
    return rows[0] as QuizSession || null;
  }
  async getScheduledSession(quizId: string, userId?: string) {
    const rows = userId
      ? await this.sql`SELECT * FROM quiz_sessions WHERE quiz_id = ${quizId} AND user_id = ${userId} AND status = 'scheduled' ORDER BY available_at ASC LIMIT 1`
      : await this.sql`SELECT * FROM quiz_sessions WHERE quiz_id = ${quizId} AND user_id IS NULL AND status = 'scheduled' ORDER BY available_at ASC LIMIT 1`;
    return rows[0] as QuizSession || null;
  }
  async getLatestCompletedSession(quizId: string, userId?: string) {
    const rows = userId
      ? await this.sql`SELECT * FROM quiz_sessions WHERE quiz_id = ${quizId} AND user_id = ${userId} AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`
      : await this.sql`SELECT * FROM quiz_sessions WHERE quiz_id = ${quizId} AND user_id IS NULL AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`;
    return rows[0] as QuizSession || null;
  }
  async listSessions(quizId: string, userId?: string) {
    const rows = userId
      ? await this.sql`SELECT * FROM quiz_sessions WHERE quiz_id = ${quizId} AND user_id = ${userId} ORDER BY created_at DESC`
      : await this.sql`SELECT * FROM quiz_sessions WHERE quiz_id = ${quizId} AND user_id IS NULL ORDER BY created_at DESC`;
    return rows as QuizSession[];
  }
  async getSessionById(sessionId: string, userId?: string) {
    const rows = userId ? await this.sql`SELECT * FROM quiz_sessions WHERE id = ${sessionId} AND (user_id = ${userId} OR user_id IS NULL) LIMIT 1` : await this.sql`SELECT * FROM quiz_sessions WHERE id = ${sessionId} LIMIT 1`;
    return rows[0] as QuizSession || null;
  }
  async createSession(quizId: string, sessionType: SessionType, availableAt?: string, userId?: string) {
    const now = new Date().toISOString();
    const rows = await this.sql`INSERT INTO quiz_sessions (quiz_id, user_id, session_type, status, available_at, started_at) VALUES (${quizId}, ${userId || null}, ${sessionType}, 'in_progress', ${availableAt || now}, ${now}) RETURNING *`;
    return rows[0] as QuizSession;
  }
  async updateSessionStatus(sessionId: string, status: SessionStatus, completedAt?: string, userId?: string) {
    const rows = userId
      ? (completedAt ? await this.sql`UPDATE quiz_sessions SET status = ${status}, completed_at = ${completedAt} WHERE id = ${sessionId} AND user_id = ${userId} RETURNING *` : await this.sql`UPDATE quiz_sessions SET status = ${status} WHERE id = ${sessionId} AND user_id = ${userId} RETURNING *`)
      : (completedAt ? await this.sql`UPDATE quiz_sessions SET status = ${status}, completed_at = ${completedAt} WHERE id = ${sessionId} RETURNING *` : await this.sql`UPDATE quiz_sessions SET status = ${status} WHERE id = ${sessionId} RETURNING *`);
    if (!rows.length) throw new Error('Session not found or access is restricted');
    return rows[0] as QuizSession;
  }
  async getProgressForSession(sessionId: string, userId?: string) {
    const rows = userId ? await this.sql`SELECT p.* FROM quiz_question_progress p JOIN quiz_sessions s ON s.id = p.session_id WHERE p.session_id = ${sessionId} AND (s.user_id = ${userId} OR s.user_id IS NULL)` : await this.sql`SELECT * FROM quiz_question_progress WHERE session_id = ${sessionId}`;
    return rows as QuestionProgress[];
  }
  private async assertProgressAccess(progress: QuestionProgress, userId?: string): Promise<void> {
    if (!userId) return;
    const rows = await this.sql`SELECT 1 FROM quiz_sessions s JOIN quiz_questions q ON q.quiz_id = s.quiz_id WHERE s.id = ${progress.session_id} AND (s.user_id = ${userId} OR s.user_id IS NULL) AND q.id = ${progress.question_id} LIMIT 1`;
    if (!rows.length) throw new Error('Session or question access is restricted');
  }
  async saveQuestionProgress(progress: QuestionProgress, userId?: string) {
    await this.assertProgressAccess(progress, userId);
    if (progress.id) {
      const rows = userId ? await this.sql`UPDATE quiz_question_progress p SET streak_count = ${progress.streak_count}, has_missed = ${progress.has_missed}, locked = ${progress.locked}, locked_at = ${progress.locked_at || null} WHERE p.id = ${progress.id} AND EXISTS (SELECT 1 FROM quiz_sessions s WHERE s.id = p.session_id AND (s.user_id = ${userId} OR s.user_id IS NULL)) RETURNING p.*` : await this.sql`UPDATE quiz_question_progress SET streak_count = ${progress.streak_count}, has_missed = ${progress.has_missed}, locked = ${progress.locked}, locked_at = ${progress.locked_at || null} WHERE id = ${progress.id} RETURNING *`;
      if (!rows.length) throw new Error('Progress not found or access is restricted');
      return rows[0] as QuestionProgress;
    }
    const rows = await this.sql`INSERT INTO quiz_question_progress (session_id, question_id, streak_count, has_missed, locked, locked_at) VALUES (${progress.session_id}, ${progress.question_id}, ${progress.streak_count}, ${progress.has_missed}, ${progress.locked}, ${progress.locked_at || null}) ON CONFLICT (session_id, question_id) DO UPDATE SET streak_count = EXCLUDED.streak_count, has_missed = EXCLUDED.has_missed, locked = EXCLUDED.locked, locked_at = EXCLUDED.locked_at RETURNING *`;
    return rows[0] as QuestionProgress;
  }
  async batchSaveQuestionProgress(progressList: QuestionProgress[], userId?: string) {
    if (!progressList.length) return [];
    if (userId && progressList.some((progress) => progress.id)) {
      return Promise.all(progressList.map((progress) => this.saveQuestionProgress(progress, userId)));
    }

    const payload = JSON.stringify(progressList.map((progress) => ({
      session_id: progress.session_id,
      question_id: progress.question_id,
      streak_count: progress.streak_count,
      has_missed: progress.has_missed,
      locked: progress.locked,
      locked_at: progress.locked_at || null
    })));

    const rows = userId
      ? await this.sql`
          INSERT INTO quiz_question_progress (session_id, question_id, streak_count, has_missed, locked, locked_at)
          SELECT p.session_id, p.question_id, p.streak_count, p.has_missed, p.locked, p.locked_at
          FROM jsonb_to_recordset(${payload}::jsonb) AS p(
            session_id uuid,
            question_id uuid,
            streak_count integer,
            has_missed boolean,
            locked boolean,
            locked_at timestamptz
          )
          WHERE EXISTS (
            SELECT 1
            FROM quiz_sessions s
            JOIN quiz_questions q ON q.quiz_id = s.quiz_id
            WHERE s.id = p.session_id
              AND s.user_id = ${userId}
              AND q.id = p.question_id
          )
          ON CONFLICT (session_id, question_id) DO UPDATE
            SET streak_count = EXCLUDED.streak_count,
                has_missed = EXCLUDED.has_missed,
                locked = EXCLUDED.locked,
                locked_at = EXCLUDED.locked_at
          RETURNING *
        `
      : await this.sql`
          INSERT INTO quiz_question_progress (session_id, question_id, streak_count, has_missed, locked, locked_at)
          SELECT p.session_id, p.question_id, p.streak_count, p.has_missed, p.locked, p.locked_at
          FROM jsonb_to_recordset(${payload}::jsonb) AS p(
            session_id uuid,
            question_id uuid,
            streak_count integer,
            has_missed boolean,
            locked boolean,
            locked_at timestamptz
          )
          ON CONFLICT (session_id, question_id) DO UPDATE
            SET streak_count = EXCLUDED.streak_count,
                has_missed = EXCLUDED.has_missed,
                locked = EXCLUDED.locked,
                locked_at = EXCLUDED.locked_at
          RETURNING *
        `;

    if (userId && rows.length !== progressList.length) {
      throw new Error('Session or question access is restricted');
    }
    return rows as QuestionProgress[];
  }

  async purgeUserData(userId: string): Promise<void> {
    await this.sql`
      DELETE FROM quiz_sessions
      WHERE user_id = ${userId}
    `;
  }
}
