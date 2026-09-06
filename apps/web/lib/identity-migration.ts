import { neon } from '@neondatabase/serverless';
import { isValidAnonymousUserId } from './anonymous-token';

function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
}

/**
 * Migrates all quizzes, subjects, sessions, and collaborator access from one anonymous user to another.
 * Executed in a single atomic CTE statement to ensure all-or-nothing transactional guarantees.
 */
export async function migrateAnonymousIdentity(fromUserId: string, toUserId: string): Promise<void> {
  if (!isValidAnonymousUserId(fromUserId) || !isValidAnonymousUserId(toUserId)) {
    throw new Error('Both source and target must be valid authenticated anonymous user identities.');
  }

  if (fromUserId === toUserId) {
    return;
  }

  const databaseUrl = getDatabaseUrl();
  const isDbEnabled = Boolean(databaseUrl && process.env.PAIRING_DB_DISABLED !== 'true');

  if (isDbEnabled) {
    const sql = neon(databaseUrl!);
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
  }
}
