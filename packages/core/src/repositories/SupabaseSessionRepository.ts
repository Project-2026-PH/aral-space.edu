import { ISessionRepository } from './ISessionRepository';
import { QuizSession, QuestionProgress, SessionType, SessionStatus } from '@quiz-creator/types';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseSessionRepository implements ISessionRepository {
  constructor(private supabase: SupabaseClient) {}

  async getActiveSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    let query = this.supabase
      .from('quiz_sessions')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  async getScheduledSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    let query = this.supabase
      .from('quiz_sessions')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('status', 'scheduled')
      .order('available_at', { ascending: true })
      .limit(1);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  async getLatestCompletedSession(quizId: string, userId?: string): Promise<QuizSession | null> {
    let query = this.supabase
      .from('quiz_sessions')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  async listSessions(quizId: string, userId?: string): Promise<QuizSession[]> {
    let query = this.supabase
      .from('quiz_sessions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async createSession(quizId: string, sessionType: SessionType, availableAt?: string, userId?: string): Promise<QuizSession> {
    const { data, error } = await this.supabase
      .from('quiz_sessions')
      .insert({
        quiz_id: quizId,
        user_id: userId,
        session_type: sessionType,
        status: 'in_progress',
        available_at: availableAt || new Date().toISOString(),
        started_at: new Date().toISOString()
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus, completedAt?: string): Promise<QuizSession> {
    const { data, error } = await this.supabase
      .from('quiz_sessions')
      .update({
        status,
        ...(completedAt ? { completed_at: completedAt } : {})
      })
      .eq('id', sessionId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async getProgressForSession(sessionId: string): Promise<QuestionProgress[]> {
    const { data, error } = await this.supabase
      .from('quiz_question_progress')
      .select('*')
      .eq('session_id', sessionId);
    if (error) throw error;
    return data || [];
  }

  async saveQuestionProgress(p: QuestionProgress): Promise<QuestionProgress> {
    if (p.id) {
      const { data, error } = await this.supabase
        .from('quiz_question_progress')
        .update({
          streak_count: p.streak_count,
          has_missed: p.has_missed,
          locked: p.locked,
          locked_at: p.locked_at
        })
        .eq('id', p.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabase
        .from('quiz_question_progress')
        .upsert({
          session_id: p.session_id,
          question_id: p.question_id,
          streak_count: p.streak_count,
          has_missed: p.has_missed,
          locked: p.locked,
          locked_at: p.locked_at
        }, { onConflict: 'session_id,question_id' })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }
  }

  async batchSaveQuestionProgress(progressList: QuestionProgress[]): Promise<QuestionProgress[]> {
    if (progressList.length === 0) return [];

    const existing = progressList.filter((p) => p.id);
    const pending = progressList.filter((p) => !p.id);
    const saved: QuestionProgress[] = [];

    if (pending.length > 0) {
      const { data, error } = await this.supabase
        .from('quiz_question_progress')
        .upsert(pending.map((p) => ({
          session_id: p.session_id,
          question_id: p.question_id,
          streak_count: p.streak_count,
          has_missed: p.has_missed,
          locked: p.locked,
          locked_at: p.locked_at || null
        })), { onConflict: 'session_id,question_id' })
        .select('*');
      if (error) throw error;
      saved.push(...(data || []));
    }

    if (existing.length > 0) {
      saved.push(...await Promise.all(existing.map((p) => this.saveQuestionProgress(p))));
    }

    const byId = new Map(saved.filter((p) => p.id).map((p) => [p.id, p]));
    const byKey = new Map(saved.map((p) => [`${p.session_id}:${p.question_id}`, p]));
    return progressList
      .map((p) => p.id ? byId.get(p.id) : byKey.get(`${p.session_id}:${p.question_id}`))
      .filter((p): p is QuestionProgress => Boolean(p));
  }
}
