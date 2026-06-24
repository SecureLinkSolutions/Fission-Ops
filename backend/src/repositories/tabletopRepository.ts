import { pool } from '../db/pool';

// ─── Exercises ────────────────────────────────────────────────────────────────

export async function listExercises(orgId: string) {
  const result = await pool.query(
    `SELECT e.*,
            COUNT(i.id)::int AS inject_count
     FROM tabletop_exercises e
     LEFT JOIN exercise_injects i ON i.exercise_id = e.id
     WHERE e.org_id = $1
     GROUP BY e.id
     ORDER BY e.created_at DESC`,
    [orgId],
  );
  return result.rows;
}

export async function getExerciseById(id: string, orgId: string) {
  const ex = await pool.query(
    `SELECT e.*, i2.title AS incident_title
     FROM tabletop_exercises e
     LEFT JOIN incidents i2 ON i2.id = e.incident_id
     WHERE e.id = $1 AND e.org_id = $2`,
    [id, orgId],
  );
  if (ex.rowCount === 0) return null;
  const injects = await pool.query(
    `SELECT * FROM exercise_injects WHERE exercise_id = $1 ORDER BY sequence_order ASC`,
    [id],
  );
  return { ...ex.rows[0], injects: injects.rows };
}

export async function createExercise(data: {
  org_id: string;
  title: string;
  description?: string;
  scenario: string;
  objectives?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  created_by: string;
}) {
  const result = await pool.query(
    `INSERT INTO tabletop_exercises
       (org_id, title, description, scenario, objectives, scheduled_at, duration_minutes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      data.org_id,
      data.title,
      data.description ?? null,
      data.scenario,
      data.objectives ?? null,
      data.scheduled_at ?? null,
      data.duration_minutes ?? null,
      data.created_by,
    ],
  );
  return result.rows[0];
}

export async function updateExercise(
  id: string,
  orgId: string,
  data: Partial<{
    title: string;
    description: string;
    scenario: string;
    objectives: string;
    status: string;
    scheduled_at: string;
    duration_minutes: number;
    incident_id: string | null;
  }>,
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(val);
    }
  }
  if (fields.length === 0) return null;
  fields.push(`updated_at = NOW()`);
  values.push(id, orgId);
  const result = await pool.query(
    `UPDATE tabletop_exercises SET ${fields.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteExercise(id: string, orgId: string) {
  const result = await pool.query(
    `DELETE FROM tabletop_exercises WHERE id = $1 AND org_id = $2 RETURNING id`,
    [id, orgId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Injects ──────────────────────────────────────────────────────────────────

export async function addInject(data: {
  exercise_id: string;
  title: string;
  description: string;
  inject_type: string;
  trigger_minutes?: number;
  expected_actions?: string;
  discussion_prompts?: string;
}) {
  // Get next sequence_order
  const maxSeq = await pool.query(
    `SELECT COALESCE(MAX(sequence_order), 0) AS max FROM exercise_injects WHERE exercise_id = $1`,
    [data.exercise_id],
  );
  const sequence_order = (maxSeq.rows[0].max as number) + 1;
  const result = await pool.query(
    `INSERT INTO exercise_injects
       (exercise_id, sequence_order, title, description, inject_type, trigger_minutes, expected_actions, discussion_prompts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      data.exercise_id,
      sequence_order,
      data.title,
      data.description,
      data.inject_type,
      data.trigger_minutes ?? null,
      data.expected_actions ?? null,
      data.discussion_prompts ?? null,
    ],
  );
  return result.rows[0];
}

export async function updateInject(
  injectId: string,
  exerciseId: string,
  data: Partial<{
    title: string;
    description: string;
    inject_type: string;
    trigger_minutes: number;
    expected_actions: string;
    discussion_prompts: string;
  }>,
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(val);
    }
  }
  if (fields.length === 0) return null;
  values.push(injectId, exerciseId);
  const result = await pool.query(
    `UPDATE exercise_injects SET ${fields.join(', ')} WHERE id = $${idx++} AND exercise_id = $${idx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteInject(injectId: string, exerciseId: string) {
  const result = await pool.query(
    `DELETE FROM exercise_injects WHERE id = $1 AND exercise_id = $2 RETURNING id`,
    [injectId, exerciseId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function reorderInjects(exerciseId: string, ids: string[]) {
  // Update each inject's sequence_order to its index+1
  for (let i = 0; i < ids.length; i++) {
    await pool.query(
      `UPDATE exercise_injects SET sequence_order = $1 WHERE id = $2 AND exercise_id = $3`,
      [i + 1, ids[i], exerciseId],
    );
  }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function createSession(data: {
  exercise_id: string;
  org_id: string;
  facilitator_id: string;
}) {
  const result = await pool.query(
    `INSERT INTO exercise_sessions (exercise_id, org_id, facilitator_id)
     VALUES ($1,$2,$3) RETURNING *`,
    [data.exercise_id, data.org_id, data.facilitator_id],
  );
  // Mark exercise as active
  await pool.query(
    `UPDATE tabletop_exercises SET status = 'active', updated_at = NOW() WHERE id = $1`,
    [data.exercise_id],
  );
  return result.rows[0];
}

export async function listSessionsForExercise(exerciseId: string, orgId: string) {
  const result = await pool.query(
    `SELECT s.*, row_to_json(e.*) AS exercise
     FROM exercise_sessions s
     JOIN tabletop_exercises e ON e.id = s.exercise_id
     WHERE s.exercise_id = $1 AND s.org_id = $2
     ORDER BY s.started_at DESC`,
    [exerciseId, orgId],
  );
  return result.rows;
}

export async function getSessionById(sessionId: string, orgId: string) {
  const session = await pool.query(
    `SELECT s.*, row_to_json(e.*) AS exercise
     FROM exercise_sessions s
     JOIN tabletop_exercises e ON e.id = s.exercise_id
     WHERE s.id = $1 AND s.org_id = $2`,
    [sessionId, orgId],
  );
  if (session.rowCount === 0) return null;
  const responses = await pool.query(
    `SELECT * FROM exercise_inject_responses WHERE session_id = $1`,
    [sessionId],
  );
  const releases = await pool.query(
    `SELECT sir.*, u.name AS released_by_name
     FROM session_inject_releases sir
     LEFT JOIN users u ON u.id = sir.released_by
     WHERE sir.session_id = $1`,
    [sessionId],
  );
  return { ...session.rows[0], responses: responses.rows, releases: releases.rows };
}

export async function upsertResponse(data: {
  session_id: string;
  inject_id: string;
  response_text: string;
  gaps_identified?: string;
  submitted_by: string;
}) {
  const result = await pool.query(
    `INSERT INTO exercise_inject_responses
       (session_id, inject_id, response_text, gaps_identified, submitted_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (session_id, inject_id)
     DO UPDATE SET response_text = EXCLUDED.response_text,
                   gaps_identified = EXCLUDED.gaps_identified,
                   submitted_by = EXCLUDED.submitted_by,
                   submitted_at = NOW()
     RETURNING *`,
    [
      data.session_id,
      data.inject_id,
      data.response_text,
      data.gaps_identified ?? null,
      data.submitted_by,
    ],
  );
  return result.rows[0];
}

export async function completeSession(sessionId: string, orgId: string, notes?: string) {
  const result = await pool.query(
    `UPDATE exercise_sessions
     SET status = 'completed', completed_at = NOW(), participant_notes = COALESCE($3, participant_notes)
     WHERE id = $1 AND org_id = $2
     RETURNING *`,
    [sessionId, orgId, notes ?? null],
  );
  if ((result.rowCount ?? 0) > 0) {
    // Mark exercise as completed
    await pool.query(
      `UPDATE tabletop_exercises SET status = 'completed', updated_at = NOW()
       WHERE id = (SELECT exercise_id FROM exercise_sessions WHERE id = $1)`,
      [sessionId],
    );
  }
  return result.rows[0] ?? null;
}

// ─── AAR ──────────────────────────────────────────────────────────────────────

export async function getAAR(sessionId: string, orgId: string) {
  const result = await pool.query(
    `SELECT * FROM exercise_aar WHERE session_id = $1 AND org_id = $2`,
    [sessionId, orgId],
  );
  return result.rows[0] ?? null;
}

// ─── Participants ─────────────────────────────────────────────────────────────

export async function listParticipants(exerciseId: string) {
  const result = await pool.query(
    `SELECT ep.exercise_id, ep.user_id, ep.added_by, ep.added_at,
            u.email AS user_email, u.name AS user_name, u.role AS user_role
     FROM exercise_participants ep
     JOIN users u ON u.id = ep.user_id
     WHERE ep.exercise_id = $1
     ORDER BY ep.added_at ASC`,
    [exerciseId],
  );
  return result.rows;
}

export async function addParticipant(data: {
  exercise_id: string;
  user_id: string;
  added_by: string;
  org_id: string;
}) {
  // Validate user belongs to same org
  const userCheck = await pool.query(
    `SELECT id FROM users WHERE id = $1 AND org_id = $2`,
    [data.user_id, data.org_id],
  );
  if ((userCheck.rowCount ?? 0) === 0) return null;
  const result = await pool.query(
    `INSERT INTO exercise_participants (exercise_id, user_id, added_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (exercise_id, user_id) DO NOTHING
     RETURNING *`,
    [data.exercise_id, data.user_id, data.added_by],
  );
  return result.rows[0] ?? null;
}

export async function removeParticipant(exerciseId: string, userId: string) {
  const result = await pool.query(
    `DELETE FROM exercise_participants WHERE exercise_id = $1 AND user_id = $2 RETURNING exercise_id`,
    [exerciseId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Session Inject Releases ──────────────────────────────────────────────────

export async function releaseInject(data: {
  session_id: string;
  inject_id: string;
  released_by: string;
}) {
  const result = await pool.query(
    `INSERT INTO session_inject_releases (session_id, inject_id, released_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, inject_id) DO NOTHING
     RETURNING *`,
    [data.session_id, data.inject_id, data.released_by],
  );
  if (result.rows.length > 0) return result.rows[0];
  // Already released — return existing record
  const existing = await pool.query(
    `SELECT sir.*, u.name AS released_by_name
     FROM session_inject_releases sir
     LEFT JOIN users u ON u.id = sir.released_by
     WHERE sir.session_id = $1 AND sir.inject_id = $2`,
    [data.session_id, data.inject_id],
  );
  return existing.rows[0] ?? null;
}

export async function upsertAAR(data: {
  session_id: string;
  org_id: string;
  strengths?: string;
  weaknesses?: string;
  gaps?: string;
  recommendations?: string;
  overall_rating?: number;
  created_by: string;
}) {
  const result = await pool.query(
    `INSERT INTO exercise_aar
       (session_id, org_id, strengths, weaknesses, gaps, recommendations, overall_rating, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (session_id)
     DO UPDATE SET strengths = EXCLUDED.strengths,
                   weaknesses = EXCLUDED.weaknesses,
                   gaps = EXCLUDED.gaps,
                   recommendations = EXCLUDED.recommendations,
                   overall_rating = EXCLUDED.overall_rating,
                   updated_at = NOW()
     RETURNING *`,
    [
      data.session_id,
      data.org_id,
      data.strengths ?? null,
      data.weaknesses ?? null,
      data.gaps ?? null,
      data.recommendations ?? null,
      data.overall_rating ?? null,
      data.created_by,
    ],
  );
  return result.rows[0];
}
