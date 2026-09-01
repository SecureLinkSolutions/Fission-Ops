import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { createError } from '../middleware/errorHandler';
import * as incidentRepo from '../repositories/incidentRepository';
import * as entityRepo from '../repositories/entityRepository';
import * as repo from '../repositories/yaraRepository';
import { buildYaraRuleText, validateYaraRule, YaraRuleInput } from '../services/yaraBuilder';
import { logAudit } from '../repositories/auditRepository';

const router = Router();

const stringDefSchema = z.object({
  identifier: z.string().min(1).max(128),
  type: z.enum(['text', 'hex', 'regex']),
  value: z.string().min(1),
  nocase: z.boolean().optional(),
  wide: z.boolean().optional(),
  ascii: z.boolean().optional(),
  fullword: z.boolean().optional(),
});

const hashesSchema = z.object({
  md5: z.string().optional(),
  sha1: z.string().optional(),
  sha256: z.string().optional(),
});

const ruleBodySchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  author: z.string().optional(),
  reference: z.string().optional(),
  tags: z.array(z.string()).optional(),
  strings: z.array(stringDefSchema).optional(),
  hashes: hashesSchema.optional(),
  condition: z.string().min(1),
  entity_id: z.string().uuid().optional(),
});

function toRuleInput(body: z.infer<typeof ruleBodySchema>): YaraRuleInput {
  return {
    name: body.name,
    description: body.description,
    author: body.author,
    reference: body.reference,
    tags: body.tags ?? [],
    strings: body.strings ?? [],
    hashes: body.hashes ?? {},
    condition: body.condition,
  };
}

// List rules for an incident
router.get('/incidents/:incidentId/yara-rules', authenticate, async (req: Request, res: Response) => {
  const incident = await incidentRepo.getIncidentById(req.params.incidentId);
  if (!incident) throw createError('Incident not found', 404, 'NOT_FOUND');
  const rules = await repo.listByIncident(req.params.incidentId);
  res.json(rules);
});

// Validate a draft rule and return the rendered text without saving — used for live preview
router.post('/incidents/:incidentId/yara-rules/preview', authenticate, async (req: Request, res: Response) => {
  const body = ruleBodySchema.parse(req.body);
  const input = toRuleInput(body);
  const errors = validateYaraRule(input);
  const rule_text = buildYaraRuleText(input);
  res.json({ errors, rule_text });
});

// Suggest starting values for a rule built from a file-type entity's known metadata
router.get('/incidents/:incidentId/yara-rules/suggest/:entityId', authenticate, async (req: Request, res: Response) => {
  const entity = await entityRepo.getEntityById(req.params.entityId);
  if (!entity || entity.incident_id !== req.params.incidentId) {
    throw createError('Entity not found', 404, 'NOT_FOUND');
  }
  const details = (entity.entity_details ?? {}) as Record<string, unknown>;
  const asString = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

  res.json({
    name: `Rule_${entity.value.replace(/[^a-zA-Z0-9_]/g, '_')}`.slice(0, 128),
    hashes: {
      md5: asString(details.md5),
      sha1: asString(details.sha1),
      sha256: asString(details.sha256),
    },
    suggestedStrings: [
      entity.value ? { identifier: 'filename', type: 'text' as const, value: entity.value, nocase: true } : null,
    ].filter((s): s is { identifier: string; type: 'text'; value: string; nocase: boolean } => s !== null),
  });
});

router.post('/incidents/:incidentId/yara-rules', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const incident = await incidentRepo.getIncidentById(req.params.incidentId);
  if (!incident) throw createError('Incident not found', 404, 'NOT_FOUND');

  const body = ruleBodySchema.parse(req.body);
  const input = toRuleInput(body);
  const errors = validateYaraRule(input);
  if (errors.length > 0) {
    res.status(400).json({ error: 'Rule validation failed', code: 'INVALID_YARA_RULE', details: errors });
    return;
  }

  const rule_text = buildYaraRuleText(input);
  const rule = await repo.createRule({
    incident_id: req.params.incidentId,
    entity_id: body.entity_id ?? null,
    name: body.name,
    description: body.description,
    author: body.author,
    reference: body.reference,
    tags: body.tags,
    strings: input.strings ?? [],
    hashes: input.hashes ?? {},
    condition: body.condition,
    rule_text,
    created_by: req.user!.sub,
  });

  res.status(201).json(rule);
  logAudit({
    user_id: req.user!.sub,
    user_email: req.user!.email,
    action: 'CREATE',
    resource_type: 'yara_rule',
    resource_id: rule.id,
    new_values: { name: rule.name },
    ip_address: req.ip,
  }).catch(() => {});
});

router.get('/yara-rules/:id', authenticate, async (req: Request, res: Response) => {
  const rule = await repo.getById(req.params.id);
  if (!rule) throw createError('YARA rule not found', 404, 'NOT_FOUND');
  res.json(rule);
});

router.put('/yara-rules/:id', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const existing = await repo.getById(req.params.id);
  if (!existing) throw createError('YARA rule not found', 404, 'NOT_FOUND');

  const body = ruleBodySchema.parse(req.body);
  const input = toRuleInput(body);
  const errors = validateYaraRule(input);
  if (errors.length > 0) {
    res.status(400).json({ error: 'Rule validation failed', code: 'INVALID_YARA_RULE', details: errors });
    return;
  }

  const rule_text = buildYaraRuleText(input);
  const rule = await repo.updateRule(req.params.id, {
    name: body.name,
    description: body.description,
    author: body.author,
    reference: body.reference,
    tags: body.tags,
    strings: input.strings ?? [],
    hashes: input.hashes ?? {},
    condition: body.condition,
    rule_text,
  });
  res.json(rule);
});

router.delete('/yara-rules/:id', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const deleted = await repo.deleteRule(req.params.id);
  if (!deleted) throw createError('YARA rule not found', 404, 'NOT_FOUND');
  res.status(204).send();
});

export default router;
