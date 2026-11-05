import fs from 'node:fs';
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

const migrationPaths = [
  path.join(root, 'sql', '2026-11-05-study-classes.sql'),
  path.join(root, 'sql', '2026-11-05-study-class-subjects.sql'),
];
const statements = migrationPaths.flatMap((migrationPath) => fs.readFileSync(migrationPath, 'utf8')
  .replace(/^\s*--.*$/gm, '')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean));

const sql = neon(databaseUrl);
console.log(`[Study Class Migration] Running ${statements.length} SQL statements...`);

for (const statement of statements) {
  await sql(statement);
}

const verification = await sql`
  SELECT
    to_regclass('public.study_classes') IS NOT NULL AS classes,
    to_regclass('public.study_class_members') IS NOT NULL AS members,
    to_regclass('public.study_class_sets') IS NOT NULL AS sets,
    to_regclass('public.study_class_invites') IS NOT NULL AS invites,
    to_regclass('public.study_class_subjects') IS NOT NULL AS class_subjects
`;

if (!verification[0]?.classes || !verification[0]?.members || !verification[0]?.sets || !verification[0]?.invites || !verification[0]?.class_subjects) {
  throw new Error('Study class tables were not created in the public schema.');
}

console.log('[Study Class Migration] All study class tables are present.');
