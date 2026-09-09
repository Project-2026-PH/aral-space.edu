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
  'CREATE INDEX IF NOT EXISTS idx_subjects_archived_at ON subjects (archived_at)',
  'CREATE INDEX IF NOT EXISTS idx_quizzes_archived_at ON quizzes (archived_at)'
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
    )
  ORDER BY table_name, column_name
`;

const expected = new Set([
  'subjects.archived_at',
  'quizzes.archived_at',
  'quizzes.archived_by_subject'
]);
const found = new Set(columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`));
const missing = [...expected].filter((column) => !found.has(column));
if (missing.length > 0) {
  throw new Error(`Archive migration verification failed. Missing: ${missing.join(', ')}`);
}

console.log('[Neon Archive Migration] Archive columns verified successfully.');
