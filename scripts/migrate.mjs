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

const schemaPath = path.join(root, 'packages', 'core', 'src', 'schema', 'neon_schema.sql');
const ddl = fs.readFileSync(schemaPath, 'utf8');
const statements = ddl
  .replace(/^\s*--.*$/gm, '')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const sql = neon(databaseUrl);
console.log(`[Neon Migration] Running ${statements.length} SQL statements...`);

for (const statement of statements) {
  await sql(statement);
}

console.log('[Neon Migration] Schema migration applied successfully.');
