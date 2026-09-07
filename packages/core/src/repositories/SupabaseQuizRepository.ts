import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, UpdateSubjectShareConfigDto, PublicQuizDto, UpdateSubjectDto, SubjectAccess, SubjectCollaboratorLink, LibraryData } from '@quiz-creator/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { MemoryQuizRepository } from './MemoryQuizRepository';
import { normalizeQuestionFields } from './questionFields';
import { generateSecureToken, isShareTokenActive } from '../security/shareTokens';
import { toPublicQuizDto, toPublicSubjectDto } from '../security/publicDtos';

function generateShareToken(): string {
  return generateSecureToken(32);
}

const memoryFallback = new MemoryQuizRepository();

const productionDisabledFallback: IQuizRepository = new Proxy({} as IQuizRepository, {
  get(_target, prop) {
    return () => {
      throw new Error(
        `[Serverless Guard] Supabase query failed: In-memory fallback is disabled in production (${String(prop)}) to prevent serverless split-brain state.`
      );
    };
  },
});

export class SupabaseQuizRepository implements IQuizRepository {
  private fallback: IQuizRepository;

  constructor(private supabase: SupabaseClient, fallback?: IQuizRepository) {
    this.fallback = fallback || (process.env.NODE_ENV === 'production' ? productionDisabledFallback : memoryFallback);
  }

  private async requireSubjectAssignment(subjectId: string | null | undefined, userId?: string): Promise<void> {
    if (!subjectId) return;
    if (userId) {
      const access = await this.getSubjectAccess(subjectId, userId);
      if (!access?.can_edit) throw new Error('Subject not found or access is restricted');
      return;
    }
    const { data, error } = await this.supabase.from('subjects').select('id').eq('id', subjectId).maybeSingle();
    if (error || !data) throw error || new Error('Subject not found or access is restricted');
  }

  private async requireQuizAccess(quizId: string, userId?: string): Promise<Quiz> {
    const quiz = await this.getQuizById(quizId, userId);
    if (!quiz) throw new Error('Quiz not found or access is restricted');
    return quiz;
  }

  private async requireQuizWriteAccess(quizId: string, userId?: string): Promise<Quiz> {
    const quiz = await this.requireQuizAccess(quizId, userId);
    if (userId && quiz.user_id !== userId) throw new Error('Reviewer is read-only for this user');
    return quiz;
  }

  async listSubjects(userId?: string): Promise<Subject[]> {
    if (!userId) return [];
    try {
      let ownedQuery = this.supabase.from('subjects').select('*').order('name');
      ownedQuery = typeof ownedQuery.eq === 'function'
        ? ownedQuery.eq('user_id', userId)
        : ownedQuery.or(`user_id.eq.${userId}`);
      const { data: ownedSubjects, error: ownedError } = await ownedQuery;
      if (ownedError) throw ownedError;

      const membershipBase = this.supabase.from('subject_collaborators').select('subject_id');
      if (typeof membershipBase.eq !== 'function') return (ownedSubjects || []) as Subject[];
      const { data: memberships, error: membershipError } = await membershipBase.eq('user_id', userId);
      if (membershipError) throw membershipError;
      const memberIds = Array.from(new Set((memberships || []).map((membership: any) => membership.subject_id)));
      const { data: memberSubjects, error: memberError } = memberIds.length > 0
        ? await this.supabase.from('subjects').select('*').in('id', memberIds).order('name')
        : { data: [], error: null };
      if (memberError) throw memberError;
      const subjects = [...(ownedSubjects || []), ...(memberSubjects || [])] as Subject[];
      return subjects.map((subject) => ({
        ...subject,
        viewer_count: subject.user_id === userId ? subject.viewer_count : 0
      }));
    } catch (e) {}
    return this.fallback.listSubjects(userId);
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    try {
      const { data, error } = await this.supabase
        .from('subjects')
        .insert({
          name,
          color,
          user_id: userId,
          share_token: generateShareToken(),
          is_public: true
        })
        .select('*')
        .single();
      if (!error && data) return data;
    } catch (e) {}
    return this.fallback.createSubject(name, color, userId);
  }

