import { pool } from './pool';
import { readFileSync } from 'fs';
import { join } from 'path';
import { seedMitre } from './seedMitre';
import { seedTTPRelationships } from '../repositories/ttpSuggestionRepository';

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
  const needsMigration013 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entity_enrichment_history'`,
  );
  if ((needsMigration013.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 013...');
    const migrationPath = join(__dirname, '../../../../db/migrate_013.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 013 applied');
  }


  const needsMigration014 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entity_checklists'`,
  );
  if ((needsMigration014.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 014...');
    const migrationPath014 = join(__dirname, '../../../../db/migrate_014.sql');
    const sql014 = readFileSync(migrationPath014, 'utf8');
    await pool.query(sql014);
    console.log('✅ Migration 014 applied');
  }

  const needsMigration015 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'remediation_items'`,
  );
  if ((needsMigration015.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 015...');
    const migrationPath015 = join(__dirname, '../../../../db/migrate_015.sql');
    const sql015 = readFileSync(migrationPath015, 'utf8');
    await pool.query(sql015);
    console.log('✅ Migration 015 applied');
  }

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
    // ALTER TYPE ADD VALUE must be committed before 'platform_admin' can be used.
    // Run it alone so it auto-commits, then run the rest of the migration.
    await pool.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_admin'`);
    const migrationPath = join(__dirname, '../../../../db/migrate_004.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    // Strip the DO block that re-adds the enum value — it was already committed above.
    const sqlWithoutEnumDo = sql.replace(
      /-- Add 'platform_admin' to user_role enum.*?END \$\$;/s,
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

  const needsMigration008 = await pool.query(
    `SELECT 1 FROM deployment_config WHERE key = 'migration_008_applied'`,
  );
  if ((needsMigration008.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 008...');
    const migrationPath = join(__dirname, '../../../../db/migrate_008.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    await pool.query(`INSERT INTO deployment_config (key, value) VALUES ('migration_008_applied', 'true') ON CONFLICT (key) DO NOTHING`);
    console.log('✅ Migration 008 applied');
  }

  const needsMigration009 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_entities'`,
  );
  if ((needsMigration009.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 009...');
    const migrationPath = join(__dirname, '../../../../db/migrate_009.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 009 applied');
  }

  const needsMigration010 = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'entity_relationships' AND column_name = 'bidirectional'`,
  );
  if ((needsMigration010.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 010...');
    const migrationPath = join(__dirname, '../../../../db/migrate_010.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 010 applied');
  }

  const needsMigration011 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_comments'`,
  );
  if ((needsMigration011.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 011...');
    const migrationPath = join(__dirname, '../../../../db/migrate_011.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 011 applied');
  }

  const needsMigration012 = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'task_id'`,
  );
  if ((needsMigration012.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 012...');
    const migrationPath = join(__dirname, '../../../../db/migrate_012.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 012 applied');
  }

  const needsMigration016 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ttp_relationships'`,
  );
  if ((needsMigration016.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 016...');
    const migrationPath016 = join(__dirname, '../../../../db/migrate_016.sql');
    const sql016 = readFileSync(migrationPath016, 'utf8');
    await pool.query(sql016);
    console.log('✅ Migration 016 applied');
  }
  await seedTTPRelationships().catch((e) => console.warn('TTP relationship seed skipped:', e.message));

  const needsMigration017 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evidence_custody_log'`,
  );
  if ((needsMigration017.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 017...');
    const migrationPath017 = join(__dirname, '../../../../db/migrate_017.sql');
    const sql017 = readFileSync(migrationPath017, 'utf8');
    await pool.query(sql017);
    console.log('✅ Migration 017 applied');
  }
  const needsMigration018 = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'platform_admin_access'`,
  );
  if ((needsMigration018.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 018...');
    const migrationPath018 = join(__dirname, '../../../../db/migrate_018.sql');
    const sql018 = readFileSync(migrationPath018, 'utf8');
    await pool.query(sql018);
    console.log('✅ Migration 018 applied');
  }
  const needsMigration019 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_admin_access_log'`,
  );
  if ((needsMigration019.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 019...');
    const migrationPath019 = join(__dirname, '../../../../db/migrate_019.sql');
    const sql019 = readFileSync(migrationPath019, 'utf8');
    await pool.query(sql019);
    console.log('✅ Migration 019 applied');
  }

  const needsMigration020 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tabletop_exercises'`,
  );
  if ((needsMigration020.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 020...');
    const migrationPath020 = join(__dirname, '../../../../db/migrate_020.sql');
    const sql020 = readFileSync(migrationPath020, 'utf8');
    await pool.query(sql020);
    console.log('✅ Migration 020 applied');
  }

  const needsMigration021 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exercise_participants'`,
  );
  if ((needsMigration021.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 021...');
    const migrationPath021 = join(__dirname, '../../../../db/migrate_021.sql');
    const sql021 = readFileSync(migrationPath021, 'utf8');
    await pool.query(sql021);
    console.log('✅ Migration 021 applied');
  }

  // Migration 022: extend org_api_keys service CHECK to include 'anthropic'
  const needsMigration022 = await pool.query(
    `SELECT 1 FROM information_schema.check_constraints
     WHERE constraint_name = 'org_api_keys_service_check'
     AND check_clause LIKE '%anthropic%'`,
  );
  if ((needsMigration022.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 022...');
    const migrationPath022 = join(__dirname, '../../../../db/migrate_022.sql');
    const sql022 = readFileSync(migrationPath022, 'utf8');
    await pool.query(sql022);
    console.log('✅ Migration 022 applied');
  }

  // Migration 023: fix exercise_sessions FK to cascade on exercise delete
  const needsMigration023 = await pool.query(
    `SELECT 1 FROM information_schema.referential_constraints rc
     JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
     WHERE tc.table_name = 'exercise_sessions'
       AND rc.constraint_name = 'exercise_sessions_exercise_id_fkey'
       AND rc.delete_rule = 'CASCADE'`,
  );
  if ((needsMigration023.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 023...');
    const migrationPath023 = join(__dirname, '../../../../db/migrate_023.sql');
    const sql023 = readFileSync(migrationPath023, 'utf8');
    await pool.query(sql023);
    console.log('✅ Migration 023 applied');
  }

  // Migration 024: extend entity_type enum with file, process, registry, certificate, url, custom
  const needsMigration024 = await pool.query(
    `SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'entity_type' AND e.enumlabel = 'file'`,
  );
  if ((needsMigration024.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 024...');
    const migrationPath024 = join(__dirname, '../../../../db/migrate_024.sql');
    const sql024 = readFileSync(migrationPath024, 'utf8');
    await pool.query(sql024);
    console.log('✅ Migration 024 applied');
  }

  // Migration 025: password_reset_tokens table
  const needsMigration025 = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'`,
  );
  if ((needsMigration025.rowCount ?? 0) === 0) {
    console.log('⚙️  Running migration 025...');
    const migrationPath025 = join(__dirname, '../../../../db/migrate_025.sql');
    const sql025 = readFileSync(migrationPath025, 'utf8');
    await pool.query(sql025);
    console.log('✅ Migration 025 applied');
  }
}
// Note: migration 014 block is appended below
