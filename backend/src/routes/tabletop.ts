import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { createError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import * as repo from '../repositories/tabletopRepository';
import { emitToTabletopSession } from '../socket';

const router = Router();

// ─── Exercises ────────────────────────────────────────────────────────────────

router.get('/exercises', authenticate, async (req: Request, res: Response) => {
  const exercises = await repo.listExercises(req.user!.org_id!);
  res.json(exercises);
});

const exerciseBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  scenario: z.string().min(1),
  objectives: z.string().optional(),
  scheduled_at: z.string().optional(),
  duration_minutes: z.number().int().positive().optional(),
  incident_id: z.string().uuid().nullable().optional(),
});

router.post('/exercises', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const body = exerciseBodySchema.parse(req.body);
  const exercise = await repo.createExercise({
    ...body,
    org_id: req.user!.org_id!,
    created_by: req.user!.sub,
  });
  res.status(201).json(exercise);
});

router.get('/exercises/:id', authenticate, async (req: Request, res: Response) => {
  const exercise = await repo.getExerciseById(req.params.id, req.user!.org_id!);
  if (!exercise) throw createError('Exercise not found', 404, 'NOT_FOUND');
  res.json(exercise);
});

router.put('/exercises/:id', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const body = exerciseBodySchema.partial().parse(req.body);
  const exercise = await repo.updateExercise(req.params.id, req.user!.org_id!, body);
  if (!exercise) throw createError('Exercise not found', 404, 'NOT_FOUND');
  res.json(exercise);
});

router.delete('/exercises/:id', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const deleted = await repo.deleteExercise(req.params.id, req.user!.org_id!);
  if (!deleted) throw createError('Exercise not found', 404, 'NOT_FOUND');
  res.status(204).send();
});

// Status transitions
router.patch('/exercises/:id/status', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const { status } = z.object({ status: z.enum(['draft', 'ready', 'active', 'completed', 'archived']) }).parse(req.body);
  const exercise = await repo.updateExercise(req.params.id, req.user!.org_id!, { status });
  if (!exercise) throw createError('Exercise not found', 404, 'NOT_FOUND');
  res.json(exercise);
});

// ─── Injects ──────────────────────────────────────────────────────────────────

const injectBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  inject_type: z.enum(['information', 'decision', 'complication', 'escalation', 'resolution']),
  trigger_minutes: z.number().int().nonnegative().optional(),
  expected_actions: z.string().optional(),
  discussion_prompts: z.string().optional(),
});

router.post('/exercises/:id/injects', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const body = injectBodySchema.parse(req.body);
  // Verify exercise belongs to org
  const exercise = await repo.getExerciseById(req.params.id, req.user!.org_id!);
  if (!exercise) throw createError('Exercise not found', 404, 'NOT_FOUND');
  const inject = await repo.addInject({ ...body, exercise_id: req.params.id });
  res.status(201).json(inject);
});

router.put('/exercises/:id/injects/:injectId', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const body = injectBodySchema.partial().parse(req.body);
  const inject = await repo.updateInject(req.params.injectId, req.params.id, body);
  if (!inject) throw createError('Inject not found', 404, 'NOT_FOUND');
  res.json(inject);
});

router.delete('/exercises/:id/injects/:injectId', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const deleted = await repo.deleteInject(req.params.injectId, req.params.id);
  if (!deleted) throw createError('Inject not found', 404, 'NOT_FOUND');
  res.status(204).send();
});

router.patch('/exercises/:id/injects/reorder', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const { ids } = z.object({ ids: z.array(z.string().uuid()) }).parse(req.body);
  await repo.reorderInjects(req.params.id, ids);
  res.json({ ok: true });
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

router.get('/exercises/:id/sessions', authenticate, async (req: Request, res: Response) => {
  const exercise = await repo.getExerciseById(req.params.id, req.user!.org_id!);
  if (!exercise) throw createError('Exercise not found', 404, 'NOT_FOUND');
  const sessions = await repo.listSessionsForExercise(req.params.id, req.user!.org_id!);
  res.json(sessions);
});

router.post('/exercises/:id/sessions', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const exercise = await repo.getExerciseById(req.params.id, req.user!.org_id!);
  if (!exercise) throw createError('Exercise not found', 404, 'NOT_FOUND');
  const session = await repo.createSession({
    exercise_id: req.params.id,
    org_id: req.user!.org_id!,
    facilitator_id: req.user!.sub,
  });
  res.status(201).json(session);
});