  async recordSubjectView(subjectId: string, viewerId: string): Promise<void> {
    try {
      const { data: subject, error } = await this.supabase
        .from('subjects')
        .select('id, user_id, is_public, share_expires_at, share_revoked_at')
        .eq('id', subjectId)
        .maybeSingle();
      if (error || !subject || subject.user_id === viewerId) return;
      const access = await this.getSubjectAccess(subjectId, viewerId);
      const isPublic = isShareTokenActive(subject.is_public, subject.share_expires_at, subject.share_revoked_at);
      if (!access && !isPublic) return;
      await this.supabase
        .from('subject_views')
        .upsert({ subject_id: subjectId, viewer_id: viewerId, last_viewed_at: new Date().toISOString() }, { onConflict: 'subject_id,viewer_id' });
    } catch (e) {}
  }

  async getSubjectViewerCount(subjectId: string, ownerId: string): Promise<number> {
    try {
      const { data: subject } = await this.supabase
        .from('subjects')
        .select('id')
        .eq('id', subjectId)
        .eq('user_id', ownerId)
        .maybeSingle();
      if (!subject) return 0;
      const { data, error } = await this.supabase
        .from('subject_views')
        .select('viewer_id')
        .eq('subject_id', subjectId);
      if (error) throw error;
      return (data || []).length;
    } catch (e) {
      return 0;
    }
  }

  async updateSubject(subjectId: string, dto: UpdateSubjectDto, userId?: string): Promise<Subject> {
    try {
      let query = this.supabase.from('subjects').update(dto).eq('id', subjectId);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.select('*').single();
      if (!error && data) return data as Subject;
    } catch (e) {}
    return this.fallback.updateSubject(subjectId, dto, userId);
  }

  async getSubjectAccess(subjectId: string, userId?: string): Promise<SubjectAccess | null> {
    if (!userId) return null;
    try {
      const { data: owner } = await this.supabase.from('subjects').select('id').eq('id', subjectId).eq('user_id', userId).maybeSingle();
      if (owner) return { subject_id: subjectId, role: 'owner', can_edit: true, can_manage: true };
      const { data: member } = await this.supabase.from('subject_collaborators').select('subject_id').eq('subject_id', subjectId).eq('user_id', userId).maybeSingle();
      if (member) return { subject_id: subjectId, role: 'collaborator', can_edit: false, can_manage: false };
    } catch (e) {}
    return this.fallback.getSubjectAccess(subjectId, userId);
  }

  async listQuizzesBySubject(subjectId: string, userId?: string): Promise<Quiz[]> {
    if (!(await this.getSubjectAccess(subjectId, userId))) throw new Error('Subject not found or access is restricted');
    try {
      const { data, error } = await this.supabase.from('quizzes').select('*, subject:subjects(*)').eq('subject_id', subjectId).order('generated_at', { ascending: false });
      if (!error && data) return data as Quiz[];
    } catch (e) {}
    return this.fallback.listQuizzesBySubject(subjectId, userId);
  }

  async createSubjectCollaboratorLink(subjectId: string, expiresAt: string | null, userId: string, maxUses: number = 5): Promise<SubjectCollaboratorLink> {
    try {
      const access = await this.getSubjectAccess(subjectId, userId);
      if (!access?.can_manage) throw new Error('Only the subject owner can create collaborator links');
      const clampedUses = Math.min(Math.max(Number(maxUses) || 1, 1), 5);
      const token = generateShareToken() + generateShareToken();
      const { data, error } = await this.supabase.from('subject_collaborator_links').insert({ subject_id: subjectId, token, expires_at: expiresAt, max_uses: clampedUses, uses_count: 0 }).select('token, expires_at, used_at, max_uses, uses_count').single();
      if (!error && data) return data as SubjectCollaboratorLink;
    } catch (e) {}
    return this.fallback.createSubjectCollaboratorLink(subjectId, expiresAt, userId, maxUses);
  }

