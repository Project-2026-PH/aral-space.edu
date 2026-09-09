import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'packages', 'core', 'package.json'));
const { neon } = require('@neondatabase/serverless');
const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL or NEON_DATABASE_URL is not defined.');
}

const sql = neon(databaseUrl);
const statements = [
  'ALTER TABLE subjects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ',
  'ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ',
  'ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS archived_by_subject BOOLEAN NOT NULL DEFAULT FALSE',
  `CREATE TABLE IF NOT EXISTS user_subject_archives (
    user_id TEXT NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, subject_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_quiz_archives (
    user_id TEXT NOT NULL,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_by_subject BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, quiz_id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_subjects_archived_at ON subjects (archived_at)',
  'CREATE INDEX IF NOT EXISTS idx_quizzes_archived_at ON quizzes (archived_at)',
  'CREATE INDEX IF NOT EXISTS idx_user_subject_archives_subject ON user_subject_archives(subject_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_quiz_archives_quiz ON user_quiz_archives(quiz_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_quiz_archives_subject_cascade ON user_quiz_archives(user_id, archived_by_subject, archived_at DESC)',
  `INSERT INTO user_subject_archives (user_id, subject_id, archived_at)
   SELECT user_id, id, archived_at
   FROM subjects
   WHERE archived_at IS NOT NULL AND user_id IS NOT NULL
   ON CONFLICT (user_id, subject_id) DO NOTHING`,
  `INSERT INTO user_quiz_archives (user_id, quiz_id, archived_at, archived_by_subject)
   SELECT s.user_id, q.id, COALESCE(q.archived_at, s.archived_at, now()), TRUE
   FROM quizzes q
   JOIN subjects s ON s.id = q.subject_id
   WHERE s.archived_at IS NOT NULL
     AND q.archived_at IS NOT NULL
     AND q.archived_by_subject = TRUE
     AND s.user_id IS NOT NULL
   ON CONFLICT (user_id, quiz_id) DO NOTHING`,
  `INSERT INTO user_quiz_archives (user_id, quiz_id, archived_at, archived_by_subject)
   SELECT user_id, id, archived_at, COALESCE(archived_by_subject, FALSE)
   FROM quizzes
   WHERE archived_at IS NOT NULL AND user_id IS NOT NULL
   ON CONFLICT (user_id, quiz_id) DO NOTHING`,
  `UPDATE quizzes q
   SET archived_at = NULL, archived_by_subject = FALSE
   WHERE q.archived_at IS NOT NULL
     AND (
       q.user_id IS NOT NULL
       OR EXISTS (
         SELECT 1
         FROM subjects s
         WHERE s.id = q.subject_id
           AND s.user_id IS NOT NULL
           AND s.archived_at IS NOT NULL
       )
     )`,
  `UPDATE subjects
   SET archived_at = NULL
   WHERE archived_at IS NOT NULL AND user_id IS NOT NULL`
];

console.log(`[Neon Archive Migration] Applying ${statements.length} idempotent statements...`);
for (const statement of statements) {
  await sql(statement);
}

const columns = await sql`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND (
      (table_name = 'subjects' AND column_name = 'archived_at')
      OR (table_name = 'quizzes' AND column_name IN ('archived_at', 'archived_by_subject'))
      OR (table_name = 'user_subject_archives' AND column_name IN ('user_id', 'subject_id', 'archived_at'))
      OR (table_name = 'user_quiz_archives' AND column_name IN ('user_id', 'quiz_id', 'archived_at', 'archived_by_subject'))
    )
  ORDER BY table_name, column_name
`;

const expected = new Set([
  'subjects.archived_at',
  'quizzes.archived_at',
  'quizzes.archived_by_subject',
  'user_subject_archives.user_id',
  'user_subject_archives.subject_id',
  'user_subject_archives.archived_at',
  'user_quiz_archives.user_id',
  'user_quiz_archives.quiz_id',
  'user_quiz_archives.archived_at',
  'user_quiz_archives.archived_by_subject'
]);
const found = new Set(columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`));
const missing = [...expected].filter((column) => !found.has(column));
if (missing.length > 0) {
  throw new Error(`Archive migration verification failed. Missing: ${missing.join(', ')}`);
}

console.log('[Neon Archive Migration] Per-guest archive tables and legacy archive state verified successfully.');
