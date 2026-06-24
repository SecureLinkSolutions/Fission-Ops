import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './db/pool';
import { initCrypto } from './services/crypto';
import { config } from './config';
import app from './app';

async function initDb(): Promise<void> {
  const schemaPath = join(__dirname, '../src/db/schema.sql');
  let sql: string;
  try {
    sql = readFileSync(schemaPath, 'utf8');
  } catch {
    // Try dist path
    sql = readFileSync(join(__dirname, 'db/schema.sql'), 'utf8');
  }
  await pool.query(sql);
  console.log('✅ License DB schema verified');
}

async function main(): Promise<void> {
  try {
    await initDb();
  } catch (err) {
    console.error('DB init error:', err);
    process.exit(1);
  }

  initCrypto();

  app.listen(config.PORT, () => {
    console.log(`⚡ Fission License Server running on :${config.PORT}`);
    console.log(`   Admin UI: http://localhost:${config.PORT}/admin`);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