router.get('/sessions/:sessionId', authenticate, async (req: Request, res: Response) => {
  const session = await repo.getSessionById(req.params.sessionId, req.user!.org_id!);
  if (!session) throw createError('Session not found', 404, 'NOT_FOUND');
  res.json(session);
});

router.post('/sessions/:sessionId/responses', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const body = z.object({
    inject_id: z.string().uuid(),
    response_text: z.string().min(1),
    gaps_identified: z.string().optional(),
  }).parse(req.body);
  const session = await repo.getSessionById(req.params.sessionId, req.user!.org_id!);
  if (!session) throw createError('Session not found', 404, 'NOT_FOUND');
  const response = await repo.upsertResponse({
    session_id: req.params.sessionId,
    ...body,
    submitted_by: req.user!.sub,
  });
  emitToTabletopSession(req.params.sessionId, 'tabletop:response_saved', {
    sessionId: req.params.sessionId,
    injectId: body.inject_id,
    response,
  });
  res.status(201).json(response);
});

router.patch('/sessions/:sessionId/complete', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const { notes } = z.object({ notes: z.string().optional() }).parse(req.body);
  const session = await repo.completeSession(req.params.sessionId, req.user!.org_id!, notes);
  if (!session) throw createError('Session not found', 404, 'NOT_FOUND');
  emitToTabletopSession(req.params.sessionId, 'tabletop:session_completed', { sessionId: req.params.sessionId });
  res.json(session);
});

router.get('/sessions/:sessionId/aar', authenticate, async (req: Request, res: Response) => {
  // Verify session belongs to org
  const session = await repo.getSessionById(req.params.sessionId, req.user!.org_id!);
  if (!session) throw createError('Session not found', 404, 'NOT_FOUND');
  const aar = await repo.getAAR(req.params.sessionId, req.user!.org_id!);
  res.json(aar ?? null);
});

router.put('/sessions/:sessionId/aar', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const body = z.object({
    strengths: z.string().optional(),
    weaknesses: z.string().optional(),
    gaps: z.string().optional(),
    recommendations: z.string().optional(),
    overall_rating: z.number().int().min(1).max(5).optional(),
  }).parse(req.body);
  const session = await repo.getSessionById(req.params.sessionId, req.user!.org_id!);
  if (!session) throw createError('Session not found', 404, 'NOT_FOUND');
  const aar = await repo.upsertAAR({
    session_id: req.params.sessionId,
    org_id: req.user!.org_id!,
    ...body,
    created_by: req.user!.sub,
  });
  res.json(aar);
});

// ─── Participants ─────────────────────────────────────────────────────────────

router.get('/exercises/:id/participants', authenticate, async (req: Request, res: Response) => {
  const exercise = await repo.getExerciseById(req.params.id, req.user!.org_id!);
  if (!exercise) throw createError('Exercise not found', 404, 'NOT_FOUND');
  const participants = await repo.listParticipants(req.params.id);
  res.json(participants);
});

router.post('/exercises/:id/participants', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const { user_id } = z.object({ user_id: z.string().uuid() }).parse(req.body);
  const exercise = await repo.getExerciseById(req.params.id, req.user!.org_id!);
  if (!exercise) throw createError('Exercise not found', 404, 'NOT_FOUND');
  const participant = await repo.addParticipant({
    exercise_id: req.params.id,
    user_id,
    added_by: req.user!.sub,
    org_id: req.user!.org_id!,
  });
  if (!participant) throw createError('User not found in org', 404, 'NOT_FOUND');
  res.status(201).json(participant);
});

