import { createHash, randomBytes } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Classroom,
  ClassroomDetails,
  ClassroomInvite,
  ClassroomMember,
  ClassroomSubject,
} from '@quiz-creator/types';
import { cache } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDatabaseUrl } from '@/lib/db';

type SqlClient = NeonQueryFunction<false, false>;
type Database = { kind: 'neon'; sql: SqlClient } | { kind: 'supabase'; client: SupabaseClient };

function hashInviteCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function asClassroom(row: any, role?: 'owner' | 'member'): Classroom {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ?? null,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at || row.created_at).toISOString(),
    role: role || row.role,
    member_count: Number(row.member_count || 0),
    subject_count: Number(row.subject_count || 0),
  };
}

function throwDatabaseError(error: unknown): never {
  throw error instanceof Error ? error : new Error('Class storage request failed');
}

export class ClassroomRepository {
  constructor(private readonly database: Database) {}

  async list(userId: string): Promise<Classroom[]> {
    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        SELECT c.*,
          CASE WHEN c.owner_id = ${userId} THEN 'owner' ELSE 'member' END AS role,
          (SELECT COUNT(*)::int FROM study_class_members m WHERE m.classroom_id = c.id) AS member_count,
          (SELECT COUNT(*)::int FROM study_class_subjects cs WHERE cs.classroom_id = c.id) AS subject_count
        FROM study_classes c
        WHERE c.archived_at IS NULL
          AND (
            c.owner_id = ${userId}
            OR EXISTS (
              SELECT 1 FROM study_class_members m
              WHERE m.classroom_id = c.id AND m.user_id = ${userId}
            )
          )
        ORDER BY c.updated_at DESC, c.id ASC
      `;
      return (rows as any[]).map((row) => asClassroom(row));
    }

    try {
      const { client } = this.database;
      const [ownedResult, memberResult] = await Promise.all([
        client.from('study_classes').select('*').eq('owner_id', userId).is('archived_at', null),
        client.from('study_class_members').select('classroom_id').eq('user_id', userId),
      ]);
      if (ownedResult.error) throw ownedResult.error;
      if (memberResult.error) throw memberResult.error;

      const memberIds = Array.from(new Set((memberResult.data || []).map((row: any) => String(row.classroom_id))));
      const memberClassesResult = memberIds.length
        ? await client.from('study_classes').select('*').in('id', memberIds).is('archived_at', null)
        : { data: [], error: null };
      if (memberClassesResult.error) throw memberClassesResult.error;

      const classes = new Map<string, Classroom>();
      for (const row of ownedResult.data || []) classes.set(String(row.id), asClassroom(row, 'owner'));
      for (const row of memberClassesResult.data || []) {
        const id = String(row.id);
        if (!classes.has(id)) classes.set(id, asClassroom(row, 'member'));
      }

      const ids = Array.from(classes.keys());
      if (ids.length) {
        const [membersResult, subjectsResult] = await Promise.all([
          client.from('study_class_members').select('classroom_id').in('classroom_id', ids),
          client.from('study_class_subjects').select('classroom_id').in('classroom_id', ids),
        ]);
        if (membersResult.error) throw membersResult.error;
        if (subjectsResult.error) throw subjectsResult.error;
        const memberCounts = new Map<string, number>();
        const subjectCounts = new Map<string, number>();
        for (const row of membersResult.data || []) {
          const id = String(row.classroom_id);
          memberCounts.set(id, (memberCounts.get(id) || 0) + 1);
        }
        for (const row of subjectsResult.data || []) {
          const id = String(row.classroom_id);
          subjectCounts.set(id, (subjectCounts.get(id) || 0) + 1);
        }
        for (const [id, classroom] of classes) {
          classroom.member_count = memberCounts.get(id) || 0;
          classroom.subject_count = subjectCounts.get(id) || 0;
        }
      }

      return Array.from(classes.values()).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    } catch (error) {
      return throwDatabaseError(error);
    }
  }

  async get(classroomId: string, userId: string): Promise<Classroom | null> {
    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        SELECT c.*,
          CASE WHEN c.owner_id = ${userId} THEN 'owner' ELSE 'member' END AS role,
          (SELECT COUNT(*)::int FROM study_class_members m WHERE m.classroom_id = c.id) AS member_count,
          (SELECT COUNT(*)::int FROM study_class_subjects cs WHERE cs.classroom_id = c.id) AS subject_count
        FROM study_classes c
        WHERE c.id = ${classroomId}
          AND c.archived_at IS NULL
          AND (
            c.owner_id = ${userId}
            OR EXISTS (
              SELECT 1 FROM study_class_members m
              WHERE m.classroom_id = c.id AND m.user_id = ${userId}
            )
          )
        LIMIT 1
      `;
      return rows.length ? asClassroom(rows[0]) : null;
    }

