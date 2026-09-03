import { ISessionRepository } from './ISessionRepository';
import { QuizSession, QuestionProgress, SessionType, SessionStatus } from '@quiz-creator/types';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

export class NeonSessionRepository implements ISessionRepository {
  private sql: NeonQueryFunction<false, false>;

  constructor(clientOrUrl: string | NeonQueryFunction<false, false>) {
    if (typeof clientOrUrl === 'string') {
      this.sql = neon(clientOrUrl);
    } else {
      this.sql = clientOrUrl;
    }
  }

  async getActiveSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    const rows = userId
      ? await this.sql`
          SELECT * FROM quiz_sessions
          WHERE quiz_id = ${quizId} AND user_id = ${userId} AND status = 'in_progress'
          ORDER BY created_at DESC
          LIMIT 1
        `
      : await this.sql`
          SELECT * FROM quiz_sessions
          WHERE quiz_id = ${quizId} AND status = 'in_progress'
          ORDER BY created_at DESC
          LIMIT 1
        `;

    if (!rows || rows.length === 0) return null;
    return rows[0] as QuizSession;
  }

  async getScheduledSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    const rows = userId
      ? await this.sql`
          SELECT * FROM quiz_sessions
          WHERE quiz_id = ${quizId} AND user_id = ${userId} AND status = 'scheduled'
          ORDER BY available_at ASC
          LIMIT 1
        `
      : await this.sql`
          SELECT * FROM quiz_sessions
          WHERE quiz_id = ${quizId} AND status = 'scheduled'
          ORDER BY available_at ASC
          LIMIT 1
        `;

    if (!rows || rows.length === 0) return null;
    return rows[0] as QuizSession;
  }

  async getLatestCompletedSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    const rows = userId
      ? await this.sql`
          SELECT * FROM quiz_sessions
          WHERE quiz_id = ${quizId} AND user_id = ${userId} AND status = 'completed'
          ORDER BY completed_at DESC
          LIMIT 1
        `
      : await this.sql`
          SELECT * FROM quiz_sessions
          WHERE quiz_id = ${quizId} AND status = 'completed'
          ORDER BY completed_at DESC
          LIMIT 1
        `;

    if (!rows || rows.length === 0) return null;
    return rows[0] as QuizSession;
  }

  async listSessions(quizId: string, userId?: string): Promise<QuizSession[]> {
    const rows = userId
      ? await this.sql`
          SELECT * FROM quiz_sessions
          WHERE quiz_id = ${quizId} AND user_id = ${userId}
          ORDER BY created_at DESC
        `
      : await this.sql`
          SELECT * FROM quiz_sessions
          WHERE quiz_id = ${quizId}
          ORDER BY created_at DESC
        `;

    return rows as QuizSession[];
  }

  async createSession(quizId: string, sessionType: SessionType, availableAt?: string, userId?: string): Promise<QuizSession> {
    const available = availableAt || new Date().toISOString();
    const started = new Date().toISOString();

    const rows = await this.sql`
      INSERT INTO quiz_sessions (
        quiz_id,
        user_id,
        session_type,
        status,
        available_at,
        started_at
      )
      VALUES (
        ${quizId},
        ${userId || null},
        ${sessionType},
        'in_progress',
        ${available},
        ${started}
      )
      RETURNING *
    `;

    return rows[0] as QuizSession;
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus, completedAt?: string): Promise<QuizSession> {
    const rows = completedAt
      ? await this.sql`
          UPDATE quiz_sessions
          SET status = ${status}, completed_at = ${completedAt}
          WHERE id = ${sessionId}
          RETURNING *
        `
      : await this.sql`
          UPDATE quiz_sessions
          SET status = ${status}
          WHERE id = ${sessionId}
          RETURNING *
        `;

    if (!rows || rows.length === 0) throw new Error('Session not found');
    return rows[0] as QuizSession;
  }

  async getProgressForSession(sessionId: string): Promise<QuestionProgress[]> {
    const rows = await this.sql`
      SELECT * FROM quiz_question_progress
      WHERE session_id = ${sessionId}
    `;

    return rows as QuestionProgress[];
  }

  async saveQuestionProgress(p: QuestionProgress): Promise<QuestionProgress> {
    if (p.id) {
      const rows = await this.sql`
        UPDATE quiz_question_progress
        SET 
          streak_count = ${p.streak_count},
          has_missed = ${p.has_missed},
          locked = ${p.locked},
          locked_at = ${p.locked_at || null}
        WHERE id = ${p.id}
        RETURNING *
      `;
      return rows[0] as QuestionProgress;
    }

    const rows = await this.sql`
      INSERT INTO quiz_question_progress (
        session_id,
        question_id,
        streak_count,
        has_missed,
        locked,
        locked_at
      )
      VALUES (
        ${p.session_id},
        ${p.question_id},
        ${p.streak_count},
        ${p.has_missed},
        ${p.locked},
        ${p.locked_at || null}
      )
      ON CONFLICT (session_id, question_id) 
      DO UPDATE SET
        streak_count = EXCLUDED.streak_count,
        has_missed = EXCLUDED.has_missed,
        locked = EXCLUDED.locked,
        locked_at = EXCLUDED.locked_at
      RETURNING *
    `;

    return rows[0] as QuestionProgress;
  }

  async batchSaveQuestionProgress(progressList: QuestionProgress[]): Promise<QuestionProgress[]> {
    const results: QuestionProgress[] = [];
    for (const p of progressList) {
      results.push(await this.saveQuestionProgress(p));
    }
    return results;
  }
}
