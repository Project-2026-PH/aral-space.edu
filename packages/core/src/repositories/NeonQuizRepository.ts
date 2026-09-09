import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, UpdateSubjectShareConfigDto, PublicQuizDto, UpdateSubjectDto, SubjectAccess, SubjectCollaboratorLink, LibraryData } from '@quiz-creator/types';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { normalizeQuestionFields } from './questionFields';
import { generateSecureToken, isShareTokenActive } from '../security/shareTokens';
import { toPublicQuizDto, toPublicSubjectDto } from '../security/publicDtos';

function generateShareToken(): string {
  return generateSecureToken(32);
}

export class NeonQuizRepository implements IQuizRepository {
  private sql: NeonQueryFunction<false, false>;

  constructor(clientOrUrl: string | NeonQueryFunction<false, false>) {
    if (typeof clientOrUrl === 'string') {
      this.sql = neon(clientOrUrl);
    } else {
      this.sql = clientOrUrl;
    }
  }

  private async getUserArchiveIds(userId?: string): Promise<{ subjectIds: Set<string>; quizIds: Set<string> }> {
    if (!userId) return { subjectIds: new Set(), quizIds: new Set() };

    try {
      const [subjectRows, quizRows] = await Promise.all([
        this.sql`SELECT subject_id FROM user_subject_archives WHERE user_id = ${userId}`,
        this.sql`SELECT quiz_id FROM user_quiz_archives WHERE user_id = ${userId}`
      ]);
      return {
        subjectIds: new Set(subjectRows.map((row: any) => String(row.subject_id))),
        quizIds: new Set(quizRows.map((row: any) => String(row.quiz_id)))
      };
    } catch (error: any) {
      // Keep legacy-only reads working while the relation tables are absent,
      // but do not hide permission or transient storage failures.
      if (error?.code === '42P01') {
        return { subjectIds: new Set(), quizIds: new Set() };
      }
      throw error;
    }
  }

  private async requireSubjectAssignment(subjectId: string | null | undefined, userId?: string): Promise<void> {
    if (!subjectId) return;
    if (!userId) {
      const rows = await this.sql`SELECT 1 FROM subjects WHERE id = ${subjectId} AND archived_at IS NULL LIMIT 1`;
      if (!rows.length) throw new Error('Subject not found or access is restricted');
      return;
    }
    const access = await this.getSubjectAccess(subjectId, userId);
    if (!access?.can_edit_reviewers) throw new Error('Subject not found or access is restricted');
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
    const rows = userId
      ? await this.sql`
          SELECT s.*,
            CASE WHEN s.user_id = ${userId}
              THEN COALESCE((SELECT COUNT(*)::int FROM subject_views sv WHERE sv.subject_id = s.id), 0)
              ELSE 0
            END AS viewer_count
          FROM subjects s
          WHERE s.archived_at IS NULL
            AND (
               s.user_id = ${userId}
             OR (
               COALESCE(s.is_public, TRUE) = TRUE
               AND s.share_revoked_at IS NULL
               AND (s.share_expires_at IS NULL OR s.share_expires_at > now())
             )
             OR EXISTS (
               SELECT 1 FROM subject_collaborators sc
               WHERE sc.subject_id = s.id AND sc.user_id = ${userId}
             )
          )
          ORDER BY s.name ASC, s.id ASC
        `
      : await this.sql`
          SELECT s.*
          FROM subjects s
          WHERE s.archived_at IS NULL
            AND COALESCE(s.is_public, TRUE) = TRUE
            AND s.share_revoked_at IS NULL
            AND (s.share_expires_at IS NULL OR s.share_expires_at > now())
          ORDER BY s.name ASC, s.id ASC
        `;
    const archiveIds = await this.getUserArchiveIds(userId);
    return (rows as Subject[]).filter((subject) => !archiveIds.subjectIds.has(subject.id));
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    const rows = await this.sql`
      INSERT INTO subjects (name, color, user_id, share_token, is_public)
      VALUES (${name}, ${color}, ${userId || null}, ${generateShareToken()}, true)
      RETURNING *
    `;
    return rows[0] as Subject;
  }

  async recordSubjectView(subjectId: string, viewerId: string): Promise<void> {
    await this.sql`
      INSERT INTO subject_views (subject_id, viewer_id)
      SELECT s.id, ${viewerId}
      FROM subjects s
      WHERE s.id = ${subjectId}
        AND s.archived_at IS NULL
        AND s.user_id IS DISTINCT FROM ${viewerId}
        AND (
          (COALESCE(s.is_public, TRUE) = TRUE AND s.share_revoked_at IS NULL AND (s.share_expires_at IS NULL OR s.share_expires_at > now()))
          OR EXISTS (SELECT 1 FROM subject_collaborators sc WHERE sc.subject_id = s.id AND sc.user_id = ${viewerId})
        )
      ON CONFLICT (subject_id, viewer_id)
      DO UPDATE SET last_viewed_at = now()
    `;
  }

  async getSubjectViewerCount(subjectId: string, ownerId: string): Promise<number> {
    const rows = await this.sql`
      SELECT COUNT(*)::int AS viewer_count
      FROM subject_views sv
      JOIN subjects s ON s.id = sv.subject_id
      WHERE sv.subject_id = ${subjectId} AND s.user_id = ${ownerId}
    `;
    return Number((rows[0] as any)?.viewer_count || 0);
  }

