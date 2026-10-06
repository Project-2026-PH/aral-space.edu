import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, UpdateSubjectShareConfigDto, PublicQuizDto, UpdateSubjectDto, SubjectAccess, SubjectCollaboratorLink, LibraryData } from '@quiz-creator/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { MemoryQuizRepository } from './MemoryQuizRepository';
import { normalizeQuestionFields } from './questionFields';
import { generateSecureToken, isShareTokenActive } from '../security/shareTokens';
import { toPublicQuizDto, toPublicSubjectDto } from '../security/publicDtos';
import { createUniqueSlug } from '../utils/slug';

function generateShareToken(): string {
  return generateSecureToken(32);
}

function isMissingArchiveTableError(error: any): boolean {
  return error?.code === '42P01';
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

  private async getUserArchiveIds(userId?: string): Promise<{ subjectIds: Set<string>; quizIds: Set<string> }> {
    if (!userId) return { subjectIds: new Set(), quizIds: new Set() };

    try {
      const subjectArchiveQuery: any = this.supabase
        .from('user_subject_archives')
        .select('subject_id');
      const quizArchiveQuery: any = this.supabase
        .from('user_quiz_archives')
        .select('quiz_id');
      if (typeof subjectArchiveQuery.eq !== 'function' || typeof quizArchiveQuery.eq !== 'function') {
        return { subjectIds: new Set(), quizIds: new Set() };
      }

      const [subjectResult, quizResult] = await Promise.all([
        subjectArchiveQuery.eq('user_id', userId),
        quizArchiveQuery.eq('user_id', userId)
      ]);
      if (subjectResult.error) throw subjectResult.error;
      if (quizResult.error) throw quizResult.error;
      return {
        subjectIds: new Set((subjectResult.data || []).map((row: any) => String(row.subject_id))),
        quizIds: new Set((quizResult.data || []).map((row: any) => String(row.quiz_id)))
      };
    } catch (error) {
      // Keep legacy-only reads working while the relation tables are absent,
      // but do not hide permission or transient storage failures.
      if (isMissingArchiveTableError(error)) {
        return { subjectIds: new Set(), quizIds: new Set() };
      }
      throw error;
    }
  }

  private async requireSubjectAssignment(subjectId: string | null | undefined, userId?: string): Promise<void> {
    if (!subjectId) return;
    if (userId) {
      const access = await this.getSubjectAccess(subjectId, userId);
      if (!access?.can_edit_reviewers) throw new Error('Subject not found or access is restricted');
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
    if (!userId) throw new Error('Authenticated user required for quiz writes');
    const quiz = await this.requireQuizAccess(quizId, userId);
    if (quiz.user_id !== userId) {
      const access = quiz.subject_id ? await this.getSubjectAccess(quiz.subject_id, userId) : null;
      if (!access?.can_edit_reviewers) throw new Error('Reviewer is read-only for this user');
    }
    return quiz;
  }

  private async requireQuizOwnerAccess(quizId: string, userId?: string): Promise<Quiz> {
    if (!userId) throw new Error('Authenticated user required for quiz management');
    const quiz = await this.requireQuizAccess(quizId, userId);
    if (quiz.user_id !== userId) throw new Error('Only the reviewer owner can manage this reviewer');
    return quiz;
  }

  async listSubjects(userId?: string): Promise<Subject[]> {
    try {
      let subjectResult: any = await this.supabase.from('subjects').select('*').order('name');
      if (subjectResult && !('data' in subjectResult) && userId && typeof subjectResult.or === 'function') {
        subjectResult = await subjectResult.or(`user_id.eq.${userId}`);
      }
      if (!subjectResult || !('data' in subjectResult)) throw new Error('Invalid Supabase subject response');
      const { data, error } = subjectResult;
      if (error) throw error;
      const membershipBase = userId
        ? this.supabase.from('subject_collaborators').select('subject_id')
        : null;
      const { data: memberships, error: membershipError } = membershipBase && typeof membershipBase.eq === 'function'
        ? await membershipBase.eq('user_id', userId)
        : { data: [], error: null };
      if (membershipError) throw membershipError;
      const memberIds = new Set((memberships || []).map((membership: any) => membership.subject_id));
      const archiveIds = await this.getUserArchiveIds(userId);
      return ((data || []) as Subject[])
        .filter((subject) => subject.archived_at == null
          && !archiveIds.subjectIds.has(subject.id)
          && (!userId
          ? isShareTokenActive(subject.is_public, subject.share_expires_at, subject.share_revoked_at)
          : subject.user_id === userId || memberIds.has(subject.id)))
        .map((subject) => ({
          ...subject,
          viewer_count: subject.user_id === userId ? subject.viewer_count : 0
        }));
    } catch (e) {}
    return this.fallback.listSubjects(userId);
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    try {
      const { data: existing } = await this.supabase
        .from('subjects')
        .select('slug')
        .like('slug', `${name}%`);
      const used = new Set((existing || []).map((row) => row.slug));
      const slug = await createUniqueSlug(name, async (candidate) => used.has(candidate), 'subject');
      const { data, error } = await this.supabase
        .from('subjects')
        .insert({
          name,
          slug,
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
        .select('id, user_id, archived_at, is_public, share_expires_at, share_revoked_at')
        .eq('id', subjectId)
        .maybeSingle();
      if (error || !subject || subject.archived_at || subject.user_id === viewerId) return;
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
    if (!userId) throw new Error('Authenticated user required for subject writes');
    try {
      const { data, error } = await this.supabase
        .from('subjects')
        .update(dto)
        .eq('id', subjectId)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (!error && data) return data as Subject;
    } catch (e) {}
    return this.fallback.updateSubject(subjectId, dto, userId);
  }

  async getSubjectAccess(subjectId: string, userId?: string): Promise<SubjectAccess | null> {
    try {
      const { data: subject, error } = await this.supabase
        .from('subjects')
        .select('id, user_id, archived_at, is_public, share_expires_at, share_revoked_at')
        .eq('id', subjectId)
        .maybeSingle();
      if (error || !subject || subject.archived_at) return null;
      if (userId && (await this.getUserArchiveIds(userId)).subjectIds.has(subjectId)) return null;
      if (userId && subject.user_id === userId) {
        return { subject_id: subjectId, role: 'owner', can_edit: true, can_edit_reviewers: true, can_manage: true, can_archive: true };
      }
      if (userId) {
        const { data: member } = await this.supabase
          .from('subject_collaborators')
          .select('subject_id')
          .eq('subject_id', subjectId)
          .eq('user_id', userId)
          .maybeSingle();
        if (member) return { subject_id: subjectId, role: 'collaborator', can_edit: false, can_edit_reviewers: true, can_manage: false, can_archive: true };
      }
      if (isShareTokenActive(subject.is_public, subject.share_expires_at, subject.share_revoked_at)) {
        return { subject_id: subjectId, role: 'public', can_edit: false, can_edit_reviewers: false, can_manage: false, can_archive: Boolean(userId) };
      }
    } catch (e) {}
    return this.fallback.getSubjectAccess(subjectId, userId);
  }

  async listQuizzesBySubject(subjectId: string, userId?: string): Promise<Quiz[]> {
    const access = await this.getSubjectAccess(subjectId, userId);
    if (!access) throw new Error('Subject not found or access is restricted');
    try {
      const { data, error } = await this.supabase
        .from('quizzes')
        .select('*, subject:subjects(*)')
        .eq('subject_id', subjectId)
        .order('generated_at', { ascending: false });
      if (error) throw error;
      const quizzes = (data || []) as Quiz[];
      const archiveIds = await this.getUserArchiveIds(userId);
      const visibleQuizzes = access.role === 'public'
        ? quizzes.filter((quiz) => quiz.archived_at == null && quiz.subject?.archived_at == null && isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at))
        : quizzes.filter((quiz) => quiz.archived_at == null && quiz.subject?.archived_at == null);
      return visibleQuizzes.filter((quiz) =>
        !archiveIds.quizIds.has(quiz.id) && (!quiz.subject_id || !archiveIds.subjectIds.has(quiz.subject_id))
      );
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
      return { subject_id: consumed.subject_id, role: 'collaborator', can_edit: false, can_edit_reviewers: true, can_manage: false, can_archive: true };
    } catch (e) {}
    return this.fallback.redeemSubjectCollaboratorLink(token, userId);
  }

  async deleteSubject(subjectId: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for subject management');
    try {
      const { data: subject, error: subjectError } = await this.supabase
        .from('subjects')
        .select('id, user_id')
        .eq('id', subjectId)
        .eq('user_id', userId)
        .maybeSingle();
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
        .eq('user_id', userId)
        .select('id');
      if (!deleteError) return Boolean(deletedSubject && deletedSubject.length > 0);
    } catch (e) {}
    return false;
  }

  async archiveSubject(subjectId: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for subject management');

    let subjectArchiveInserted = false;
    let cascadeQuizIds: string[] = [];
    let cascadeArchivedAt: string | null = null;
    try {
      const access = await this.getSubjectAccess(subjectId, userId);
      if (!access?.can_archive) return false;

      const { data: subject, error: subjectError } = await this.supabase
        .from('subjects')
        .select('id')
        .eq('id', subjectId)
        .is('archived_at', null)
        .maybeSingle();
      if (subjectError) throw subjectError;
      if (!subject) return false;

      const { data: existingArchive, error: existingArchiveError } = await this.supabase
        .from('user_subject_archives')
        .select('subject_id')
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .maybeSingle();
      if (existingArchiveError) throw existingArchiveError;
      if (existingArchive) return false;

      const archivedAt = new Date().toISOString();
      const { error: archiveError } = await this.supabase
        .from('user_subject_archives')
        .insert({ user_id: userId, subject_id: subjectId, archived_at: archivedAt });
      if (archiveError) {
        if ((archiveError as any).code === '23505') return false;
        throw archiveError;
      }
      subjectArchiveInserted = true;
      cascadeArchivedAt = archivedAt;

      const { data: children, error: childError } = await this.supabase
        .from('quizzes')
        .select('id')
        .eq('subject_id', subjectId)
        .is('archived_at', null);
      if (childError) throw childError;

      const childIds = (children || []).map((child: any) => String(child.id));
      if (childIds.length > 0) {
        const { data: existingChildren, error: existingChildrenError } = await this.supabase
          .from('user_quiz_archives')
          .select('quiz_id')
          .eq('user_id', userId)
          .in('quiz_id', childIds);
        if (existingChildrenError) throw existingChildrenError;

        const existingChildIds = new Set((existingChildren || []).map((row: any) => String(row.quiz_id)));
        cascadeQuizIds = childIds.filter((quizId) => !existingChildIds.has(quizId));
        cascadeArchivedAt = archivedAt;
        if (cascadeQuizIds.length > 0) {
          const { error: cascadeError } = await this.supabase
            .from('user_quiz_archives')
            .insert(cascadeQuizIds.map((quizId) => ({
              user_id: userId,
              quiz_id: quizId,
              archived_at: archivedAt,
              archived_by_subject: true
            })));
          if (cascadeError) throw cascadeError;
        }
      }

      return true;
    } catch (error) {
      if (!subjectArchiveInserted) return this.fallback.archiveSubject(subjectId, userId);

      const rollbackErrors: string[] = [];
      let canRemoveSubjectArchive = true;
      if (cascadeQuizIds.length > 0 && cascadeArchivedAt) {
        try {
          const { error: childRollbackError } = await this.supabase
            .from('user_quiz_archives')
            .delete()
            .eq('user_id', userId)
            .in('quiz_id', cascadeQuizIds)
            .eq('archived_by_subject', true)
            .eq('archived_at', cascadeArchivedAt);
          if (childRollbackError) {
            canRemoveSubjectArchive = false;
            rollbackErrors.push(`reviewer rollback: ${childRollbackError.message}`);
          }
        } catch (rollbackError: any) {
          canRemoveSubjectArchive = false;
          rollbackErrors.push(`reviewer rollback: ${rollbackError?.message || String(rollbackError)}`);
        }
      }

      if (canRemoveSubjectArchive) {
        try {
          const { error: subjectRollbackError } = await this.supabase
            .from('user_subject_archives')
            .delete()
            .eq('user_id', userId)
            .eq('subject_id', subjectId)
            .eq('archived_at', cascadeArchivedAt || '');
          if (subjectRollbackError) rollbackErrors.push(`subject rollback: ${subjectRollbackError.message}`);
        } catch (rollbackError: any) {
          rollbackErrors.push(`subject rollback: ${rollbackError?.message || String(rollbackError)}`);
        }
      }

      if (rollbackErrors.length > 0) {
        throw new Error(`Subject archive failed and rollback was incomplete: ${rollbackErrors.join('; ')}`);
      }
      throw error;
    }
  }

  async restoreSubject(subjectId: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for subject management');

    let mutationStarted = false;
    try {
      const { data: subjectArchive, error: subjectArchiveError } = await this.supabase
        .from('user_subject_archives')
        .select('subject_id')
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .maybeSingle();
      if (subjectArchiveError) throw subjectArchiveError;
      if (!subjectArchive) return false;

      const { data: children, error: childError } = await this.supabase
        .from('quizzes')
        .select('id')
        .eq('subject_id', subjectId);
      if (childError) throw childError;

      const childIds = (children || []).map((child: any) => String(child.id));
      if (childIds.length > 0) {
        mutationStarted = true;
        const { error: cascadeError } = await this.supabase
          .from('user_quiz_archives')
          .delete()
          .eq('user_id', userId)
          .eq('archived_by_subject', true)
          .in('quiz_id', childIds);
        if (cascadeError) throw cascadeError;
      }

      mutationStarted = true;
      const { data, error } = await this.supabase
        .from('user_subject_archives')
        .delete()
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .select('subject_id');
      if (error) throw error;
      return Boolean(data?.length);
    } catch (error) {
      if (mutationStarted) throw error;
      return this.fallback.restoreSubject(subjectId, userId);
    }
  }

  async listArchivedSubjects(userId: string): Promise<Subject[]> {
    try {
      const [archiveResult, legacyResult] = await Promise.all([
        this.supabase
          .from('user_subject_archives')
          .select('archived_at, subject:subjects(*)')
          .eq('user_id', userId)
          .order('archived_at', { ascending: false }),
        this.supabase
          .from('subjects')
          .select('*')
          .eq('user_id', userId)
          .not('archived_at', 'is', null)
          .order('archived_at', { ascending: false })
      ]);
      if (legacyResult.error) throw legacyResult.error;
      if (archiveResult.error && !isMissingArchiveTableError(archiveResult.error)) throw archiveResult.error;

      const archivedSubjects = new Map<string, Subject>();
      if (!archiveResult.error) {
        for (const row of (archiveResult.data || []) as any[]) {
          const subject = Array.isArray(row.subject) ? row.subject[0] : row.subject;
          if (subject?.id) {
            archivedSubjects.set(String(subject.id), {
              ...subject,
              archived_at: row.archived_at
            } as Subject);
          }
        }
      }
      for (const subject of (legacyResult.data || []) as Subject[]) {
        if (!archivedSubjects.has(subject.id)) archivedSubjects.set(subject.id, subject);
      }

      return Array.from(archivedSubjects.values()).sort((a, b) =>
        new Date(String(b.archived_at || 0)).getTime() - new Date(String(a.archived_at || 0)).getTime()
      );
    } catch (error) {
      return this.fallback.listArchivedSubjects(userId);
    }
  }

  async getSubjectShareConfig(subjectId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }> {
    if (!userId) throw new Error('Authenticated user required for subject sharing');
    try {
      const { data, error } = await this.supabase
        .from('subjects')
        .select('share_token, is_public, share_expires_at, share_revoked_at')
        .eq('id', subjectId)
        .eq('user_id', userId)
        .maybeSingle();
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
      const { data: updated, error: updateError } = await this.supabase
        .from('subjects')
        .update({ share_token, is_public: true, share_revoked_at: null })
        .eq('id', subjectId)
        .eq('user_id', userId)
        .select('share_token, is_public, share_expires_at, share_revoked_at')
        .single();
      if (updateError || !updated) throw updateError || new Error('Subject share update failed');
      return updated as any;
    } catch (error) {
      throw error;
    }
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
        .select('id, name, color, archived_at, share_token, is_public, share_expires_at, share_revoked_at, created_at')
        .eq('share_token', shareToken)
        .maybeSingle();
      if (subjectError) throw subjectError;
      if (!subject || subject.archived_at || !isShareTokenActive(subject.is_public, subject.share_expires_at, subject.share_revoked_at)) return null;
      const { data: quizzes, error: quizzesError } = await this.supabase
        .from('quizzes')
        .select('id, title, description, question_count, generated_at, archived_at, share_token, is_public, share_expires_at, share_revoked_at, created_at')
        .eq('subject_id', subject.id)
        .order('generated_at', { ascending: false });
      if (quizzesError) throw quizzesError;
      const activeQuizzes = (quizzes || []).filter((quiz: any) =>
        isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at)
        && quiz.archived_at == null
      );
      return toPublicSubjectDto(subject as Subject, activeQuizzes as Quiz[]);
    } catch (error) {
      return this.fallback.getSubjectByShareToken(shareToken);
    }
  }

  async listQuizzes(userId?: string): Promise<Quiz[]> {
    try {
      let quizResult: any = await this.supabase
        .from('quizzes')
        .select('*, subject:subjects(*)')
        .order('generated_at', { ascending: false });
      if (quizResult && !('data' in quizResult) && userId) {
        if (typeof quizResult.or === 'function') {
          quizResult = await quizResult.or(`user_id.eq.${userId}`);
        } else if (typeof quizResult.eq === 'function') {
          quizResult = await quizResult.eq('user_id', userId);
        }
      }
      if (!quizResult || !('data' in quizResult)) throw new Error('Invalid Supabase quiz response');
      const { data, error } = quizResult;
      if (error) throw error;
      const membershipBase = userId
        ? this.supabase.from('subject_collaborators').select('subject_id')
        : null;
      const { data: memberships, error: membershipError } = membershipBase && typeof membershipBase.eq === 'function'
        ? await membershipBase.eq('user_id', userId)
        : { data: [], error: null };
      if (membershipError) throw membershipError;
      const subjectIds = new Set((memberships || []).map((row: any) => row.subject_id));
      const archiveIds = await this.getUserArchiveIds(userId);
      const quizzes = ((data || []) as Quiz[]).filter((quiz) =>
        quiz.archived_at == null
        && (!quiz.subject || quiz.subject.archived_at == null)
        && !archiveIds.quizIds.has(quiz.id)
        && (!quiz.subject_id || !archiveIds.subjectIds.has(quiz.subject_id))
        && (!userId
          ? isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at)
          : quiz.user_id === userId
            || quiz.subject?.user_id === userId
            || (quiz.subject_id ? subjectIds.has(quiz.subject_id) : false))
      );
      return quizzes.map((quiz) => {
        const subject = quiz.subject;
        const subjectIsVisible = !subject
          || subject.archived_at == null && (!userId
          || subject.user_id === userId
          || subjectIds.has(subject.id));
        return subjectIsVisible ? quiz : { ...quiz, subject: null };
      });
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
      : allSubjects;
    const sharedSubjectIds = new Set(sharedSubjects.map((subject) => subject.id));
    const subjects = await Promise.all(
      allSubjects
        .filter((subject) => !sharedSubjectIds.has(subject.id))
        .map(async (subject) => ({
          ...subject,
          viewer_count: userId && this.getSubjectViewerCount
            ? await this.getSubjectViewerCount(subject.id, userId)
            : subject.viewer_count || 0
        }))
    );
    const sharedQuizzes = allQuizzes.filter((quiz) => {
      if (quiz.subject_id) return sharedSubjectIds.has(quiz.subject_id);
      return !userId || quiz.user_id !== userId;
    });
    return {
      subjects,
      quizzes: allQuizzes.filter((quiz) => !sharedQuizzes.includes(quiz)),
      sharedSubjects,
      sharedQuizzes
    };
  }

  async getQuizById(id: string, userId?: string): Promise<Quiz | null> {
    try {
      const { data, error } = await this.supabase
        .from('quizzes')
        .select('*, subject:subjects(*)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const quiz = data as Quiz;
      if (quiz.archived_at || quiz.subject?.archived_at) return null;
      if (userId) {
        const archiveIds = await this.getUserArchiveIds(userId);
        if (archiveIds.quizIds.has(quiz.id) || (quiz.subject_id && archiveIds.subjectIds.has(quiz.subject_id))) return null;
      }
      let subjectIds = new Set<string>();
      if (userId) {
        const { data: memberships, error: membershipError } = await this.supabase
          .from('subject_collaborators')
          .select('subject_id')
          .eq('user_id', userId);
        if (membershipError) throw membershipError;
        subjectIds = new Set((memberships || []).map((row: any) => row.subject_id));
      }

      const hasAccess = !userId
        ? isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at)
        : quiz.user_id === userId
          || (quiz.subject_id ? subjectIds.has(quiz.subject_id) : false)
          || isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at);
      if (!hasAccess) return null;

      const subject = quiz.subject;
      const subjectIsVisible = !subject
        || !userId
        || subject.user_id === userId
        || subjectIds.has(subject.id)
        || isShareTokenActive(subject.is_public, subject.share_expires_at, subject.share_revoked_at);
      return subjectIsVisible ? quiz : { ...quiz, subject: null };
    } catch (e) {}
    return this.fallback.getQuizById(id, userId);
  }

  async createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz> {
    await this.requireSubjectAssignment(dto.subject_id, userId);
    const shareToken = generateShareToken();
    try {
      const { data: existing } = await this.supabase.from('quizzes').select('slug');
      const used = new Set((existing || []).map((row) => row.slug));
      const slug = await createUniqueSlug(dto.title, async (candidate) => used.has(candidate), 'quiz');
      const { data: quizData, error: quizError } = await this.supabase
        .from('quizzes')
        .insert({
          title: dto.title,
          slug,
          description: dto.description || null,
          term: dto.term || null,
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
              answer_terms: fields.answer_terms,
              enumeration_distractors: fields.enumeration_distractors,
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
    const existing = await this.requireQuizWriteAccess(id, userId);
    if (dto.subject_id !== undefined) {
      if (existing.user_id !== userId) {
        throw new Error('Only the reviewer owner can change subject assignment');
      }
      await this.requireSubjectAssignment(dto.subject_id, userId);
    }
    try {
      const { data, error } = await this.supabase
        .from('quizzes')
        .update(dto)
        .eq('id', id)
        .select('*')
        .single();
      if (!error && data) return data;
    } catch (e) {}
    return this.fallback.updateQuiz(id, dto, userId);
  }

  async deleteQuiz(id: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for quiz management');
    try {
      const { error, count } = await this.supabase
        .from('quizzes')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', userId);
      if (!error) return (count || 0) > 0;
    } catch (e) {}
    return this.fallback.deleteQuiz(id, userId);
  }

  async archiveQuiz(id: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for quiz management');
    try {
      const { data: quiz, error: quizError } = await this.supabase
        .from('quizzes')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .is('archived_at', null)
        .maybeSingle();
      if (quizError) throw quizError;
      if (!quiz) return false;

      const { data: existingArchive, error: existingArchiveError } = await this.supabase
        .from('user_quiz_archives')
        .select('quiz_id')
        .eq('user_id', userId)
        .eq('quiz_id', id)
        .maybeSingle();
      if (existingArchiveError) throw existingArchiveError;
      if (existingArchive) return false;

      const { error: archiveError } = await this.supabase
        .from('user_quiz_archives')
        .insert({
          user_id: userId,
          quiz_id: id,
          archived_at: new Date().toISOString(),
          archived_by_subject: false
        });
      if (archiveError) {
        if ((archiveError as any).code === '23505') return false;
        throw archiveError;
      }
      return true;
    } catch (error) {
      return this.fallback.archiveQuiz(id, userId);
    }
  }

  async restoreQuiz(id: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for quiz management');
    try {
      const { data, error } = await this.supabase
        .from('user_quiz_archives')
        .delete()
        .eq('quiz_id', id)
        .eq('user_id', userId)
        .eq('archived_by_subject', false)
        .select('quiz_id');
      if (error) throw error;
      return Boolean(data?.length);
    } catch (error) {
      return this.fallback.restoreQuiz(id, userId);
    }
  }

  async listArchivedQuizzes(userId: string): Promise<Quiz[]> {
    try {
      const [archiveResult, legacyResult] = await Promise.all([
        this.supabase
          .from('user_quiz_archives')
          .select('archived_at, archived_by_subject, quiz:quizzes(*, subject:subjects(*))')
          .eq('user_id', userId)
          .order('archived_at', { ascending: false }),
        this.supabase
          .from('quizzes')
          .select('*, subject:subjects(*)')
          .eq('user_id', userId)
          .not('archived_at', 'is', null)
          .order('archived_at', { ascending: false })
      ]);
      if (legacyResult.error) throw legacyResult.error;
      if (archiveResult.error && !isMissingArchiveTableError(archiveResult.error)) throw archiveResult.error;

      const archivedQuizzes = new Map<string, Quiz>();
      if (!archiveResult.error) {
        for (const row of (archiveResult.data || []) as any[]) {
          const quiz = Array.isArray(row.quiz) ? row.quiz[0] : row.quiz;
          if (quiz?.id) {
            archivedQuizzes.set(String(quiz.id), {
              ...quiz,
              archived_at: row.archived_at,
              archived_by_subject: row.archived_by_subject
            } as Quiz);
          }
        }
      }
      for (const quiz of (legacyResult.data || []) as Quiz[]) {
        if (!archivedQuizzes.has(quiz.id)) archivedQuizzes.set(quiz.id, quiz);
      }

      return Array.from(archivedQuizzes.values()).sort((a, b) =>
        new Date(String(b.archived_at || 0)).getTime() - new Date(String(a.archived_at || 0)).getTime()
      );
    } catch (error) {
      return this.fallback.listArchivedQuizzes(userId);
    }
  }

  async purgeUserData(userId: string): Promise<void> {
    const { data: ownedSubjects, error: subjectReadError } = await this.supabase
      .from('subjects')
      .select('id')
      .eq('user_id', userId);
    if (subjectReadError) throw subjectReadError;

    const subjectIds = (ownedSubjects || []).map((subject) => subject.id);

    const { error: subjectArchiveDeleteError } = await this.supabase
      .from('user_subject_archives')
      .delete()
      .eq('user_id', userId);
    if (subjectArchiveDeleteError) throw subjectArchiveDeleteError;

    const { error: quizArchiveDeleteError } = await this.supabase
      .from('user_quiz_archives')
      .delete()
      .eq('user_id', userId);
    if (quizArchiveDeleteError) throw quizArchiveDeleteError;

    if (subjectIds.length > 0) {
      const { error } = await this.supabase
        .from('quizzes')
        .delete()
        .in('subject_id', subjectIds)
        .is('user_id', null);
      if (error) throw error;
    }

    const { error: quizDeleteError } = await this.supabase
      .from('quizzes')
      .delete()
      .eq('user_id', userId);
    if (quizDeleteError) throw quizDeleteError;

    const { error: subjectDeleteError } = await this.supabase
      .from('subjects')
      .delete()
      .eq('user_id', userId);
    if (subjectDeleteError) throw subjectDeleteError;

    const { error: collaboratorDeleteError } = await this.supabase
      .from('subject_collaborators')
      .delete()
      .eq('user_id', userId);
    if (collaboratorDeleteError) throw collaboratorDeleteError;

    const { error: viewDeleteError } = await this.supabase
      .from('subject_views')
      .delete()
      .eq('viewer_id', userId);
    if (viewDeleteError) throw viewDeleteError;

    // A redeemed guest identity can also be recorded on another owner's link.
    // Remove only this identity from those rows; links belonging to deleted
    // subjects were already removed by the subject delete cascade.
    const { data: usedLinks, error: usedLinkReadError } = await this.supabase
      .from('subject_collaborator_links')
      .select('id, used_by, redeemed_by')
      .eq('used_by', userId);
    if (usedLinkReadError) throw usedLinkReadError;

    const { data: redeemedLinks, error: redeemedLinkReadError } = await this.supabase
      .from('subject_collaborator_links')
      .select('id, used_by, redeemed_by')
      .contains('redeemed_by', [userId]);
    if (redeemedLinkReadError) throw redeemedLinkReadError;

    const linksById = new Map<string, { id: string; used_by: string | null; redeemed_by: string[] | null }>();
    for (const link of [...(usedLinks || []), ...(redeemedLinks || [])] as any[]) {
      linksById.set(String(link.id), {
        id: String(link.id),
        used_by: link.used_by ?? null,
        redeemed_by: Array.isArray(link.redeemed_by) ? link.redeemed_by : [],
      });
    }

    for (const link of linksById.values()) {
      const { error } = await this.supabase
        .from('subject_collaborator_links')
        .update({
          used_by: link.used_by === userId ? null : link.used_by,
          redeemed_by: (link.redeemed_by || []).filter((redeemedBy) => redeemedBy !== userId),
        })
        .eq('id', link.id);
      if (error) throw error;
    }
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
          answer_terms: fields.answer_terms,
          enumeration_distractors: fields.enumeration_distractors,
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
        answer_terms: fields.answer_terms,
        enumeration_distractors: fields.enumeration_distractors,
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
    if (!userId) throw new Error('Authenticated user required for quiz sharing');
    await this.requireQuizOwnerAccess(quizId, userId);
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
      if (!quiz || quiz.archived_at || (quiz.subject as any)?.archived_at || !isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at)) return null;
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
      const { data, error } = await this.supabase.from('quizzes').select('*, subject:subjects(*)').eq('share_token', shareToken).maybeSingle();
      if (error) throw error;
      if (data && data.archived_at == null && (!(data as any).subject || (data as any).subject.archived_at == null) && isShareTokenActive(data.is_public, data.share_expires_at, data.share_revoked_at)) source = data as Quiz;
      if (source) {
        if (!source.allow_cloning) throw new Error('Creator has disabled cloning for this study set.');
        const { data: questions, error: questionError } = await this.supabase.from('quiz_questions').select('*').eq('quiz_id', source.id).order('order_index', { ascending: true });
        if (questionError) throw questionError;
        return this.createQuiz({
          title: `${source.title} (Copy)`,
          description: source.description || null,
          term: source.term || null,
          subject_id: null,
          source_model: 'cloned',
          questions: ((questions || []) as QuizQuestion[]).map((question) => ({
            question_text: question.question_text,
            answer_text: question.answer_text || null,
            answer_terms: question.answer_terms || null,
            enumeration_distractors: question.enumeration_distractors || null,
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