    try {
      const { client } = this.database;
      const { data: row, error } = await client
        .from('study_classes')
        .select('*')
        .eq('id', classroomId)
        .is('archived_at', null)
        .maybeSingle();
      if (error) throw error;
      if (!row) return null;

      const isOwner = row.owner_id === userId;
      if (!isOwner) {
        const membership = await client
          .from('study_class_members')
          .select('classroom_id')
          .eq('classroom_id', classroomId)
          .eq('user_id', userId)
          .maybeSingle();
        if (membership.error) throw membership.error;
        if (!membership.data) return null;
      }

      const [membersResult, subjectsResult] = await Promise.all([
        client.from('study_class_members').select('classroom_id').eq('classroom_id', classroomId),
        client.from('study_class_subjects').select('classroom_id').eq('classroom_id', classroomId),
      ]);
      if (membersResult.error) throw membersResult.error;
      if (subjectsResult.error) throw subjectsResult.error;
      return asClassroom({
        ...row,
        member_count: membersResult.data?.length || 0,
        subject_count: subjectsResult.data?.length || 0,
      }, isOwner ? 'owner' : 'member');
    } catch (error) {
      return throwDatabaseError(error);
    }
  }

  async getDetails(classroomId: string, userId: string): Promise<ClassroomDetails | null> {
    const classroom = await this.get(classroomId, userId);
    if (!classroom) return null;

    let subjects: ClassroomSubject[] = [];
    let members: ClassroomMember[] | undefined;
    let invites: ClassroomDetails['invites'];

    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        SELECT
          s.id AS subject_id,
          s.name AS subject_name,
          s.color AS subject_color,
          q.id AS quiz_id,
          q.title AS quiz_title,
          q.description AS quiz_description,
          q.question_count,
          q.generated_at
        FROM study_class_subjects cs
        JOIN subjects s ON s.id = cs.subject_id
        LEFT JOIN quizzes q ON q.subject_id = s.id AND q.archived_at IS NULL
        WHERE cs.classroom_id = ${classroomId}
          AND s.archived_at IS NULL
        ORDER BY cs.added_at DESC, s.name ASC, q.generated_at DESC NULLS LAST, q.id ASC
      `;
      const bySubject = new Map<string, ClassroomSubject>();
      for (const row of rows as any[]) {
        const subjectId = String(row.subject_id);
        let subject = bySubject.get(subjectId);
        if (!subject) {
          subject = {
            id: subjectId,
            name: String(row.subject_name),
            color: row.subject_color || '#2563eb',
            study_sets: [],
          };
          bySubject.set(subjectId, subject);
        }
        if (row.quiz_id) {
          subject.study_sets.push({
            id: String(row.quiz_id),
            title: String(row.quiz_title),
            description: row.quiz_description ?? null,
            question_count: Number(row.question_count || 0),
            generated_at: new Date(row.generated_at).toISOString(),
          });
        }
      }
      subjects = Array.from(bySubject.values());

      if (classroom.role === 'owner') {
        const [memberRows, inviteRows] = await Promise.all([
          this.database.sql`
            SELECT user_id, joined_at
            FROM study_class_members
            WHERE classroom_id = ${classroomId}
            ORDER BY joined_at ASC, user_id ASC
          `,
          this.database.sql`
            SELECT id, created_at, expires_at, revoked_at
            FROM study_class_invites
            WHERE classroom_id = ${classroomId}
            ORDER BY created_at DESC
          `,
        ]);
        members = (memberRows as any[]).map((row) => ({ user_id: String(row.user_id), joined_at: new Date(row.joined_at).toISOString() }));
        invites = (inviteRows as any[]).map((row) => ({
          id: String(row.id),
          created_at: new Date(row.created_at).toISOString(),
          expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
          revoked_at: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
        }));
      }
    } else {
      try {
        const { client } = this.database;
        const { data: subjectLinks, error: subjectLinkError } = await client
          .from('study_class_subjects')
          .select('subject_id, added_at')
          .eq('classroom_id', classroomId)
          .order('added_at', { ascending: false });
        if (subjectLinkError) throw subjectLinkError;
        const subjectIds = Array.from(new Set((subjectLinks || []).map((row: any) => String(row.subject_id))));
        if (subjectIds.length) {
          const { data: subjectRows, error: subjectError } = await client
            .from('subjects')
            .select('id, name, color, archived_at')
            .in('id', subjectIds)
            .is('archived_at', null);
          if (subjectError) throw subjectError;
          const visibleSubjects = subjectRows || [];
          const visibleSubjectIds = visibleSubjects.map((row: any) => String(row.id));
          const { data: quizRows, error: quizError } = visibleSubjectIds.length
            ? await client
                .from('quizzes')
                .select('id, subject_id, title, description, question_count, generated_at, archived_at')
                .in('subject_id', visibleSubjectIds)
                .is('archived_at', null)
            : { data: [], error: null };
          if (quizError) throw quizError;
          const bySubject = new Map<string, ClassroomSubject>(
            visibleSubjects.map((row: any) => [String(row.id), {
              id: String(row.id),
              name: String(row.name),
              color: row.color || '#2563eb',
              study_sets: [],
            }])
          );
          for (const row of quizRows || []) {
            const subject = bySubject.get(String(row.subject_id));
            if (!subject) continue;
            subject.study_sets.push({
              id: String(row.id),
              title: String(row.title),
              description: row.description ?? null,
              question_count: Number(row.question_count || 0),
              generated_at: new Date(row.generated_at).toISOString(),
            });
          }
          subjects = subjectIds.map((id) => bySubject.get(id)).filter((row): row is ClassroomSubject => Boolean(row));
        }

        if (classroom.role === 'owner') {
          const [memberResult, inviteResult] = await Promise.all([
            client.from('study_class_members').select('user_id, joined_at').eq('classroom_id', classroomId).order('joined_at'),
            client.from('study_class_invites').select('id, created_at, expires_at, revoked_at').eq('classroom_id', classroomId).order('created_at', { ascending: false }),
          ]);
          if (memberResult.error) throw memberResult.error;
          if (inviteResult.error) throw inviteResult.error;
          members = (memberResult.data || []).map((row: any) => ({ user_id: String(row.user_id), joined_at: new Date(row.joined_at).toISOString() }));
          invites = (inviteResult.data || []).map((row: any) => ({
            id: String(row.id),
            created_at: new Date(row.created_at).toISOString(),
            expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
            revoked_at: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
          }));
        }
      } catch (error) {
        return throwDatabaseError(error);
      }
    }

    return { ...classroom, subjects, ...(members ? { members } : {}), ...(invites ? { invites } : {}) };
  }

  async create(name: string, description: string | null, userId: string): Promise<Classroom> {
    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        INSERT INTO study_classes (owner_id, name, description)
        VALUES (${userId}, ${name}, ${description})
        RETURNING *
      `;
      return asClassroom({ ...rows[0], role: 'owner' }, 'owner');
    }

    const { data, error } = await this.database.client
      .from('study_classes')
      .insert({ owner_id: userId, name, description })
      .select('*')
      .single();
    if (error) return throwDatabaseError(error);
    return asClassroom({ ...data, role: 'owner' }, 'owner');
  }

  async update(classroomId: string, name: string, description: string | null, userId: string): Promise<Classroom> {
    const current = await this.get(classroomId, userId);
    if (!current || current.role !== 'owner') throw new Error('Class not found or owner access is required');

    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        UPDATE study_classes
        SET name = ${name}, description = ${description}, updated_at = NOW()
        WHERE id = ${classroomId} AND owner_id = ${userId} AND archived_at IS NULL
        RETURNING *
      `;
      if (!rows.length) throw new Error('Class not found or owner access is required');
      return asClassroom({ ...rows[0], role: 'owner' }, 'owner');
    }

    const { data, error } = await this.database.client
      .from('study_classes')
      .update({ name, description, updated_at: new Date().toISOString() })
      .eq('id', classroomId)
      .eq('owner_id', userId)
      .is('archived_at', null)
      .select('*')
      .maybeSingle();
    if (error) return throwDatabaseError(error);
    if (!data) throw new Error('Class not found or owner access is required');
    return asClassroom({ ...data, role: 'owner' }, 'owner');
  }

  async archive(classroomId: string, userId: string): Promise<boolean> {
    const current = await this.get(classroomId, userId);
    if (!current || current.role !== 'owner') throw new Error('Class not found or owner access is required');

    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        UPDATE study_classes SET archived_at = NOW(), updated_at = NOW()
        WHERE id = ${classroomId} AND owner_id = ${userId} AND archived_at IS NULL
        RETURNING id
      `;
      return rows.length > 0;
    }

    const { data, error } = await this.database.client
      .from('study_classes')
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', classroomId)
      .eq('owner_id', userId)
      .is('archived_at', null)
      .select('id')
      .maybeSingle();
    if (error) return throwDatabaseError(error);
    return Boolean(data);
  }

  async createInvite(classroomId: string, userId: string): Promise<ClassroomInvite> {
    const current = await this.get(classroomId, userId);
    if (!current || current.role !== 'owner') throw new Error('Class not found or owner access is required');
    const code = randomBytes(32).toString('base64url');
    const tokenHash = hashInviteCode(code);

    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        INSERT INTO study_class_invites (classroom_id, token_hash, created_by)
        VALUES (${classroomId}, ${tokenHash}, ${userId})
        RETURNING id, expires_at
      `;
      return { id: String(rows[0].id), code, expires_at: null };
    }

    const { data, error } = await this.database.client
      .from('study_class_invites')
      .insert({ classroom_id: classroomId, token_hash: tokenHash, created_by: userId })
      .select('id, expires_at')
      .single();
    if (error) return throwDatabaseError(error);
    return { id: String(data.id), code, expires_at: null };
  }

  async revokeInvite(classroomId: string, inviteId: string, userId: string): Promise<boolean> {
    const current = await this.get(classroomId, userId);
    if (!current || current.role !== 'owner') throw new Error('Class not found or owner access is required');

    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        UPDATE study_class_invites
        SET revoked_at = NOW()
        WHERE id = ${inviteId} AND classroom_id = ${classroomId} AND revoked_at IS NULL
        RETURNING id
      `;
      return rows.length > 0;
    }

    const { data, error } = await this.database.client
      .from('study_class_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('classroom_id', classroomId)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();
    if (error) return throwDatabaseError(error);
    return Boolean(data);
  }

  async join(code: string, userId: string): Promise<string | null> {
    const tokenHash = hashInviteCode(code);
    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        WITH valid_invite AS (
          SELECT i.classroom_id
          FROM study_class_invites i
          JOIN study_classes c ON c.id = i.classroom_id
          WHERE i.token_hash = ${tokenHash}
            AND i.revoked_at IS NULL
            AND (i.expires_at IS NULL OR i.expires_at > NOW())
            AND c.archived_at IS NULL
        ), joined AS (
          INSERT INTO study_class_members (classroom_id, user_id)
          SELECT v.classroom_id, ${userId}
          FROM valid_invite v
          JOIN study_classes c ON c.id = v.classroom_id
          WHERE c.owner_id <> ${userId}
          ON CONFLICT (classroom_id, user_id) DO NOTHING
          RETURNING classroom_id
        )
        SELECT classroom_id FROM joined
        UNION
        SELECT v.classroom_id
        FROM valid_invite v
        WHERE EXISTS (
          SELECT 1 FROM study_class_members m
          WHERE m.classroom_id = v.classroom_id AND m.user_id = ${userId}
        ) OR EXISTS (
          SELECT 1 FROM study_classes c
          WHERE c.id = v.classroom_id AND c.owner_id = ${userId}
        )
        LIMIT 1
      `;
      return rows[0] ? String(rows[0].classroom_id) : null;
    }

    try {
      const { client } = this.database;
      const { data: invite, error: inviteError } = await client
        .from('study_class_invites')
        .select('classroom_id, expires_at')
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .maybeSingle();
      if (inviteError) throw inviteError;
      if (!invite || (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now())) return null;

      const { data: classroom, error: classError } = await client
        .from('study_classes')
        .select('id, owner_id')
        .eq('id', invite.classroom_id)
        .is('archived_at', null)
        .maybeSingle();
      if (classError) throw classError;
      if (!classroom) return null;

      if (classroom.owner_id !== userId) {
        const { error } = await client
          .from('study_class_members')
          .upsert({ classroom_id: classroom.id, user_id: userId }, { onConflict: 'classroom_id,user_id', ignoreDuplicates: true });
        if (error) throw error;
      }
      return String(classroom.id);
    } catch (error) {
      return throwDatabaseError(error);
    }
  }

  async removeMember(classroomId: string, memberId: string, userId: string): Promise<boolean> {
    const current = await this.get(classroomId, userId);
    if (!current || current.role !== 'owner') throw new Error('Class not found or owner access is required');
    if (memberId === userId) throw new Error('The class owner cannot remove themselves');

    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        DELETE FROM study_class_members m
        USING study_classes c
        WHERE m.classroom_id = c.id
          AND m.classroom_id = ${classroomId}
          AND m.user_id = ${memberId}
          AND c.owner_id = ${userId}
          AND c.archived_at IS NULL
        RETURNING m.user_id
      `;
      return rows.length > 0;
    }

    const { data, error } = await this.database.client
      .from('study_class_members')
      .delete()
      .eq('classroom_id', classroomId)
      .eq('user_id', memberId)
      .select('user_id')
      .maybeSingle();
    if (error) return throwDatabaseError(error);
    return Boolean(data);
  }

  async leave(classroomId: string, userId: string): Promise<boolean> {
    const current = await this.get(classroomId, userId);
    if (!current || current.role !== 'member') return false;

    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        DELETE FROM study_class_members m
        USING study_classes c
        WHERE m.classroom_id = c.id
          AND m.classroom_id = ${classroomId}
          AND m.user_id = ${userId}
          AND c.archived_at IS NULL
          AND c.owner_id <> ${userId}
        RETURNING m.user_id
      `;
      return rows.length > 0;
    }

    const { data, error } = await this.database.client
      .from('study_class_members')
      .delete()
      .eq('classroom_id', classroomId)
      .eq('user_id', userId)
      .select('user_id')
      .maybeSingle();
    if (error) return throwDatabaseError(error);
    return Boolean(data);
  }

  async addSubject(classroomId: string, subjectId: string, userId: string): Promise<boolean> {
    const current = await this.get(classroomId, userId);
    if (!current || current.role !== 'owner') throw new Error('Class not found or owner access is required');

    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        INSERT INTO study_class_subjects (classroom_id, subject_id, added_by)
        SELECT c.id, s.id, ${userId}
        FROM study_classes c
        JOIN subjects s ON s.id = ${subjectId}
        WHERE c.id = ${classroomId}
          AND c.owner_id = ${userId}
          AND c.archived_at IS NULL
          AND s.user_id = ${userId}
          AND s.archived_at IS NULL
        ON CONFLICT (classroom_id, subject_id) DO NOTHING
        RETURNING subject_id
      `;
      if (rows.length) return true;
      const existing = await this.database.sql`
        SELECT 1 FROM study_class_subjects cs
        JOIN study_classes c ON c.id = cs.classroom_id
        JOIN subjects s ON s.id = cs.subject_id
        WHERE cs.classroom_id = ${classroomId} AND cs.subject_id = ${subjectId}
          AND c.owner_id = ${userId} AND c.archived_at IS NULL
          AND s.user_id = ${userId} AND s.archived_at IS NULL
        LIMIT 1
      `;
      if (existing.length) return true;
      throw new Error('Only an active subject you own can be added to this class');
    }

    const { data: subject, error: subjectError } = await this.database.client
      .from('subjects')
      .select('id')
      .eq('id', subjectId)
      .eq('user_id', userId)
      .is('archived_at', null)
      .maybeSingle();
    if (subjectError) return throwDatabaseError(subjectError);
    if (!subject) throw new Error('Only an active subject you own can be added to this class');
    const { error } = await this.database.client
      .from('study_class_subjects')
      .upsert({ classroom_id: classroomId, subject_id: subjectId, added_by: userId }, { onConflict: 'classroom_id,subject_id', ignoreDuplicates: true });
    if (error) return throwDatabaseError(error);
    return true;
  }

  async removeSubject(classroomId: string, subjectId: string, userId: string): Promise<boolean> {
    const current = await this.get(classroomId, userId);
    if (!current || current.role !== 'owner') throw new Error('Class not found or owner access is required');

    if (this.database.kind === 'neon') {
      const rows = await this.database.sql`
        DELETE FROM study_class_subjects cs
        USING study_classes c
        WHERE cs.classroom_id = c.id
          AND cs.classroom_id = ${classroomId}
          AND cs.subject_id = ${subjectId}
          AND c.owner_id = ${userId}
          AND c.archived_at IS NULL
        RETURNING cs.subject_id
      `;
      return rows.length > 0;
    }

    const { data, error } = await this.database.client
      .from('study_class_subjects')
      .delete()
      .eq('classroom_id', classroomId)
      .eq('subject_id', subjectId)
      .select('subject_id')
      .maybeSingle();
    if (error) return throwDatabaseError(error);
    return Boolean(data);
  }
}

export const getClassroomRepository = cache(async (): Promise<ClassroomRepository> => {
  const databaseUrl = getDatabaseUrl();
  if (databaseUrl) return new ClassroomRepository({ kind: 'neon', sql: neon(databaseUrl) });

  const supabase = await createServerSupabaseClient();
  if (supabase) return new ClassroomRepository({ kind: 'supabase', client: supabase });

  const error = new Error('Class features require a configured persistent database.') as Error & { status: number };
  error.status = 503;
  throw error;
});