  async updateSubject(subjectId: string, dto: UpdateSubjectDto, userId?: string): Promise<Subject> {
    const access = await this.getSubjectAccess(subjectId, userId);
    if (!access?.can_edit) throw new Error('Subject not found or access is restricted');
    const rows = dto.name !== undefined && dto.color !== undefined
      ? await this.sql`
          UPDATE subjects SET name = ${dto.name}, color = ${dto.color}
          WHERE id = ${subjectId} AND user_id = ${userId || null}
          RETURNING *
        `
      : dto.name !== undefined
        ? await this.sql`
            UPDATE subjects SET name = ${dto.name}
            WHERE id = ${subjectId} AND user_id = ${userId || null}
            RETURNING *
          `
        : await this.sql`
            UPDATE subjects SET color = ${dto.color || '#86EFAC'}
            WHERE id = ${subjectId} AND user_id = ${userId || null}
            RETURNING *
          `;
    if (!rows || rows.length === 0) throw new Error('Subject not found or update failed');
    return rows[0] as Subject;
  }

  async getSubjectAccess(subjectId: string, userId?: string): Promise<SubjectAccess | null> {
    const rows = userId
      ? await this.sql`
          SELECT s.id, s.user_id,
            COALESCE(s.is_public, TRUE) = TRUE
              AND s.share_revoked_at IS NULL
              AND (s.share_expires_at IS NULL OR s.share_expires_at > now()) AS is_public,
            EXISTS (SELECT 1 FROM subject_collaborators sc WHERE sc.subject_id = s.id AND sc.user_id = ${userId}) AS is_collaborator
          FROM subjects s
          WHERE s.id = ${subjectId}
            AND s.archived_at IS NULL
            AND (
              s.user_id = ${userId}
              OR EXISTS (SELECT 1 FROM subject_collaborators sc WHERE sc.subject_id = s.id AND sc.user_id = ${userId})
              OR (
                COALESCE(s.is_public, TRUE) = TRUE
                AND s.share_revoked_at IS NULL
                AND (s.share_expires_at IS NULL OR s.share_expires_at > now())
              )
            )
          LIMIT 1
        `
      : await this.sql`
          SELECT s.id, s.user_id,
            COALESCE(s.is_public, TRUE) = TRUE
              AND s.share_revoked_at IS NULL
              AND (s.share_expires_at IS NULL OR s.share_expires_at > now()) AS is_public,
            FALSE AS is_collaborator
          FROM subjects s
          WHERE s.id = ${subjectId}
            AND s.archived_at IS NULL
            AND COALESCE(s.is_public, TRUE) = TRUE
            AND s.share_revoked_at IS NULL
            AND (s.share_expires_at IS NULL OR s.share_expires_at > now())
          LIMIT 1
        `;
    if (userId && (await this.getUserArchiveIds(userId)).subjectIds.has(subjectId)) return null;
    if (!rows || rows.length === 0) return null;
    const row = rows[0] as any;
    if (userId && row.user_id === userId) {
      return { subject_id: subjectId, role: 'owner', can_edit: true, can_edit_reviewers: true, can_manage: true, can_archive: true };
    }
    if (userId && row.is_collaborator) {
      return { subject_id: subjectId, role: 'collaborator', can_edit: false, can_edit_reviewers: true, can_manage: false, can_archive: true };
    }
    if (row.is_public) {
      return { subject_id: subjectId, role: 'public', can_edit: false, can_edit_reviewers: false, can_manage: false, can_archive: Boolean(userId) };
    }
    return null;
  }

  async listQuizzesBySubject(subjectId: string, userId?: string): Promise<Quiz[]> {
    const access = await this.getSubjectAccess(subjectId, userId);
    if (!access) throw new Error('Subject not found or access is restricted');
    const rows = access.role === 'public'
      ? await this.sql`
          SELECT q.*, json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id) AS subject
          FROM quizzes q
          JOIN subjects s ON s.id = q.subject_id
          WHERE q.subject_id = ${subjectId}
            AND q.archived_at IS NULL
            AND COALESCE(q.is_public, TRUE) = TRUE
            AND q.share_revoked_at IS NULL
            AND (q.share_expires_at IS NULL OR q.share_expires_at > now())
          ORDER BY q.generated_at DESC, q.id ASC
        `
      : await this.sql`
          SELECT q.*, json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id) AS subject
          FROM quizzes q
          JOIN subjects s ON s.id = q.subject_id
          WHERE q.subject_id = ${subjectId}
            AND q.archived_at IS NULL
          ORDER BY q.generated_at DESC, q.id ASC
        `;
    const archiveIds = await this.getUserArchiveIds(userId);
    return (rows as Quiz[]).filter((quiz) => (
      !archiveIds.quizIds.has(quiz.id)
      && (!quiz.subject_id || !archiveIds.subjectIds.has(quiz.subject_id))
    ));
  }

  async createSubjectCollaboratorLink(subjectId: string, expiresAt: string | null, userId: string, maxUses: number = 5): Promise<SubjectCollaboratorLink> {
    const access = await this.getSubjectAccess(subjectId, userId);
    if (!access?.can_manage) throw new Error('Only the subject owner can create collaborator links');
    const clampedUses = Math.min(Math.max(Number(maxUses) || 1, 1), 5);
    const token = generateShareToken() + generateShareToken();
    try {
      const rows = await this.sql`
        INSERT INTO subject_collaborator_links (subject_id, token, expires_at, max_uses, uses_count, redeemed_by)
        VALUES (${subjectId}, ${token}, ${expiresAt}, ${clampedUses}, 0, '{}')
        RETURNING token, expires_at, used_at, max_uses, uses_count, redeemed_by
      `;
      return rows[0] as SubjectCollaboratorLink;
    } catch {
      const rows = await this.sql`
        INSERT INTO subject_collaborator_links (subject_id, token, expires_at)
        VALUES (${subjectId}, ${token}, ${expiresAt})
        RETURNING token, expires_at, used_at
      `;
      return { ...(rows[0] as any), max_uses: clampedUses, uses_count: 0, redeemed_by: [] };
    }
  }

