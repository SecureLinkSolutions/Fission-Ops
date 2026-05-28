import { pool } from '../db/pool';
import { User } from '../types';

export async function findUserByEmail(email: string): Promise<(User & { password_hash?: string }) | null> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query(
    'SELECT id, email, name, role, sso_provider, sso_subject, created_at FROM users WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}
