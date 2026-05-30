import { pool } from './pool';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function checkSchema(): Promise<void> {
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'users'`,
  );
  if (result.rowCount === 0) {
    console.error('❌ Database schema not initialized. Run init.sql first.');
    process.exit(1);
  }
  console.log('✅ Database schema verified');
  await runMigrations();
}

async function runMigrations(): Promise<void> {
  const needsMigration = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'entity_relationships'`,
  );
  if ((needsMigration.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 001...');
    const migrationPath = join(__dirname, '../../../../db/migrate_001.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 001 applied');
  }

  const needsMigration002 = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'ttps'`,
  );
  if ((needsMigration002.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 002...');
    const migrationPath = join(__dirname, '../../../../db/migrate_002.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 002 applied');
  }
}