  async redeemSubjectCollaboratorLink(token: string, userId: string): Promise<SubjectAccess | null> {
    try {
      const existing = await this.sql`
        SELECT id, subject_id, expires_at, used_at, COALESCE(max_uses, 1) AS max_uses, COALESCE(uses_count, 0) AS uses_count, COALESCE(redeemed_by, '{}') AS redeemed_by
        FROM subject_collaborator_links
        WHERE token = ${token}
        LIMIT 1
      `;
      if (!existing || existing.length === 0) return null;
      const link = existing[0] as any;
      if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return null;

      const redeemedBy: string[] = Array.isArray(link.redeemed_by) ? link.redeemed_by : [];
      // Same user/device: keep current usage count, ensure access
      if (redeemedBy.includes(userId)) {
        await this.sql`
          INSERT INTO subject_collaborators (subject_id, user_id)
          VALUES (${link.subject_id}, ${userId})
          ON CONFLICT (subject_id, user_id) DO NOTHING
        `;
        return { subject_id: link.subject_id, role: 'collaborator', can_edit: false, can_edit_reviewers: true, can_manage: false, can_archive: true };
      }

      const maxUses = Number(link.max_uses) || 1;
      const usesCount = Number(link.uses_count) || 0;
      if (usesCount >= maxUses || link.used_at) return null;

      const rows = await this.sql`
        UPDATE subject_collaborator_links
        SET uses_count = COALESCE(uses_count, 0) + 1,
            redeemed_by = array_append(COALESCE(redeemed_by, '{}'), ${userId}),
            used_by = ${userId},
            used_at = CASE WHEN COALESCE(uses_count, 0) + 1 >= COALESCE(max_uses, 1) THEN now() ELSE used_at END
        WHERE token = ${token}
          AND COALESCE(uses_count, 0) < COALESCE(max_uses, 1)
          AND used_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        RETURNING subject_id
      `;
      if (!rows || rows.length === 0) return null;
      const subjectId = rows[0].subject_id as string;
      await this.sql`
        INSERT INTO subject_collaborators (subject_id, user_id)
        VALUES (${subjectId}, ${userId})
        ON CONFLICT (subject_id, user_id) DO NOTHING
      `;
      return { subject_id: subjectId, role: 'collaborator', can_edit: false, can_edit_reviewers: true, can_manage: false, can_archive: true };
    } catch {
      const rows = await this.sql`
        UPDATE subject_collaborator_links
        SET used_at = now(), used_by = ${userId}
        WHERE token = ${token}
          AND used_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        RETURNING subject_id
      `;
      if (!rows || rows.length === 0) return null;
      const subjectId = rows[0].subject_id as string;
      await this.sql`
        INSERT INTO subject_collaborators (subject_id, user_id)
        VALUES (${subjectId}, ${userId})
        ON CONFLICT (subject_id, user_id) DO NOTHING
      `;
      return { subject_id: subjectId, role: 'collaborator', can_edit: false, can_edit_reviewers: true, can_manage: false, can_archive: true };
    }
  }

  async deleteSubject(subjectId: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for subject management');
    const rows = await this.sql`
      WITH target_subject AS (
        SELECT id FROM subjects WHERE id = ${subjectId} AND user_id = ${userId}
      ), deleted_quizzes AS (
        DELETE FROM quizzes
        WHERE subject_id IN (SELECT id FROM target_subject)
        RETURNING id
      )
      DELETE FROM subjects
      WHERE id IN (SELECT id FROM target_subject)
      RETURNING id
    `;

    return Boolean(rows && rows.length > 0);
  }

  async archiveSubject(subjectId: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for subject management');
    const rows = await this.sql`
      WITH target_subject AS (
        SELECT s.id
        FROM subjects s
        WHERE s.id = ${subjectId}
          AND s.archived_at IS NULL
          AND (
            s.user_id = ${userId}
            OR EXISTS (
              SELECT 1
              FROM subject_collaborators sc
              WHERE sc.subject_id = s.id AND sc.user_id = ${userId}
            )
            OR (
              COALESCE(s.is_public, TRUE) = TRUE
              AND s.share_revoked_at IS NULL
              AND (s.share_expires_at IS NULL OR s.share_expires_at > now())
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM user_subject_archives usa
            WHERE usa.subject_id = s.id AND usa.user_id = ${userId}
          )
      ), archived_subject AS (
        INSERT INTO user_subject_archives (user_id, subject_id, archived_at)
        SELECT ${userId}, id, now()
        FROM target_subject
        ON CONFLICT (user_id, subject_id)
        DO UPDATE SET archived_at = EXCLUDED.archived_at
        RETURNING subject_id
      ), archived_quizzes AS (
        INSERT INTO user_quiz_archives (user_id, quiz_id, archived_at, archived_by_subject)
        SELECT ${userId}, q.id, now(), TRUE
        FROM quizzes q
        JOIN archived_subject s ON s.subject_id = q.subject_id
        WHERE q.archived_at IS NULL
        ON CONFLICT (user_id, quiz_id) DO NOTHING
        RETURNING quiz_id
      )
      SELECT subject_id AS id FROM archived_subject
    `;
    return Boolean(rows && rows.length > 0);
  }

  async restoreSubject(subjectId: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for subject management');
    const rows = await this.sql`
      WITH restored_subject AS (
        DELETE FROM user_subject_archives
        WHERE subject_id = ${subjectId} AND user_id = ${userId}
        RETURNING subject_id
      ), restored_quizzes AS (
        DELETE FROM user_quiz_archives uqa
        USING restored_subject rs, quizzes q
        WHERE uqa.user_id = ${userId}
          AND uqa.quiz_id = q.id
          AND q.subject_id = rs.subject_id
          AND uqa.archived_by_subject = TRUE
        RETURNING uqa.quiz_id
      )
      SELECT subject_id AS id FROM restored_subject
    `;
    return Boolean(rows && rows.length > 0);
  }

