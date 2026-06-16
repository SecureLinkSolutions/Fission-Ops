import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { killChainMappingSchema } from '../schemas/mapping';
import * as repo from '../repositories/killChainRepository';
import * as entityRepo from '../repositories/entityRepository';
import { createError } from '../middleware/errorHandler';
import { ttpMappingRouter } from './ttps';
import { pool } from '../db/pool';
import * as suggestionRepo from '../repositories/ttpSuggestionRepository';
import { recordCustody } from '../repositories/custodyRepository';

const router = Router();

const frameworkSchema = z.enum(['lockheed_martin', 'mitre_attack', 'mitre_ics']).optional();

router.get('/kill-chain/stages', authenticate, async (req: Request, res: Response) => {
  const framework = frameworkSchema.parse(req.query.framework);
  const stages = await repo.listStages(framework);
  res.json(stages);
});

router.post('/entities/:entityId/kill-chain', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const entity = await entityRepo.getEntityById(req.params.entityId);
  if (!entity) throw createError('Entity not found', 404, 'NOT_FOUND');
  const body = killChainMappingSchema.parse(req.body);
  const mapping = await repo.mapEntityToStage({ ...body, entity_id: req.params.entityId, mapped_by: req.user!.sub });
  res.status(201).json(mapping);
  recordCustody({
    entity_id: req.params.entityId,
    incident_id: entity.incident_id,
    action: 'kill_chain_mapped',
    actor_id: req.user!.sub,
    actor_name: req.user!.email,
    actor_role: req.user!.role,
    actor_ip: req.ip,
    details: { stage_id: body.stage_id, confidence: body.confidence },
  }).catch(() => {});
});

router.patch('/entities/:entityId/kill-chain/:mappingId', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const { stage_id } = z.object({ stage_id: z.string().uuid() }).parse(req.body);
  const mapping = await repo.updateMappingStage(req.params.mappingId, stage_id, req.user!.sub);
  if (!mapping) throw createError('Mapping not found', 404, 'NOT_FOUND');
  res.json(mapping);
});

router.delete('/entities/:entityId/kill-chain/:mappingId', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const deleted = await repo.removeMappingById(req.params.mappingId);
  if (!deleted) throw createError('Mapping not found', 404, 'NOT_FOUND');
  res.status(204).send();
});

router.get('/incidents/:incidentId/kill-chain/matrix', authenticate, async (req: Request, res: Response) => {
  const matrix = await repo.getKillChainMatrix(req.params.incidentId);
  res.json(matrix);
});

