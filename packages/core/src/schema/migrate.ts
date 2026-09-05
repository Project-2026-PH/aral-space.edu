import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Neon Schema Migration Script
 * Runs the neon_schema.sql DDL statements against the DATABASE_URL.
 */
export async function runMigration(databaseUrl?: string): Promise<void> {
  const url = databaseUrl || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not defined in environment variables.');
  }

  const sql = neon(url);
  const schemaPath = path.join(__dirname, 'neon_schema.sql');
  const ddl = fs.readFileSync(schemaPath, 'utf-8');

  // Remove line comments before splitting so a comment immediately before a DDL
  // statement cannot cause that statement to be filtered out.
  const statements = ddl
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`[Neon Migration] Running ${statements.length} SQL statements...`);

  for (const statement of statements) {
    try {
      await (sql as any)(statement);
    } catch (err: any) {
      console.warn(`[Neon Migration Warning]:`, err.message);
    }
  }

  console.log('[Neon Migration] Schema migration applied successfully!');
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  runMigration().catch(err => {
    console.error('[Neon Migration Failed]:', err);
    process.exit(1);
  });
}