  async listArchivedSubjects(userId: string): Promise<Subject[]> {
    const rows = await this.sql`
      SELECT *
      FROM (
        SELECT s.*, usa.archived_at AS viewer_archived_at
        FROM user_subject_archives usa
        JOIN subjects s ON s.id = usa.subject_id
        WHERE usa.user_id = ${userId}
        UNION ALL
        SELECT s.*, NULL::timestamptz AS viewer_archived_at
        FROM subjects s
        WHERE s.user_id = ${userId}
          AND s.archived_at IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM user_subject_archives usa
            WHERE usa.subject_id = s.id AND usa.user_id = ${userId}
          )
      ) archived
      ORDER BY COALESCE(viewer_archived_at, archived_at) DESC, name ASC, id ASC
    `;
    return (rows as any[]).map((row) => ({
      ...row,
      archived_at: row.viewer_archived_at || row.archived_at
    })) as Subject[];
  }

  async getSubjectShareConfig(subjectId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }> {
    if (!userId) throw new Error('Authenticated user required for subject sharing');
    const rows = await this.sql`
      SELECT share_token, is_public, share_expires_at, share_revoked_at
      FROM subjects
      WHERE id = ${subjectId}
        AND user_id = ${userId}
      LIMIT 1
    `;
    const subject = rows[0] as any;
    if (!subject.share_token) {
      const share_token = generateShareToken();
      const updatedRows = await this.sql`
        UPDATE subjects SET share_token = ${share_token}, is_public = true, share_revoked_at = NULL
        WHERE id = ${subjectId}
          AND user_id = ${userId}
        RETURNING share_token, is_public, share_expires_at, share_revoked_at
      `;
      if (!updatedRows.length) throw new Error('Subject not found or update failed');
      return updatedRows[0] as any;
    }
    return {
      share_token: subject.share_token,
      is_public: subject.is_public ?? true,
      share_expires_at: subject.share_expires_at ?? null,
      share_revoked_at: subject.share_revoked_at ?? null
    };
  }

  async updateSubjectShareConfig(subjectId: string, dto: UpdateSubjectShareConfigDto, userId?: string): Promise<{ share_token: string; is_public: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }> {
    const current = await this.getSubjectShareConfig(subjectId, userId);
    const wasRevoked = Boolean(current.share_revoked_at) || current.is_public === false;
    const newShareToken = dto.reset_token || !current.share_token || (dto.is_public === true && wasRevoked)
      ? generateShareToken()
      : current.share_token;
    const isPublic = dto.is_public !== undefined ? dto.is_public : current.is_public;
    const shareExpiresAt = dto.share_expires_at !== undefined ? dto.share_expires_at : current.share_expires_at;
    const shareRevokedAt = isPublic ? null : new Date().toISOString();
    const rows = await this.sql`
      UPDATE subjects
      SET share_token = ${newShareToken}, is_public = ${isPublic}, share_expires_at = ${shareExpiresAt}, share_revoked_at = ${shareRevokedAt}
      WHERE id = ${subjectId}
        AND user_id = ${userId}
        AND archived_at IS NULL
      RETURNING share_token, is_public, share_expires_at, share_revoked_at
    `;
    if (!rows.length) throw new Error('Subject not found or update failed');
    return rows[0] as any;
  }

  async getSubjectByShareToken(shareToken: string) {
    const rows = await this.sql`
      SELECT s.id, s.name, s.color, s.share_token, s.is_public, s.share_expires_at, s.share_revoked_at, s.created_at,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', q.id, 'title', q.title, 'description', q.description,
            'question_count', COALESCE(q.question_count, 0), 'generated_at', q.generated_at,
            'share_token', q.share_token, 'is_public', COALESCE(q.is_public, TRUE),
            'created_at', q.created_at
          ) ORDER BY q.generated_at DESC)
          FROM quizzes q
          WHERE q.subject_id = s.id
            AND q.archived_at IS NULL
            AND COALESCE(q.is_public, TRUE) = TRUE
            AND q.share_revoked_at IS NULL
            AND (q.share_expires_at IS NULL OR q.share_expires_at > now())
        ), '[]'::json) AS quizzes
      FROM subjects s
      WHERE s.share_token = ${shareToken}
        AND s.archived_at IS NULL
        AND COALESCE(s.is_public, TRUE) = TRUE
        AND s.share_revoked_at IS NULL
        AND (s.share_expires_at IS NULL OR s.share_expires_at > now())
      LIMIT 1
    `;
    if (!rows.length) return null;
    const row = rows[0] as any;
    return toPublicSubjectDto(row as Subject, (Array.isArray(row.quizzes) ? row.quizzes : []) as Quiz[]);
  }