router.post('/incidents/:incidentId/kill-chain/narrative', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  // Prefer org-stored key over environment variable
  let apiKey = process.env.ANTHROPIC_API_KEY;
  const orgKeyResult = await pool.query(
    "SELECT api_key FROM org_api_keys WHERE service = 'anthropic' ORDER BY updated_at DESC LIMIT 1",
  ).catch(() => ({ rows: [] as { api_key: string }[] }));
  if (orgKeyResult.rows.length > 0 && orgKeyResult.rows[0].api_key) {
    apiKey = orgKeyResult.rows[0].api_key;
  }
  if (!apiKey) {
    res.status(200).json({ narrative: null, error: 'ANTHROPIC_API_KEY not configured' });
    return;
  }

  const { incidentId } = req.params;

  // Fetch incident details
  const incidentResult = await pool.query(
    'SELECT title, description, severity, status FROM incidents WHERE id = $1',
    [incidentId],
  );
  if (incidentResult.rowCount === 0) throw createError('Incident not found', 404, 'NOT_FOUND');
  const incident = incidentResult.rows[0] as { title: string; description?: string; severity: string; status: string };

  // Fetch kill chain matrix with enrichment
  const matrix = await repo.getKillChainMatrix(incidentId);

  // Fetch entity relationships
  const relResult = await pool.query(
    `SELECT er.relationship_type, er.bidirectional, er.notes,
            se.value AS source_value, se.type AS source_type,
            te.value AS target_value, te.type AS target_type
     FROM entity_relationships er
     JOIN entities se ON se.id = er.source_entity_id
     JOIN entities te ON te.id = er.target_entity_id
     WHERE se.incident_id = $1 OR te.incident_id = $1`,
    [incidentId],
  );

  // Group matrix rows by stage
  const stageMap = new Map<string, { stageName: string; orderIndex: number; entities: typeof matrix }>();
  for (const row of matrix) {
    if (!stageMap.has(row.stage_id)) {
      stageMap.set(row.stage_id, { stageName: row.stage_name, orderIndex: row.order_index, entities: [] });
    }
    stageMap.get(row.stage_id)!.entities.push(row);
  }
  const stages = [...stageMap.values()].sort((a, b) => a.orderIndex - b.orderIndex);

  // Build prompt
  const stagesText = stages.map(({ stageName, entities }) => {
    const entLines = entities.map((e) => {
      const d = (e.entity_details ?? {}) as Record<string, unknown>;
      const enrichParts: string[] = [];
      if (d.ti_isp) enrichParts.push(`ISP: ${d.ti_isp}`);
      if (d.ti_asn) enrichParts.push(`ASN: ${d.ti_asn}`);
      if (d.ti_country) enrichParts.push(`Country: ${d.ti_country}`);
      if (d.ti_ports) enrichParts.push(`Ports: ${d.ti_ports}`);
      if (d.registrar) enrichParts.push(`Registrar: ${d.registrar}`);
      if (d.registration_date) enrichParts.push(`Registered: ${d.registration_date}`);
      if (d.a_records) enrichParts.push(`A records: ${d.a_records}`);
      if (d.sha256) enrichParts.push(`SHA256: ${String(d.sha256).substring(0, 16)}...`);
      if (d.file_type) enrichParts.push(`Type: ${d.file_type}`);
      if (d.os) enrichParts.push(`OS: ${d.os}`);
      if (d.ip_address) enrichParts.push(`IP: ${d.ip_address}`);
      const enrichStr = enrichParts.length > 0 ? ` (${enrichParts.join(', ')})` : '';
      const iocStr = e.ioc_status === 'confirmed' ? ' [CONFIRMED IOC]' : e.ioc_status === 'suspected' ? ' [SUSPECTED IOC]' : e.ioc_status === 'false_positive' ? ' [FALSE POSITIVE]' : '';
      const ttpStr = (e.ttps ?? []).length > 0 ? `\n    TTPs: ${e.ttps.map((t) => `${t.technique_id} - ${t.name}`).join(', ')}` : '';
      return `  - ${e.type} ${e.value}${enrichStr}${iocStr}\n    Confidence: ${e.confidence}${ttpStr}`;
    }).join('\n');
    return `Stage: ${stageName}\n${entLines}`;
  }).join('\n\n');

  const relText = relResult.rows.length > 0
    ? relResult.rows.map((r: { source_type: string; source_value: string; relationship_type: string; target_type: string; target_value: string; bidirectional: boolean }) =>
        `${r.source_type} ${r.source_value} ${r.relationship_type}${r.bidirectional ? ' <-> ' : ' -> '}${r.target_type} ${r.target_value}`,
      ).join('\n')
    : 'No relationships recorded.';

  const prompt = `You are a cybersecurity analyst writing an incident report narrative. Based on the following kill chain mapping data for incident "${incident.title}", write a cohesive 2-4 paragraph attack narrative that explains what happened, using specific entity details and their relationships. Focus on telling the story of the attack progression through the kill chain stages.

Incident: ${incident.title} (Severity: ${incident.severity})
${incident.description ? `Description: ${incident.description}` : ''}

Kill Chain Mappings:
${stagesText || 'No entities mapped to kill chain stages.'}

Entity Relationships:
${relText}

Write the narrative in past tense, third person. Be specific and technical. Don't pad with generic statements. Use the actual entity values (IPs, domains, filenames) throughout the narrative.`;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const narrative = message.content[0].type === 'text' ? message.content[0].text : '';
  res.json({ narrative });
});

// TTP co-occurrence suggestions
router.get('/incidents/:incidentId/ttp-suggestions', authenticate, async (req: Request, res: Response) => {
  const { technique_id } = z.object({ technique_id: z.string().min(1) }).parse(req.query);

  // Get all techniques already assigned on this incident
  const assignedResult = await pool.query(
    `SELECT DISTINCT t.technique_id
     FROM entity_stage_ttps est
     JOIN ttps t ON t.id = est.ttp_id
     JOIN entity_kill_chain_mappings ekm ON ekm.id = est.mapping_id
     JOIN entities e ON e.id = ekm.entity_id
     WHERE e.incident_id = $1`,
    [req.params.incidentId],
  );
  const alreadyAssigned = assignedResult.rows.map((r: { technique_id: string }) => r.technique_id);

  const suggestions = await suggestionRepo.getSuggestionsForTechnique(technique_id, alreadyAssigned);
  res.json(suggestions);
});

router.post('/incidents/:incidentId/ttp-suggestions/log', authenticate, async (req: Request, res: Response) => {
  const body = z.object({
    suggested_technique_id: z.string(),
    trigger_technique_id: z.string(),
    action: z.enum(['accepted', 'dismissed']),
    entity_id: z.string().uuid(),
  }).parse(req.body);

  await suggestionRepo.logSuggestion({
    incident_id: req.params.incidentId,
    entity_id: body.entity_id,
    suggested_technique_id: body.suggested_technique_id,
    trigger_technique_id: body.trigger_technique_id,
    action: body.action,
    user_id: req.user!.sub,
  });
  res.json({ ok: true });
});

router.use('/entities/:entityId/kill-chain/:mappingId/ttps', ttpMappingRouter);

export default router;
