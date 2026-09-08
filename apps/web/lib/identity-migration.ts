import { neon } from '@neondatabase/serverless';
import { isValidAnonymousUserId } from './anonymous-token';
import { createServerSupabaseClient } from './supabase/server';

function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
}

async function migrateWithSupabase(fromUserId: string, toUserId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new Error('Persistent database is not configured for guest session sync.');
  }

  const { data: collaboratorRows, error: collaboratorReadError } = await supabase
    .from('subject_collaborators')
    .select('subject_id')
    .eq('user_id', fromUserId);
  if (collaboratorReadError) throw collaboratorReadError;

  if (collaboratorRows?.length) {
    const { error } = await supabase
      .from('subject_collaborators')
      .upsert(
        collaboratorRows.map(({ subject_id }) => ({ subject_id, user_id: toUserId })),
        { onConflict: 'subject_id,user_id', ignoreDuplicates: true }
      );
    if (error) throw error;
  }

  for (const table of ['subjects', 'quizzes', 'quiz_sessions'] as const) {
    const { error } = await supabase
      .from(table)
      .update({ user_id: toUserId })
      .eq('user_id', fromUserId);
    if (error) throw error;
  }

  const { error: collaboratorDeleteError } = await supabase
    .from('subject_collaborators')
    .delete()
    .eq('user_id', fromUserId);
  if (collaboratorDeleteError) throw collaboratorDeleteError;
}

/**
 * Moves all quizzes, subjects, sessions, and collaborator access from one anonymous user to another.
 * Neon performs the move in one atomic CTE. The Supabase path is idempotent and throws on any
 * failed operation instead of silently reporting a successful but incomplete sync.
 */
export async function migrateAnonymousIdentity(fromUserId: string, toUserId: string): Promise<void> {
  if (!isValidAnonymousUserId(fromUserId) || !isValidAnonymousUserId(toUserId)) {
    throw new Error('Both source and target must be valid authenticated anonymous user identities.');
  }

  if (fromUserId === toUserId) {
    return;
  }

  if (process.env.PAIRING_DB_DISABLED === 'true') {
    return;
  }

  const databaseUrl = getDatabaseUrl();
  if (databaseUrl) {
    const sql = neon(databaseUrl);
    await sql`
      WITH updated_subjects AS (
        UPDATE subjects
        SET user_id = ${toUserId}
        WHERE user_id = ${fromUserId}
        RETURNING id
      ),
      updated_quizzes AS (
        UPDATE quizzes
        SET user_id = ${toUserId}
        WHERE user_id = ${fromUserId}
        RETURNING id
      ),
      updated_sessions AS (
        UPDATE quiz_sessions
        SET user_id = ${toUserId}
        WHERE user_id = ${fromUserId}
        RETURNING id
      ),
      inserted_collabs AS (
        INSERT INTO subject_collaborators (subject_id, user_id)
        SELECT sc.subject_id, ${toUserId}
        FROM subject_collaborators sc
        WHERE sc.user_id = ${fromUserId}
        ON CONFLICT (subject_id, user_id) DO NOTHING
        RETURNING subject_id
      ),
      deleted_collabs AS (
        DELETE FROM subject_collaborators
        WHERE user_id = ${fromUserId}
        RETURNING subject_id
      )
      SELECT 1 as done
    `;
    return;
  }

  await migrateWithSupabase(fromUserId, toUserId);
}