  async listQuizzes(userId?: string): Promise<Quiz[]> {
    const rows = userId
      ? await this.sql`
          SELECT
            q.*,
            CASE
              WHEN s.id IS NOT NULL AND (
                s.user_id = ${userId}
                OR (
                  COALESCE(s.is_public, TRUE) = TRUE
                  AND s.share_revoked_at IS NULL
                  AND (s.share_expires_at IS NULL OR s.share_expires_at > now())
                )
                OR EXISTS (SELECT 1 FROM subject_collaborators sc WHERE sc.subject_id = s.id AND sc.user_id = ${userId})
              ) THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id)
              ELSE NULL
            END AS subject
          FROM quizzes q
          LEFT JOIN subjects s ON q.subject_id = s.id
          WHERE q.archived_at IS NULL
            AND (q.subject_id IS NULL OR s.archived_at IS NULL)
            AND (
              q.user_id = ${userId}
              OR (
                COALESCE(q.is_public, TRUE) = TRUE
                AND q.share_revoked_at IS NULL
                AND (q.share_expires_at IS NULL OR q.share_expires_at > now())
              )
              OR EXISTS (
                SELECT 1 FROM subject_collaborators sc
                WHERE sc.subject_id = q.subject_id AND sc.user_id = ${userId}
              )
            )
          ORDER BY q.generated_at DESC, q.id ASC
        `
      : await this.sql`
          SELECT
            q.*,
            CASE
              WHEN s.id IS NOT NULL THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id)
              ELSE NULL
            END AS subject
          FROM quizzes q
          LEFT JOIN subjects s ON q.subject_id = s.id
          WHERE q.archived_at IS NULL
            AND (q.subject_id IS NULL OR s.archived_at IS NULL)
            AND COALESCE(q.is_public, TRUE) = TRUE
            AND q.share_revoked_at IS NULL
            AND (q.share_expires_at IS NULL OR q.share_expires_at > now())
          ORDER BY q.generated_at DESC, q.id ASC
        `;
    const archiveIds = await this.getUserArchiveIds(userId);
    return (rows as Quiz[]).filter((quiz) => (
      !archiveIds.quizIds.has(quiz.id)
      && (!quiz.subject_id || !archiveIds.subjectIds.has(quiz.subject_id))
    ));
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
    const sharedQuizzes = allQuizzes.filter((quiz) => {
      if (quiz.subject_id) return sharedSubjectIds.has(quiz.subject_id);
      return !userId || quiz.user_id !== userId;
    });
    return {
      subjects: allSubjects.filter((subject) => !sharedSubjectIds.has(subject.id)),
      quizzes: allQuizzes.filter((quiz) => !sharedQuizzes.includes(quiz)),
      sharedSubjects,
      sharedQuizzes
    };
  }

  async getQuizById(id: string, userId?: string): Promise<Quiz | null> {
    const rows = userId
      ? await this.sql`
          SELECT
            q.*,
            CASE
              WHEN s.id IS NOT NULL AND (
                s.user_id = ${userId}
                OR (
                  COALESCE(s.is_public, TRUE) = TRUE
                  AND s.share_revoked_at IS NULL
                  AND (s.share_expires_at IS NULL OR s.share_expires_at > now())
                )
                OR EXISTS (SELECT 1 FROM subject_collaborators sc WHERE sc.subject_id = s.id AND sc.user_id = ${userId})
              ) THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id)
              ELSE NULL
            END AS subject
          FROM quizzes q
          LEFT JOIN subjects s ON q.subject_id = s.id
          WHERE q.id = ${id}
            AND q.archived_at IS NULL
            AND (q.subject_id IS NULL OR s.archived_at IS NULL)
            AND (
              q.user_id = ${userId}
              OR (
                COALESCE(q.is_public, TRUE) = TRUE
                AND q.share_revoked_at IS NULL
                AND (q.share_expires_at IS NULL OR q.share_expires_at > now())
              )
              OR EXISTS (SELECT 1 FROM subject_collaborators sc WHERE sc.subject_id = q.subject_id AND sc.user_id = ${userId})
            )
          LIMIT 1
        `
      : await this.sql`
          SELECT
            q.*,
            CASE
              WHEN s.id IS NOT NULL THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id)
              ELSE NULL
            END AS subject
          FROM quizzes q
          LEFT JOIN subjects s ON q.subject_id = s.id
          WHERE q.id = ${id}
            AND q.archived_at IS NULL
            AND (q.subject_id IS NULL OR s.archived_at IS NULL)
            AND COALESCE(q.is_public, TRUE) = TRUE
            AND q.share_revoked_at IS NULL
            AND (q.share_expires_at IS NULL OR q.share_expires_at > now())
          LIMIT 1
        `;

    if (!rows || rows.length === 0) return null;
    const quiz = rows[0] as Quiz;
    if (userId) {
      const archiveIds = await this.getUserArchiveIds(userId);
      if (archiveIds.quizIds.has(quiz.id) || (quiz.subject_id && archiveIds.subjectIds.has(quiz.subject_id))) {
        return null;
      }
    }
    return quiz;
  }

