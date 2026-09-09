import { ISessionRepository } from './ISessionRepository';
import { QuizSession, QuestionProgress, SessionType, SessionStatus } from '@quiz-creator/types';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseSessionRepository implements ISessionRepository {
  constructor(private supabase: SupabaseClient) {}
  async getActiveSession(quizId: string, userId?: string) { let query = this.supabase.from('quiz_sessions').select('*').eq('quiz_id', quizId).eq('status', 'in_progress').order('created_at', { ascending: false }).limit(1); if (userId) query = query.eq('user_id', userId); else query = query.is('user_id', null); const { data, error } = await query.maybeSingle(); if (error) throw error; return data;
  }
  async getScheduledSession(quizId: string, userId?: string) { let query = this.supabase.from('quiz_sessions').select('*').eq('quiz_id', quizId).eq('status', 'scheduled').order('available_at', { ascending: true }).limit(1); if (userId) query = query.eq('user_id', userId); else query = query.is('user_id', null); const { data, error } = await query.maybeSingle(); if (error) throw error; return data;
  }
  async getLatestCompletedSession(quizId: string, userId?: string) { let query = this.supabase.from('quiz_sessions').select('*').eq('quiz_id', quizId).eq('status', 'completed').order('completed_at', { ascending: false }).limit(1); if (userId) query = query.eq('user_id', userId); else query = query.is('user_id', null); const { data, error } = await query.maybeSingle(); if (error) throw error; return data;
  }
  async listSessions(quizId: string, userId?: string) { let query = this.supabase.from('quiz_sessions').select('*').eq('quiz_id', quizId).order('created_at', { ascending: false }); if (userId) query = query.eq('user_id', userId); else query = query.is('user_id', null); const { data, error } = await query; if (error) throw error; return data || [];
  }
  async getSessionById(sessionId: string, userId?: string) { let query = this.supabase.from('quiz_sessions').select('*').eq('id', sessionId); if (userId) query = query.eq('user_id', userId); const { data, error } = await query.maybeSingle(); if (error) throw error; return data;
  }
  async createSession(quizId: string, sessionType: SessionType, availableAt?: string, userId?: string) { const { data, error } = await this.supabase.from('quiz_sessions').insert({ quiz_id: quizId, user_id: userId, session_type: sessionType, status: 'in_progress', available_at: availableAt || new Date().toISOString(), started_at: new Date().toISOString() }).select('*').single(); if (error) throw error; return data;
  }
  async updateSessionStatus(sessionId: string, status: SessionStatus, completedAt?: string, userId?: string) { let query = this.supabase.from('quiz_sessions').update({ status, ...(completedAt ? { completed_at: completedAt } : {}) }).eq('id', sessionId); if (userId) query = query.eq('user_id', userId); const { data, error } = await query.select('*').maybeSingle(); if (error || !data) throw error || new Error('Session not found or access is restricted'); return data;
  }
  async getProgressForSession(sessionId: string, userId?: string) { let query = this.supabase.from('quiz_question_progress').select('*, quiz_sessions!inner(user_id)').eq('session_id', sessionId); if (userId) query = query.eq('quiz_sessions.user_id', userId); const { data, error } = await query; if (error) throw error; return (data || []).map(({ quiz_sessions: _sessions, ...progress }) => progress) as QuestionProgress[];
  }
  private async assertProgressAccess(progress: QuestionProgress, userId?: string) { if (!userId) return; const { data: session, error } = await this.supabase.from('quiz_sessions').select('user_id, quiz_id').eq('id', progress.session_id).eq('user_id', userId).maybeSingle(); if (error || !session) throw error || new Error('Session access is restricted'); const { data: question, error: questionError } = await this.supabase.from('quiz_questions').select('id').eq('id', progress.question_id).eq('quiz_id', session.quiz_id).maybeSingle(); if (questionError || !question) throw questionError || new Error('Question access is restricted'); }
  async saveQuestionProgress(progress: QuestionProgress, userId?: string) {
    await this.assertProgressAccess(progress, userId);
    let query: any = this.supabase.from('quiz_question_progress');
    if (progress.id) {
      query = query.update({ streak_count: progress.streak_count, has_missed: progress.has_missed, locked: progress.locked, locked_at: progress.locked_at }).eq('id', progress.id);
    } else {
      query = query.upsert({ session_id: progress.session_id, question_id: progress.question_id, streak_count: progress.streak_count, has_missed: progress.has_missed, locked: progress.locked, locked_at: progress.locked_at || null }, { onConflict: 'session_id,question_id' });
    }
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
  }
  async batchSaveQuestionProgress(progressList: QuestionProgress[], userId?: string) { if (userId) return Promise.all(progressList.map((progress) => this.saveQuestionProgress(progress, userId))); if (!progressList.length) return []; const { data, error } = await this.supabase.from('quiz_question_progress').upsert(progressList.map((p) => ({ session_id: p.session_id, question_id: p.question_id, streak_count: p.streak_count, has_missed: p.has_missed, locked: p.locked, locked_at: p.locked_at || null })), { onConflict: 'session_id,question_id' }).select('*'); if (error) throw error; return data || [];
  }

  async purgeUserData(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('quiz_sessions')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  }
}