router.delete('/exercises/:id/participants/:userId', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const exercise = await repo.getExerciseById(req.params.id, req.user!.org_id!);
  if (!exercise) throw createError('Exercise not found', 404, 'NOT_FOUND');
  const deleted = await repo.removeParticipant(req.params.id, req.params.userId);
  if (!deleted) throw createError('Participant not found', 404, 'NOT_FOUND');
  res.status(204).send();
});

// ─── Inject Release ───────────────────────────────────────────────────────────

router.post('/sessions/:sessionId/release/:injectId', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const session = await repo.getSessionById(req.params.sessionId, req.user!.org_id!);
  if (!session) throw createError('Session not found', 404, 'NOT_FOUND');
  const release = await repo.releaseInject({
    session_id: req.params.sessionId,
    inject_id: req.params.injectId,
    released_by: req.user!.sub,
  });
  // Get released_by name
  let releasedByName: string | undefined;
  if (req.user!.sub) {
    const userRow = await pool.query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub]);
    releasedByName = userRow.rows[0]?.name;
  }
  emitToTabletopSession(req.params.sessionId, 'tabletop:inject_released', {
    sessionId: req.params.sessionId,
    injectId: req.params.injectId,
    releasedAt: release?.released_at,
    releasedBy: req.user!.sub,
    releasedByName,
  });
  res.json(release);
});

// ─── AI Scenario Generation ────────────────────────────────────────────────────

router.post('/exercises/generate-scenario', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const { scenarioType } = z.object({
    scenarioType: z.enum(['ransomware', 'phishing', 'insider_threat', 'supply_chain', 'ddos', 'data_breach', 'apt']),
  }).parse(req.body);

  // Prefer org-stored key over env var
  let apiKey = process.env.ANTHROPIC_API_KEY;
  const orgKeyResult = await pool.query(
    "SELECT api_key FROM org_api_keys WHERE org_id = $1 AND service = 'anthropic' LIMIT 1",
    [req.user!.org_id],
  ).catch(() => ({ rows: [] as { api_key: string }[] }));
  if (orgKeyResult.rows.length > 0 && orgKeyResult.rows[0].api_key) {
    apiKey = orgKeyResult.rows[0].api_key;
  }
  if (!apiKey) {
    res.status(200).json({ error: 'ANTHROPIC_API_KEY not configured' });
    return;
  }

  const prompt = `You are a cybersecurity incident response expert creating a realistic tabletop exercise for a SOC team.

Create a detailed IR tabletop exercise scenario for a ${scenarioType} incident. Return ONLY valid JSON with this exact structure:
{
  "title": "Exercise title (concise, specific)",
  "scenario": "2-3 paragraph background scenario describing the situation, threat actor, initial indicators, and organizational context",
  "objectives": "3-5 learning objectives separated by newlines",
  "injects": [
    {
      "title": "Inject title",
      "description": "Detailed inject description with specific technical details, IoCs, or new information",
      "inject_type": "information|decision|complication|escalation|resolution",
      "trigger_minutes": 0,
      "expected_actions": "What the team should do in response",
      "discussion_prompts": "Discussion question 1\nDiscussion question 2\nDiscussion question 3"
    }
  ]
}

Include 5-7 injects that progress logically through the incident lifecycle. Use realistic technical details (IP addresses, domain names, file hashes, etc.). Vary inject types across the timeline. trigger_minutes should be cumulative (0, 10, 25, 40, etc.).`;

  let text: string;
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  } catch (err: unknown) {
    const msg = (err as Error)?.message ?? 'Anthropic API call failed';
    console.error('[tabletop/generate-scenario] Anthropic error:', msg);
    res.status(200).json({ error: `Anthropic API error: ${msg}` });
    return;
  }

  try {
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        res.json(JSON.parse(match[0]));
      } catch {
        console.error('[tabletop/generate-scenario] JSON parse failed, raw text:', text.slice(0, 200));
        res.status(500).json({ error: 'Failed to parse AI response', code: 'AI_PARSE_ERROR' });
      }
    } else {
      console.error('[tabletop/generate-scenario] No JSON found in response:', text.slice(0, 200));
      res.status(500).json({ error: 'Failed to parse AI response', code: 'AI_PARSE_ERROR' });
    }
  }
});

export default router;