  async createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz> {
    await this.requireSubjectAssignment(dto.subject_id, userId);
    const questionPayload = JSON.stringify(dto.questions.map((question, order_index) => {
      const fields = normalizeQuestionFields(question);
      return {
        question_text: question.question_text,
        answer_text: fields.answer_text,
        question_type: fields.question_type,
        options: fields.options,
        correct_answer: fields.correct_answer,
        explanation: question.explanation || null,
        correct_explanation: fields.correct_explanation || null,
        distractor_explanations: fields.distractor_explanations,
        discriminatory_keywords: fields.discriminatory_keywords,
        source_pages: question.source_pages || null,
        order_index
      };
    }));

    const rows = await this.sql`
      WITH created_quiz AS (
        INSERT INTO quizzes (
          title,
          description,
          term,
          question_count,
          handout_name,
          source_model,
          subject_id,
          share_token,
          is_public,
          allow_cloning,
          user_id
        )
        VALUES (
          ${dto.title},
          ${dto.description || null},
          ${dto.term || null},
          ${dto.questions.length},
          ${dto.handout_name || null},
          ${dto.source_model || 'manual'},
          ${dto.subject_id || null},
          ${generateShareToken()},
          true,
          true,
          ${userId || null}
        )
        RETURNING *
      ),
      created_questions AS (
        INSERT INTO quiz_questions (
          quiz_id,
          question_text,
          answer_text,
          question_type,
          options,
          correct_answer,
          explanation,
          correct_explanation,
          distractor_explanations,
          discriminatory_keywords,
          source_pages,
          order_index
        )
        SELECT
          created_quiz.id,
          question.question_text,
          question.answer_text,
          question.question_type,
          question.options,
          question.correct_answer,
          question.explanation,
          question.correct_explanation,
          question.distractor_explanations,
          question.discriminatory_keywords,
          question.source_pages,
          question.order_index
        FROM created_quiz
        CROSS JOIN LATERAL jsonb_to_recordset(${questionPayload}::jsonb) AS question(
          question_text text,
          answer_text text,
          question_type text,
          options jsonb,
          correct_answer integer,
          explanation text,
          correct_explanation text,
          distractor_explanations jsonb,
          discriminatory_keywords jsonb,
          source_pages jsonb,
          order_index integer
        )
        RETURNING quiz_id
      )
      SELECT created_quiz.*
      FROM created_quiz
      LEFT JOIN (SELECT DISTINCT quiz_id FROM created_questions) inserted_questions
        ON inserted_questions.quiz_id = created_quiz.id
    `;

    return rows[0] as Quiz;
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz> {
    const existing = await this.requireQuizWriteAccess(id, userId);
    if (dto.subject_id !== undefined) {
      if (userId && existing.user_id !== userId) {
        throw new Error('Only the reviewer owner can change subject assignment');
      }
      await this.requireSubjectAssignment(dto.subject_id, userId);
    }

    const rows = userId
      ? await this.sql`
          UPDATE quizzes
          SET title = ${dto.title !== undefined ? dto.title : existing.title},
              description = ${dto.description !== undefined ? dto.description : existing.description || null},
              term = ${dto.term !== undefined ? dto.term : existing.term || null},
              subject_id = ${dto.subject_id !== undefined ? dto.subject_id : existing.subject_id || null}
          WHERE id = ${id}
          RETURNING *
        `
      : await this.sql`
          UPDATE quizzes
          SET title = ${dto.title !== undefined ? dto.title : existing.title},
              description = ${dto.description !== undefined ? dto.description : existing.description || null},
              term = ${dto.term !== undefined ? dto.term : existing.term || null},
              subject_id = ${dto.subject_id !== undefined ? dto.subject_id : existing.subject_id || null}
          WHERE id = ${id}
          RETURNING *
        `;

    if (!rows || rows.length === 0) throw new Error('Quiz not found or update failed');
    return rows[0] as Quiz;
  }

  async deleteQuiz(id: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for quiz management');
    const rows = await this.sql`
      DELETE FROM quizzes
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `;
    return Boolean(rows && rows.length > 0);
  }

  async archiveQuiz(id: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for quiz management');
    const rows = await this.sql`
      INSERT INTO user_quiz_archives (user_id, quiz_id, archived_at, archived_by_subject)
      SELECT ${userId}, id, now(), FALSE
      FROM quizzes
      WHERE id = ${id}
        AND user_id = ${userId}
        AND archived_at IS NULL
      ON CONFLICT (user_id, quiz_id) DO NOTHING
      RETURNING quiz_id AS id
    `;
    return Boolean(rows && rows.length > 0);
  }

  async restoreQuiz(id: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for quiz management');
    const rows = await this.sql`
      DELETE FROM user_quiz_archives
      WHERE quiz_id = ${id}
        AND user_id = ${userId}
        AND archived_by_subject = FALSE
      RETURNING quiz_id AS id
    `;
    return Boolean(rows && rows.length > 0);
  }

  async listArchivedQuizzes(userId: string): Promise<Quiz[]> {
    const rows = await this.sql`
      SELECT *
      FROM (
        SELECT q.*,
          CASE WHEN s.id IS NOT NULL
            THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id, 'archived_at', s.archived_at)
            ELSE NULL
          END AS subject,
          uqa.archived_at AS viewer_archived_at,
          uqa.archived_by_subject AS viewer_archived_by_subject
        FROM user_quiz_archives uqa
        JOIN quizzes q ON q.id = uqa.quiz_id
        LEFT JOIN subjects s ON s.id = q.subject_id
        WHERE uqa.user_id = ${userId}
        UNION ALL
        SELECT q.*,
          CASE WHEN s.id IS NOT NULL
            THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id, 'archived_at', s.archived_at)
            ELSE NULL
          END AS subject,
          NULL::timestamptz AS viewer_archived_at,
          NULL::boolean AS viewer_archived_by_subject
        FROM quizzes q
        LEFT JOIN subjects s ON s.id = q.subject_id
        WHERE q.user_id = ${userId}
          AND q.archived_at IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM user_quiz_archives uqa
            WHERE uqa.quiz_id = q.id AND uqa.user_id = ${userId}
          )
      ) archived
      ORDER BY COALESCE(viewer_archived_at, archived_at) DESC, generated_at DESC, id ASC
    `;
    return (rows as any[]).map((row) => ({
      ...row,
      archived_at: row.viewer_archived_at || row.archived_at,
      archived_by_subject: row.viewer_archived_by_subject ?? row.archived_by_subject
    })) as Quiz[];
  }

  async purgeUserData(userId: string): Promise<void> {
    await this.sql`
      WITH owned_subjects AS (
        SELECT id
        FROM subjects
        WHERE user_id = ${userId}
      ),
      owned_quizzes AS (
        SELECT id
        FROM quizzes
        WHERE user_id = ${userId}
           OR (user_id IS NULL AND subject_id IN (SELECT id FROM owned_subjects))
      ),
      deleted_quizzes AS (
        DELETE FROM quizzes
        WHERE id IN (SELECT id FROM owned_quizzes)
        RETURNING id
      )
      DELETE FROM subjects
      WHERE id IN (SELECT id FROM owned_subjects)
    `;

    await this.sql`
      DELETE FROM user_subject_archives
      WHERE user_id = ${userId}
    `;
    await this.sql`
      DELETE FROM user_quiz_archives
      WHERE user_id = ${userId}
    `;

    await this.sql`
      DELETE FROM subject_collaborators
      WHERE user_id = ${userId}
    `;
    await this.sql`
      DELETE FROM subject_views
      WHERE viewer_id = ${userId}
    `;
    await this.sql`
      UPDATE subject_collaborator_links
      SET redeemed_by = array_remove(redeemed_by, ${userId}),
          used_by = CASE WHEN used_by = ${userId} THEN NULL ELSE used_by END
      WHERE used_by = ${userId}
         OR ${userId} = ANY(redeemed_by)
    `;
  }

  async getQuestionsByQuizId(quizId: string, userId?: string): Promise<QuizQuestion[]> {
    await this.requireQuizAccess(quizId, userId);
    const rows = await this.sql`
      SELECT * FROM quiz_questions
      WHERE quiz_id = ${quizId}
      ORDER BY order_index ASC
    `;
    return rows as QuizQuestion[];
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto, userId?: string): Promise<QuizQuestion> {
    await this.requireQuizWriteAccess(quizId, userId);
    const fields = normalizeQuestionFields(dto);
    const optionsJson = JSON.stringify(fields.options);
    const sourcePagesJson = dto.source_pages ? JSON.stringify(dto.source_pages) : null;
    const distractorExpJson = fields.distractor_explanations ? JSON.stringify(fields.distractor_explanations) : null;
    const discriminatoryKwJson = fields.discriminatory_keywords ? JSON.stringify(fields.discriminatory_keywords) : null;

    const rows = await this.sql`
      INSERT INTO quiz_questions (
        quiz_id, question_text, answer_text, question_type, options, correct_answer,
        explanation, correct_explanation, distractor_explanations, discriminatory_keywords,
        source_pages, order_index
      )
      VALUES (
        ${quizId}, ${dto.question_text}, ${fields.answer_text}, ${fields.question_type},
        ${optionsJson}::jsonb, ${fields.correct_answer}, ${dto.explanation || null},
        ${fields.correct_explanation || null},
        ${distractorExpJson ? this.sql`${distractorExpJson}::jsonb` : null},
        ${discriminatoryKwJson ? this.sql`${discriminatoryKwJson}::jsonb` : null},
        ${sourcePagesJson ? this.sql`${sourcePagesJson}::jsonb` : null}, ${dto.order_index ?? 0}
      )
      RETURNING *
    `;

    await this.sql`UPDATE quizzes SET question_count = question_count + 1 WHERE id = ${quizId}`;
    return rows[0] as QuizQuestion;
  }

  async updateQuestion(quizId: string, questionId: string, dto: UpdateQuestionDto, userId?: string): Promise<QuizQuestion> {
    await this.requireQuizWriteAccess(quizId, userId);
    const existingRows = await this.sql`SELECT * FROM quiz_questions WHERE id = ${questionId} AND quiz_id = ${quizId} LIMIT 1`;
    if (!existingRows.length) throw new Error('Question not found');
    const curr = existingRows[0] as QuizQuestion;
    const fields = normalizeQuestionFields(dto, curr);
    const optionsJson = JSON.stringify(fields.options);
    const questionText = dto.question_text !== undefined ? dto.question_text : curr.question_text;
    const explanation = dto.explanation !== undefined ? dto.explanation : curr.explanation;
    const sourcePagesJson = dto.source_pages !== undefined
      ? (dto.source_pages ? JSON.stringify(dto.source_pages) : null)
      : (curr.source_pages ? JSON.stringify(curr.source_pages) : null);
    const distractorExpJson = fields.distractor_explanations !== null ? JSON.stringify(fields.distractor_explanations) : null;
    const discriminatoryKwJson = fields.discriminatory_keywords !== null ? JSON.stringify(fields.discriminatory_keywords) : null;

    const rows = await this.sql`
      UPDATE quiz_questions
      SET question_text = ${questionText}, answer_text = ${fields.answer_text}, question_type = ${fields.question_type},
          options = ${optionsJson}::jsonb, correct_answer = ${fields.correct_answer}, explanation = ${explanation},
          correct_explanation = ${fields.correct_explanation || null},
          distractor_explanations = ${distractorExpJson ? this.sql`${distractorExpJson}::jsonb` : null},
          discriminatory_keywords = ${discriminatoryKwJson ? this.sql`${discriminatoryKwJson}::jsonb` : null},
          source_pages = ${sourcePagesJson ? this.sql`${sourcePagesJson}::jsonb` : null}
      WHERE id = ${questionId} AND quiz_id = ${quizId}
      RETURNING *
    `;
    if (!rows.length) throw new Error('Question not found');
    return rows[0] as QuizQuestion;
  }

  async deleteQuestion(quizId: string, questionId: string, userId?: string): Promise<boolean> {
    await this.requireQuizWriteAccess(quizId, userId);
    const rows = await this.sql`
      DELETE FROM quiz_questions WHERE id = ${questionId} AND quiz_id = ${quizId} RETURNING quiz_id
    `;
    if (rows.length > 0) {
      await this.sql`UPDATE quizzes SET question_count = GREATEST(question_count - 1, 0) WHERE id = ${quizId}`;
    }
    return rows.length > 0;
  }

  async reorderQuestions(quizId: string, questionIds: string[], userId?: string): Promise<boolean> {
    await this.requireQuizWriteAccess(quizId, userId);
    const rows = await this.sql`SELECT id FROM quiz_questions WHERE quiz_id = ${quizId}`;
    const expectedIds = new Set(rows.map((row: any) => row.id as string));
    if (questionIds.length !== expectedIds.size || questionIds.some((id) => !expectedIds.has(id))) {
      throw new Error('Question order must contain every question in this quiz exactly once');
    }
    for (let index = 0; index < questionIds.length; index++) {
      await this.sql`UPDATE quiz_questions SET order_index = ${index} WHERE id = ${questionIds[index]} AND quiz_id = ${quizId}`;
    }
    return true;
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
    const rows = await this.sql`
      SELECT share_token, is_public, allow_cloning, allow_public_answer_key, share_expires_at, share_revoked_at
      FROM quizzes
      WHERE id = ${quizId} AND user_id = ${userId} AND archived_at IS NULL
      LIMIT 1
    `;
    if (!rows || rows.length === 0) throw new Error(`Quiz ${quizId} not found`);
    const quiz = rows[0] as any;

    if (quiz.share_token) {
      return {
        share_token: quiz.share_token,
        is_public: quiz.is_public ?? true,
        allow_cloning: quiz.allow_cloning ?? true,
        allow_public_answer_key: quiz.allow_public_answer_key ?? false,
        share_expires_at: quiz.share_expires_at ?? null,
        share_revoked_at: quiz.share_revoked_at ?? null,
      };
    }

    const share_token = generateShareToken();
    await this.sql`
      UPDATE quizzes
      SET share_token = ${share_token}, is_public = true, allow_cloning = true
      WHERE id = ${quizId} AND user_id = ${userId}
    `;

    return {
      share_token,
      is_public: true,
      allow_cloning: true,
      allow_public_answer_key: false,
      share_expires_at: null,
      share_revoked_at: null,
    };
  }

  async updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string): Promise<{
    share_token: string;
    is_public: boolean;
    allow_cloning: boolean;
    allow_public_answer_key?: boolean;
    share_expires_at?: string | null;
    share_revoked_at?: string | null;
  }> {
    const current = await this.getShareConfig(quizId, userId);
    const newShareToken = dto.reset_token ? generateShareToken() : current.share_token;
    const isPublic = dto.is_public !== undefined ? dto.is_public : current.is_public;
    const allowCloning = dto.allow_cloning !== undefined ? dto.allow_cloning : current.allow_cloning;
    const allowAnswerKey = dto.allow_public_answer_key !== undefined ? dto.allow_public_answer_key : (current.allow_public_answer_key ?? false);
    const shareExpiresAt = dto.share_expires_at !== undefined ? dto.share_expires_at : current.share_expires_at;
    let shareRevokedAt = current.share_revoked_at;
    if (dto.is_public === false && isPublic === false) {
      shareRevokedAt = new Date().toISOString();
    } else if (dto.is_public === true) {
      shareRevokedAt = null;
    }

    const rows = await this.sql`
      UPDATE quizzes
      SET share_token = ${newShareToken}, is_public = ${isPublic}, allow_cloning = ${allowCloning},
          allow_public_answer_key = ${allowAnswerKey}, share_expires_at = ${shareExpiresAt}, share_revoked_at = ${shareRevokedAt}
      WHERE id = ${quizId} AND user_id = ${userId}
      RETURNING share_token, is_public, allow_cloning, allow_public_answer_key, share_expires_at, share_revoked_at
    `;

    if (!rows || rows.length === 0) throw new Error('Quiz not found or update failed');
    return {
      share_token: rows[0].share_token,
      is_public: rows[0].is_public ?? true,
      allow_cloning: rows[0].allow_cloning ?? true,
      allow_public_answer_key: rows[0].allow_public_answer_key ?? false,
      share_expires_at: rows[0].share_expires_at ?? null,
      share_revoked_at: rows[0].share_revoked_at ?? null,
    };
  }

