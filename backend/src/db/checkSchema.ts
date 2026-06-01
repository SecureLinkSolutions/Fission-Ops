import { pool } from './pool';
import { readFileSync } from 'fs';
import { join } from 'path';
import { seedMitre } from './seedMitre';

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
  await seedMitre();
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

  const needsMigration003 = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'audit_logs'`,
  );
  if ((needsMigration003.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 003...');
    const migrationPath = join(__dirname, '../../../../db/migrate_003.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 003 applied');
  }

  const needsMigration004 = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'organizations'`,
  );
  if ((needsMigration004.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 004...');
    // ALTER TYPE ADD VALUE must be committed before 'super_admin' can be used.
    // Run it alone so it auto-commits, then run the rest of the migration.
    await pool.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin'`);
    const migrationPath = join(__dirname, '../../../../db/migrate_004.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    // Strip the DO block that re-adds the enum value — it was already committed above.
    const sqlWithoutEnumDo = sql.replace(
      /-- Add 'super_admin' to user_role enum.*?END \$\$;/s,
      '',
    );
    await pool.query(sqlWithoutEnumDo);
    console.log('✅ Migration 004 applied');
  }

  const needsMigration005 = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'notifications'`,
  );
  if ((needsMigration005.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 005...');
    const migrationPath = join(__dirname, '../../../../db/migrate_005.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 005 applied');
  }

  const needsMigration006 = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'deployment_config'`,
  );
  if ((needsMigration006.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 006...');
    const migrationPath = join(__dirname, '../../../../db/migrate_006.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 006 applied');
  }

  // Migration 007 is identified by a sentinel in deployment_config so it
  // runs exactly once on any existing database, fixing the broken seed hashes.
  const needsMigration007 = await pool.query(
    `SELECT 1 FROM deployment_config WHERE key = 'migration_007_applied'`,
  );
  if ((needsMigration007.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 007 (fix seed password hashes)...');
    const migrationPath = join(__dirname, '../../../../db/migrate_007.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    await pool.query(
      `INSERT INTO deployment_config (key, value) VALUES ('migration_007_applied', 'true')
       ON CONFLICT (key) DO NOTHING`,
    );
    console.log('✅ Migration 007 applied');
  }
}
