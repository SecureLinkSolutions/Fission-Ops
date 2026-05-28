import { pool } from './pool';

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
}
