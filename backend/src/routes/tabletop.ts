import { Router, Request, Response } from 'express';
import { z } from 'zod';
// Separate v4 import solely for the Anthropic structured-output schema below —
// zodOutputFormat requires a zod/v4 schema; the rest of this file keeps using
// the classic `z` import so no other route is affected.
import { z as z4 } from 'zod/v4';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
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
  inject_type: z.string().transform(v => {
    const valid = ['information', 'decision', 'complication', 'escalation', 'resolution'];
    const lower = v.toLowerCase();
    return valid.includes(lower) ? lower : 'information';
  }),
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

// Mirrors the shape TabletopDetail.tsx expects back from this endpoint.
// Using this as an Anthropic structured-output schema (via zodOutputFormat)
// makes the response guaranteed-valid JSON matching this shape — the model
// can no longer return prose, markdown fences, or malformed JSON (e.g. a
// literal newline inside a string field instead of an escaped \n, which is
// what free-text generation would periodically produce for these multi-line
// scenario/objectives/discussion_prompts fields and break JSON.parse on).
const scenarioSchema = z4.object({
  title: z4.string(),
  scenario: z4.string(),
  objectives: z4.string(),
  injects: z4.array(z4.object({
    title: z4.string(),
    description: z4.string(),
    // Deliberately a plain string, not z4.enum(...): this SDK/zod version
    // renders enum constraints into the JSON schema's `description` instead
    // of a real `enum` array, so the model isn't actually constrained to the
    // 5 valid values at generation time — only the prompt text below is. A
    // strict enum here would then make client-side re-validation (which IS
    // strict) reject an out-of-range value and fail the whole generation.
    // TabletopDetail.tsx already normalizes any unrecognized value to
    // 'information' before saving, so a loose string here is safe.
    inject_type: z4.string(),
    trigger_minutes: z4.number(),
    expected_actions: z4.string(),
    discussion_prompts: z4.string(),
  })),
});

const SCENARIO_TYPE_LABELS: Record<string, string> = {
  ransomware: 'ransomware',
  phishing: 'phishing',
  insider_threat: 'insider threat',
  supply_chain: 'supply chain compromise',
  ddos: 'DDoS',
  data_breach: 'data breach',
  apt: 'advanced persistent threat (APT)',
  ot_ics_intrusion: 'OT/ICS network intrusion',
  ot_ransomware: 'OT-targeting ransomware with safety-system impact',
};

// Extra guidance folded into the prompt only for OT/ICS scenario types, so the
// model produces genuinely OT-flavored injects (protocols, field devices,
// physical process impact) instead of a generic IT scenario with "OT" in the
// title. IT-flavored IOCs (hashes, random internet domains) are still fine
// for the IT-side foothold/pivot — most real OT incidents start there.
const OT_GUIDANCE = `
This is an OT/ICS-focused exercise. Ground it in how a real industrial environment is actually attacked: an initial foothold on the IT/corporate network (phishing, VPN compromise, exposed RDP, etc.), then lateral movement across the IT/OT boundary (jump host, dual-homed engineering workstation, poorly segmented firewall rule) into the OT network. Use realistic OT/ICS details: industrial protocols (Modbus/TCP, DNP3, OPC-UA, EtherNet/IP, S7comm), PLC/RTU/HMI/engineering workstation/historian terminology, specific vendor-neutral device references (e.g. "the PLC controlling the feedwater pump", "the HMI in the control room"), and a safety instrumented system (SIS) or process safety angle where relevant. Reflect realistic consequences: process upset, unplanned shutdown, a safety interlock tripping, physical/environmental or safety risk — not just data loss. Include injects that force cross-functional decisions between the SOC/IR team and OT/engineering/plant operations staff (e.g. whether to take a system offline during active production, how to safely isolate OT without disrupting a physical process). Reference relevant ICS kill chain stages and, where natural, MITRE ATT&CK for ICS-style tactics (e.g. ICS reconnaissance, engineering workstation compromise, inhibit response function, impair process control).`;

router.post('/exercises/generate-scenario', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const { scenarioType } = z.object({
    scenarioType: z.enum(['ransomware', 'phishing', 'insider_threat', 'supply_chain', 'ddos', 'data_breach', 'apt', 'ot_ics_intrusion', 'ot_ransomware']),
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

  const isOt = scenarioType === 'ot_ics_intrusion' || scenarioType === 'ot_ransomware';
  const prompt = `You are a cybersecurity incident response expert creating a realistic tabletop exercise for a SOC team.

Create a detailed IR tabletop exercise scenario for a ${SCENARIO_TYPE_LABELS[scenarioType]} incident: a concise, specific title; a 2-3 paragraph background scenario describing the situation, threat actor, initial indicators, and organizational context; 3-5 learning objectives separated by newlines; and 7-18 injects that progress logically through the incident lifecycle, each with a title, a detailed description with specific technical details (IP addresses, domain names, file hashes, etc.), an inject type (one of: information, decision, complication, escalation, resolution), what the team is expected to do in response, and 2-3 discussion questions separated by newlines. Vary inject types across the timeline. trigger_minutes should be cumulative (0, 10, 25, 40, etc.).
${isOt ? OT_GUIDANCE : ''}`;

  const client = new Anthropic({ apiKey });
  let message: Awaited<ReturnType<typeof client.messages.parse>>;
  try {
    message = await client.messages.parse({
      model: 'claude-haiku-5-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(scenarioSchema) },
    });
  } catch (err: unknown) {
    const msg = (err as Error)?.message ?? 'Anthropic API call failed';
    console.error('[tabletop/generate-scenario] Anthropic error:', msg);
    res.status(200).json({ error: `Anthropic API error: ${msg}` });
    return;
  }

  if (message.stop_reason === 'max_tokens') {
    console.error('[tabletop/generate-scenario] Response truncated at max_tokens');
    res.status(200).json({ error: 'AI response was cut off before completing — please try again.' });
    return;
  }
  if (message.stop_reason === 'refusal') {
    console.error('[tabletop/generate-scenario] Model declined:', message.stop_details);
    res.status(200).json({ error: 'The model declined to generate this scenario. Try a different scenario type.' });
    return;
  }

  const parsed = message.parsed_output;
  if (!parsed) {
    console.error('[tabletop/generate-scenario] parsed_output was null, stop_reason:', message.stop_reason);
    res.status(500).json({ error: 'Failed to parse AI response', code: 'AI_PARSE_ERROR' });
    return;
  }
  res.json(parsed);
});

export default router;