  async redeemSubjectCollaboratorLink(token: string, userId: string): Promise<SubjectAccess | null> {
    try {
      const { data: link } = await this.supabase.from('subject_collaborator_links').select('subject_id, expires_at, used_at').eq('token', token).maybeSingle();
      if (!link || link.used_at || (link.expires_at && new Date(link.expires_at).getTime() <= Date.now())) return null;
      const { data: consumed, error } = await this.supabase.from('subject_collaborator_links').update({ used_at: new Date().toISOString(), used_by: userId }).eq('token', token).is('used_at', null).select('subject_id').maybeSingle();
      if (error || !consumed) return null;
      await this.supabase.from('subject_collaborators').upsert({ subject_id: consumed.subject_id, user_id: userId });
      return { subject_id: consumed.subject_id, role: 'collaborator', can_edit: false, can_manage: false };
    } catch (e) {}
    return this.fallback.redeemSubjectCollaboratorLink(token, userId);
  }

  async deleteSubject(subjectId: string, userId?: string): Promise<boolean> {
    try {
      let subjectQuery = this.supabase
        .from('subjects')
        .select('id, user_id')
        .eq('id', subjectId);
      if (userId) subjectQuery = subjectQuery.eq('user_id', userId);
      const { data: subject, error: subjectError } = await subjectQuery.maybeSingle();
      if (subjectError || !subject) return false;

      const { error: quizzesError } = await this.supabase
        .from('quizzes')
        .delete()
        .eq('subject_id', subjectId);
      if (quizzesError) return false;

      const { data: deletedSubject, error: deleteError } = await this.supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)
        .select('id');
      if (!deleteError) return Boolean(deletedSubject && deletedSubject.length > 0);
    } catch (e) {}
    return false;
  }

  async getSubjectShareConfig(subjectId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }> {
    try {
      let query = this.supabase
        .from('subjects')
        .select('share_token, is_public, share_expires_at, share_revoked_at')
        .eq('id', subjectId);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`Subject ${subjectId} not found`);
      if (data.share_token) {
        return {
          share_token: data.share_token,
          is_public: data.is_public ?? true,
          share_expires_at: data.share_expires_at ?? null,
          share_revoked_at: data.share_revoked_at ?? null
        };
      }
      const share_token = generateShareToken();
      let updateQuery = this.supabase
        .from('subjects')
        .update({ share_token, is_public: true, share_revoked_at: null })
        .eq('id', subjectId);
      if (userId) updateQuery = updateQuery.eq('user_id', userId);
      const { data: updated, error: updateError } = await updateQuery
        .select('share_token, is_public, share_expires_at, share_revoked_at')
        .single();
      if (updateError || !updated) throw updateError || new Error('Subject share update failed');
      return updated as any;
    } catch (error) {
      if (userId) throw error;
    }
    return this.fallback.getSubjectShareConfig(subjectId, userId);
  }

  async updateSubjectShareConfig(subjectId: string, dto: UpdateSubjectShareConfigDto, userId?: string): Promise<{ share_token: string; is_public: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }> {
    try {
      const current = await this.getSubjectShareConfig(subjectId, userId);
      const wasRevoked = Boolean(current.share_revoked_at) || current.is_public === false;
      const updateData: Record<string, any> = {};
      if (dto.reset_token || (dto.is_public === true && wasRevoked)) updateData.share_token = generateShareToken();
      else updateData.share_token = current.share_token;
      if (dto.is_public !== undefined) updateData.is_public = dto.is_public;
      if (dto.share_expires_at !== undefined) updateData.share_expires_at = dto.share_expires_at;
      if (dto.is_public !== undefined) updateData.share_revoked_at = dto.is_public ? null : new Date().toISOString();
      let query = this.supabase.from('subjects').update(updateData).eq('id', subjectId);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.select('share_token, is_public, share_expires_at, share_revoked_at').single();
      if (error || !data) throw error || new Error('Subject share update failed');
      return data as any;
    } catch (error) {
      if (userId) throw error;
    }
    return this.fallback.updateSubjectShareConfig(subjectId, dto, userId);
  }

  async getSubjectByShareToken(shareToken: string) {
    try {
      const { data: subject, error: subjectError } = await this.supabase
        .from('subjects')
        .select('id, name, color, share_token, is_public, share_expires_at, share_revoked_at, created_at')
        .eq('share_token', shareToken)
        .maybeSingle();
      if (subjectError) throw subjectError;
      if (!subject || !isShareTokenActive(subject.is_public, subject.share_expires_at, subject.share_revoked_at)) return null;
      const { data: quizzes, error: quizzesError } = await this.supabase
        .from('quizzes')
        .select('id, title, description, question_count, generated_at, share_token, is_public, share_expires_at, share_revoked_at, created_at')
        .eq('subject_id', subject.id)
        .order('generated_at', { ascending: false });
      if (quizzesError) throw quizzesError;
      const activeQuizzes = (quizzes || []).filter((quiz: any) =>
        isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at)
      );
      return toPublicSubjectDto(subject as Subject, activeQuizzes as Quiz[]);
    } catch (error) {
      return this.fallback.getSubjectByShareToken(shareToken);
    }
  }

  async listQuizzes(userId?: string): Promise<Quiz[]> {
    try {
      let query = this.supabase
        .from('quizzes')
        .select('*, subject:subjects(*)')
        .order('generated_at', { ascending: false });
      if (userId) {
        query = typeof query.or === 'function'
          ? query.or(`user_id.eq.${userId},and(user_id.is.null,is_public.eq.true)`)
          : query.eq('user_id', userId);
      } else {
        query = typeof query.is === 'function'
          ? query.is('user_id', null).eq('is_public', true)
          : query;
      }
      const { data, error } = await query;
      if (error) throw error;
      const quizzes = (data || []) as Quiz[];
      if (!userId) return quizzes;
      const membershipBase = this.supabase.from('subject_collaborators').select('subject_id');
      if (typeof membershipBase.eq !== 'function') return quizzes;
      const { data: memberships, error: membershipError } = await membershipBase.eq('user_id', userId);
      if (membershipError) throw membershipError;
      const subjectIds = Array.from(new Set((memberships || []).map((row: any) => row.subject_id)));
      if (subjectIds.length === 0) return quizzes;
      const { data: shared, error: sharedError } = await this.supabase
        .from('quizzes')
        .select('*, subject:subjects(*)')
        .in('subject_id', subjectIds)
        .order('generated_at', { ascending: false });
      if (sharedError) throw sharedError;
      const quizIds = new Set(quizzes.map((quiz) => quiz.id));
      return [...quizzes, ...((shared || []) as Quiz[]).filter((quiz) => !quizIds.has(quiz.id))];
    } catch (e) {}
    return this.fallback.listQuizzes(userId);
  }

  async listQuizzesAndSubjects(userId?: string): Promise<LibraryData> {
    const [allQuizzes, allSubjects] = await Promise.all([
      this.listQuizzes(userId),
      this.listSubjects(userId)
    ]);
    const sharedSubjects = userId
      ? allSubjects.filter((subject) => Boolean(subject.user_id && subject.user_id !== userId))
      : [];
    const sharedSubjectIds = new Set(sharedSubjects.map((subject) => subject.id));
    const ownedSubjects = allSubjects.filter((subject) => !sharedSubjectIds.has(subject.id));
    const subjects = await Promise.all(ownedSubjects.map(async (subject) => ({
      ...subject,
      viewer_count: userId && this.getSubjectViewerCount
        ? await this.getSubjectViewerCount(subject.id, userId)
        : 0
    })));
    return {
      subjects,
      quizzes: allQuizzes.filter((quiz) => !quiz.subject_id || !sharedSubjectIds.has(quiz.subject_id)),
      sharedSubjects,
      sharedQuizzes: allQuizzes.filter((quiz) => Boolean(quiz.subject_id && sharedSubjectIds.has(quiz.subject_id)))
    };
  }

  async getQuizById(id: string, userId?: string): Promise<Quiz | null> {
    try {
      let query = this.supabase
        .from('quizzes')
        .select('*, subject:subjects(*)')
        .eq('id', id);
      if (userId) {
        query = typeof query.or === 'function'
          ? query.or(`user_id.eq.${userId},and(user_id.is.null,is_public.eq.true)`)
          : query.eq('user_id', userId);
      } else {
        query = typeof query.is === 'function'
          ? query.is('user_id', null).eq('is_public', true)
          : query;
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data) return data;
      if (userId) {
        const access = await this.supabase.from('subject_collaborators').select('subject_id').eq('user_id', userId);
        const subjectIds = (access.data || []).map((row: any) => row.subject_id);
        if (subjectIds.length > 0) {
          const { data: sharedQuiz } = await this.supabase.from('quizzes').select('*, subject:subjects(*)').eq('id', id).in('subject_id', subjectIds).maybeSingle();
          if (sharedQuiz) return sharedQuiz;
        }
      }
    } catch (e) {}
    return this.fallback.getQuizById(id, userId);
  }

  async createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz> {
    await this.requireSubjectAssignment(dto.subject_id, userId);
    const shareToken = generateShareToken();
    try {
      const { data: quizData, error: quizError } = await this.supabase
        .from('quizzes')
        .insert({
          title: dto.title,
          description: dto.description || null,
          question_count: dto.questions.length,
          handout_name: dto.handout_name,
          source_model: dto.source_model || 'manual',
          subject_id: dto.subject_id,
          share_token: shareToken,
          is_public: true,
          allow_cloning: true,
          user_id: userId
        })
        .select('*')
        .single();

      if (!quizError && quizData) {
        if (dto.questions.length > 0) {
          const rows = dto.questions.map((q, idx) => {
            const fields = normalizeQuestionFields(q);
            return {
              quiz_id: quizData.id,
              question_text: q.question_text,
              answer_text: fields.answer_text,
              question_type: fields.question_type,
              options: fields.options,
              correct_answer: fields.correct_answer,
              explanation: q.explanation,
              source_pages: q.source_pages,
              order_index: idx
            };
          });

          await this.supabase.from('quiz_questions').insert(rows);
        }

        return quizData;
      }
    } catch (e) {}

    return this.fallback.createQuiz(dto, userId);
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz> {
    if (userId) await this.requireQuizWriteAccess(id, userId);
    if (dto.subject_id !== undefined) await this.requireSubjectAssignment(dto.subject_id, userId);
    try {
      let query = this.supabase.from('quizzes').update(dto).eq('id', id);
      if (userId) {
        const existing = await this.getQuizById(id, userId);
        if (!existing) throw new Error('Quiz not found');
        if (existing.user_id !== userId) {
          const access = await this.getSubjectAccess(existing.subject_id || '', userId);
          if (!access?.can_edit) throw new Error('Quiz not found');
        } else {
          query = query.eq('user_id', userId);
        }
      }
      const { data, error } = await query.select('*').single();
      if (!error && data) return data;
    } catch (e) {}
    return this.fallback.updateQuiz(id, dto, userId);
  }

  async deleteQuiz(id: string, userId?: string): Promise<boolean> {
    try {
      let query = this.supabase.from('quizzes').delete({ count: 'exact' }).eq('id', id);
      if (userId) query = query.eq('user_id', userId);
      const { error, count } = await query;
      if (!error) return (count || 0) > 0;
    } catch (e) {}
    return this.fallback.deleteQuiz(id, userId);
  }

  async getQuestionsByQuizId(quizId: string, userId?: string): Promise<QuizQuestion[]> {
    await this.requireQuizAccess(quizId, userId);
    try {
      const { data, error } = await this.supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });
      if (!error) return (data || []) as QuizQuestion[];
      if (userId) throw error;
    } catch (error) {
      if (userId) throw error;
    }
    return this.fallback.getQuestionsByQuizId(quizId);
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto, userId?: string): Promise<QuizQuestion> {
    await this.requireQuizWriteAccess(quizId, userId);
    const fields = normalizeQuestionFields(dto);
    try {
      const { data, error } = await this.supabase
        .from('quiz_questions')
        .insert({
          quiz_id: quizId,
          question_text: dto.question_text,
          answer_text: fields.answer_text,
          question_type: fields.question_type,
          options: fields.options,
          correct_answer: fields.correct_answer,
          explanation: dto.explanation,
          correct_explanation: fields.correct_explanation,
          distractor_explanations: fields.distractor_explanations,
          discriminatory_keywords: fields.discriminatory_keywords,
          source_pages: dto.source_pages,
          order_index: dto.order_index ?? 0
        })
        .select('*')
        .single();
      if (!error && data) return data as QuizQuestion;
      if (error && userId) throw error;
    } catch (error) {
      if (userId) throw error;
    }
    return this.fallback.addQuestion(quizId, dto, userId);
  }

  async updateQuestion(quizId: string, questionId: string, dto: UpdateQuestionDto, userId?: string): Promise<QuizQuestion> {
    await this.requireQuizWriteAccess(quizId, userId);
    try {
      const { data: existing, error: existingError } = await this.supabase
        .from('quiz_questions')
        .select('*')
        .eq('id', questionId)
        .eq('quiz_id', quizId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) throw new Error('Question not found');

      const fields = normalizeQuestionFields(dto, existing as QuizQuestion);
      const updateData = {
        ...(dto.question_text !== undefined ? { question_text: dto.question_text } : {}),
        answer_text: fields.answer_text,
        question_type: fields.question_type,
        options: fields.options,
        correct_answer: fields.correct_answer,
        ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
        correct_explanation: fields.correct_explanation,
        distractor_explanations: fields.distractor_explanations,
        discriminatory_keywords: fields.discriminatory_keywords,
        ...(dto.source_pages !== undefined ? { source_pages: dto.source_pages } : {})
      };
      const { data, error } = await this.supabase
        .from('quiz_questions')
        .update(updateData)
        .eq('id', questionId)
        .eq('quiz_id', quizId)
        .select('*')
        .single();
      if (!error && data) return data as QuizQuestion;
      throw error || new Error('Question update failed');
    } catch (error) {
      if (userId) throw error;
    }
    return this.fallback.updateQuestion(quizId, questionId, dto, userId);
  }

  async deleteQuestion(quizId: string, questionId: string, userId?: string): Promise<boolean> {
    await this.requireQuizWriteAccess(quizId, userId);
    try {
      const { error, count } = await this.supabase
        .from('quiz_questions')
        .delete({ count: 'exact' })
        .eq('id', questionId)
        .eq('quiz_id', quizId);
      if (!error) return (count || 0) > 0;
      if (userId) throw error;
    } catch (error) {
      if (userId) throw error;
    }
    return this.fallback.deleteQuestion(quizId, questionId, userId);
  }

  async reorderQuestions(quizId: string, questionIds: string[], userId?: string): Promise<boolean> {
    await this.requireQuizWriteAccess(quizId, userId);
    const questions = await this.getQuestionsByQuizId(quizId, userId);
    const expectedIds = new Set(questions.map((question) => question.id));
    if (questionIds.length !== expectedIds.size || questionIds.some((id) => !expectedIds.has(id))) {
      throw new Error('Question order must contain every question in this quiz exactly once');
    }
    try {
      const updates = questionIds.map((id, index) =>
        this.supabase.from('quiz_questions').update({ order_index: index }).eq('id', id).eq('quiz_id', quizId)
      );
      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      return true;
    } catch (error) {
      if (userId) throw error;
    }
    return this.fallback.reorderQuestions(quizId, questionIds, userId);
  }

  async getShareConfig(quizId: string, userId?: string): Promise<{
    share_token: string;
    is_public: boolean;
    allow_cloning: boolean;
    allow_public_answer_key?: boolean;
    share_expires_at?: string | null;
    share_revoked_at?: string | null;
  }> {
    if (userId) await this.requireQuizWriteAccess(quizId, userId);
    try {
      const quiz = await this.getQuizById(quizId, userId);
      if (quiz && quiz.share_token) {
        return {
          share_token: quiz.share_token,
          is_public: quiz.is_public ?? true,
          allow_cloning: quiz.allow_cloning ?? true,
          allow_public_answer_key: quiz.allow_public_answer_key ?? false,
          share_expires_at: quiz.share_expires_at ?? null,
          share_revoked_at: quiz.share_revoked_at ?? null,
        };
      } else if (quiz) {
        const share_token = generateShareToken();
        try {
          await this.supabase
            .from('quizzes')
            .update({ share_token, is_public: true, allow_cloning: true })
            .eq('id', quizId);
        } catch (e) {}
        return {
          share_token,
          is_public: true,
          allow_cloning: true,
          allow_public_answer_key: false,
          share_expires_at: null,
          share_revoked_at: null,
        };
      }
    } catch (e) {}
    return this.fallback.getShareConfig(quizId, userId);
  }

  async updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string): Promise<{
    share_token: string;
    is_public: boolean;
    allow_cloning: boolean;
    allow_public_answer_key?: boolean;
    share_expires_at?: string | null;
    share_revoked_at?: string | null;
  }> {
    try {
      const current = await this.getShareConfig(quizId, userId);
      const updateData: Record<string, any> = {};
      const wasRevoked = Boolean(current.share_revoked_at) || current.is_public === false;
      if (dto.reset_token || (dto.is_public === true && wasRevoked)) {
        updateData.share_token = generateShareToken();
      }
      if (dto.is_public !== undefined) {
        updateData.is_public = dto.is_public;
        updateData.share_revoked_at = dto.is_public ? null : new Date().toISOString();
      }
      if (dto.allow_cloning !== undefined) {
        updateData.allow_cloning = dto.allow_cloning;
      }
      if (dto.allow_public_answer_key !== undefined) {
        updateData.allow_public_answer_key = dto.allow_public_answer_key;
      }
      if (dto.share_expires_at !== undefined) {
        updateData.share_expires_at = dto.share_expires_at;
      }
      if (Object.keys(updateData).length === 0) return current;
      let query = this.supabase.from('quizzes').update(updateData).eq('id', quizId);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.select('*').single();
      if (!error && data) {
        return {
          share_token: data.share_token,
          is_public: data.is_public ?? true,
          allow_cloning: data.allow_cloning ?? true,
          allow_public_answer_key: data.allow_public_answer_key ?? false,
          share_expires_at: data.share_expires_at ?? null,
          share_revoked_at: data.share_revoked_at ?? null,
        };
      }
    } catch (e) {}
    return this.fallback.updateShareConfig(quizId, dto, userId);
  }

  async getQuizByShareToken(shareToken: string): Promise<PublicQuizDto | null> {
    try {
      const { data: quiz, error } = await this.supabase
        .from('quizzes')
        .select('*, subject:subjects(*)')
        .eq('share_token', shareToken)
        .maybeSingle();
      if (error) throw error;
      if (!quiz || !isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at)) return null;
      const { data: questions, error: questionError } = await this.supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quiz.id)
        .order('order_index', { ascending: true });
      if (questionError) throw questionError;
      return toPublicQuizDto(quiz as Quiz, (questions || []) as QuizQuestion[], quiz.subject as Subject | null);
    } catch (error) {
      return this.fallback.getQuizByShareToken(shareToken);
    }
  }

  async cloneQuizByShareToken(shareToken: string, userId?: string): Promise<Quiz> {
    let source: Quiz | null = null;
    try {
      const { data, error } = await this.supabase.from('quizzes').select('*').eq('share_token', shareToken).maybeSingle();
      if (error) throw error;
      if (data && isShareTokenActive(data.is_public, data.share_expires_at, data.share_revoked_at)) source = data as Quiz;
      if (source) {
        if (!source.allow_cloning) throw new Error('Creator has disabled cloning for this study set.');
        const { data: questions, error: questionError } = await this.supabase.from('quiz_questions').select('*').eq('quiz_id', source.id).order('order_index', { ascending: true });
        if (questionError) throw questionError;
        return this.createQuiz({
          title: `${source.title} (Copy)`,
          description: source.description || null,
          subject_id: null,
          source_model: 'cloned',
          questions: ((questions || []) as QuizQuestion[]).map((question) => ({
            question_text: question.question_text,
            answer_text: question.answer_text || null,
            question_type: question.question_type || null,
            options: question.options,
            correct_answer: question.correct_answer,
            explanation: question.explanation || null,
            correct_explanation: question.correct_explanation || null,
            distractor_explanations: question.distractor_explanations || null,
            discriminatory_keywords: question.discriminatory_keywords || null,
            source_pages: question.source_pages || null
          }))
        }, userId);
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('disabled') || error.message.includes('not found'))) throw error;
    }
    throw new Error('Shared set not found or access is restricted.');
  }
}
