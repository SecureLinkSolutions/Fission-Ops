import os from 'os';
import crypto from 'crypto';
import { pool } from '../db/pool';

export async function getDeploymentFingerprint(): Promise<string> {
  try {
    const res = await pool.query("SELECT value FROM deployment_config WHERE key='fingerprint_seed'");
    let seed: string;
    if ((res.rowCount ?? 0) === 0) {
      seed = crypto.randomUUID();
      await pool.query(
        "INSERT INTO deployment_config(key, value) VALUES('fingerprint_seed', $1) ON CONFLICT DO NOTHING",
        [seed],
      );
    } else {
      seed = res.rows[0].value;
    }
    const dbHash = crypto.createHash('sha256').update(process.env.DATABASE_URL ?? '').digest('hex').slice(0, 8);
    const hostname = os.hostname();
    const raw = `${seed}:${hostname}:${dbHash}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  } catch (err) {
    // Fallback fingerprint if DB not ready yet
    const hostname = os.hostname();
    const dbHash = crypto.createHash('sha256').update(process.env.DATABASE_URL ?? '').digest('hex').slice(0, 8);
    return crypto.createHash('sha256').update(`fallback:${hostname}:${dbHash}`).digest('hex');
  }
}