  async getQuizByShareToken(shareToken: string): Promise<PublicQuizDto | null> {
    const rows = await this.sql`
      SELECT q.*, CASE WHEN s.id IS NOT NULL
        THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color)
        ELSE NULL END AS subject
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      WHERE q.share_token = ${shareToken}
        AND q.archived_at IS NULL
        AND (s.id IS NULL OR s.archived_at IS NULL)
        AND COALESCE(q.is_public, TRUE) = TRUE
        AND q.share_revoked_at IS NULL
        AND (q.share_expires_at IS NULL OR q.share_expires_at > now())
      LIMIT 1
    `;
    if (!rows.length) return null;
    const quiz = rows[0] as any as Quiz & { subject?: Subject | null };
    const questions = await this.getQuestionsByQuizId(quiz.id);
    return toPublicQuizDto(quiz, questions, quiz.subject);
  }

  async cloneQuizByShareToken(shareToken: string, userId?: string): Promise<Quiz> {
    const rows = await this.sql`
      SELECT * FROM quizzes
      WHERE share_token = ${shareToken}
        AND archived_at IS NULL
        AND (subject_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM subjects s WHERE s.id = quizzes.subject_id AND s.archived_at IS NOT NULL
        ))
        AND COALESCE(is_public, TRUE) = TRUE
        AND share_revoked_at IS NULL
        AND (share_expires_at IS NULL OR share_expires_at > now())
      LIMIT 1
    `;
    if (!rows.length) throw new Error('Shared set not found or access is restricted.');
    const source = rows[0] as Quiz;
    if (!source.allow_cloning) throw new Error('Creator has disabled cloning for this study set.');
    const questions = await this.getQuestionsByQuizId(source.id);
    return this.createQuiz({
      title: `${source.title} (Copy)`,
      description: source.description || null,
      term: source.term || null,
      subject_id: null,
      source_model: 'cloned',
      questions: questions.map((question) => ({
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
}
