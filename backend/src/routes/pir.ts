import { Router, Request, Response } from 'express';
import { z } from 'zod';
// pdfmake v0.3.x server-side: Printer lives in js/Printer.js (ESM default export).
// Same pattern as routes/report.ts — keep both files' PDF conventions in sync.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake/js/Printer').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const URLResolver = require('pdfmake/js/URLResolver').default;
import { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { createError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import * as incidentRepo from '../repositories/incidentRepository';
import * as entityRepo from '../repositories/entityRepository';
import * as killChainRepo from '../repositories/killChainRepository';
import * as boundaryRepo from '../repositories/boundaryRepository';
import * as boundaryTraversalRepo from '../repositories/boundaryTraversalRepository';
import * as relationshipRepo from '../repositories/relationshipRepository';
import * as taskRepo from '../repositories/taskRepository';
import { getRemediationProgress } from '../repositories/remediationRepository';
import { getIncidentTimeline } from '../repositories/timelineRepository';

const router = Router();

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};
// See routes/report.ts for why a urlResolver is required here even though
// these are plain built-in font names, not remote files.
const printer = new PdfPrinter(fonts, undefined, new URLResolver(undefined));

// ─── Narrative CRUD ─────────────────────────────────────────────────────────

router.get('/:id/pir', authenticate, async (req: Request, res: Response) => {
  const result = await pool.query(
    'SELECT * FROM incident_pir_reports WHERE incident_id = $1',
    [req.params.id],
  );
  res.json(result.rows[0] ?? null);
});

const pirSchema = z.object({
  template: z.enum(['full', 'executive']).optional(),
  prepared_by: z.string().optional(),
  classification: z.string().optional(),
  executive_summary: z.string().optional(),
  root_cause: z.string().optional(),
  impact_assessment: z.string().optional(),
  response_summary: z.string().optional(),
  lessons_learned: z.string().optional(),
  recommendations: z.string().optional(),
});

router.put('/:id/pir', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const body = pirSchema.parse(req.body);
  const result = await pool.query(
    `INSERT INTO incident_pir_reports
       (incident_id, template, prepared_by, classification, executive_summary, root_cause, impact_assessment, response_summary, lessons_learned, recommendations, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (incident_id) DO UPDATE SET
       template = EXCLUDED.template,
       prepared_by = EXCLUDED.prepared_by,
       classification = EXCLUDED.classification,
       executive_summary = EXCLUDED.executive_summary,
       root_cause = EXCLUDED.root_cause,
       impact_assessment = EXCLUDED.impact_assessment,
       response_summary = EXCLUDED.response_summary,
       lessons_learned = EXCLUDED.lessons_learned,
       recommendations = EXCLUDED.recommendations,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [
      req.params.id,
      body.template ?? 'full',
      body.prepared_by ?? null,
      body.classification ?? null,
      body.executive_summary ?? null,
      body.root_cause ?? null,
      body.impact_assessment ?? null,
      body.response_summary ?? null,
      body.lessons_learned ?? null,
      body.recommendations ?? null,
      req.user!.sub,
    ],
  );
  res.json(result.rows[0]);
});

// ─── PDF export ─────────────────────────────────────────────────────────────

interface TimelineRow { ts: Date; user_email: string; action_type: string; description: string; }
interface KillChainRow { stage_name: string; value: string; type: string; confidence: string; }
interface TaskRow { title: string; description?: string; assignee_name?: string; assignee_email?: string; priority: string; status: string; due_date?: string; completed_at?: string; created_at: string; }
interface EntityRow { type: string; value: string; notes?: string; entity_details?: Record<string, unknown>; status?: string; ioc_status?: string; }
interface RelationshipRow { source_value?: string; relationship_type: string; target_value?: string; bidirectional?: boolean; }
interface BoundaryRow { id: string; name: string; zone_type: string; }
interface ZoneAssignmentRow { boundary_id: string; entity_value: string; entity_type: string; }
interface TraversalRow { source_boundary_name: string; target_boundary_name: string; label?: string; }

function narrativeSection(title: string, body?: string | null): Content[] {
  return [
    { text: title, style: 'sectionHeader' },
    { text: body && body.trim() ? body : 'Not documented.', style: body && body.trim() ? undefined : 'muted', margin: [0, 0, 0, 4] },
  ];
}

router.get('/:id/pir-report', authenticate, async (req: Request, res: Response) => {
  const incident = await incidentRepo.getIncidentById(req.params.id);
  if (!incident) throw createError('Incident not found', 404, 'NOT_FOUND');

  const pirResult = await pool.query('SELECT * FROM incident_pir_reports WHERE incident_id = $1', [req.params.id]);
  const pir = pirResult.rows[0] ?? null;

  const templateParam = req.query.template;
  const template: 'full' | 'executive' =
    templateParam === 'full' || templateParam === 'executive' ? templateParam
    : (pir?.template === 'executive' ? 'executive' : 'full');
  const isFull = template === 'full';

  const [entities, timeline, matrix, relationships, tasks, remediation, boundaries, traversals, zoneAssignments] = await Promise.all([
    entityRepo.listEntitiesByIncident(incident.id) as Promise<EntityRow[]>,
    getIncidentTimeline(incident.id) as unknown as Promise<TimelineRow[]>,
    killChainRepo.getKillChainMatrix(incident.id) as unknown as Promise<KillChainRow[]>,
    relationshipRepo.listRelationships(incident.id) as unknown as Promise<RelationshipRow[]>,
    taskRepo.listForIncident(incident.id) as unknown as Promise<TaskRow[]>,
    getRemediationProgress(incident.id),
    boundaryRepo.listBoundaries(incident.id) as unknown as Promise<BoundaryRow[]>,
    boundaryTraversalRepo.listBoundaryTraversals(incident.id) as unknown as Promise<TraversalRow[]>,
    boundaryTraversalRepo.listEntityZoneAssignments(incident.id) as unknown as Promise<ZoneAssignmentRow[]>,
  ]);

  // ── Header ──
  const headerRows: TableCell[][] = [
    [{ text: 'Severity', style: 'label' }, incident.severity.toUpperCase()],
    [{ text: 'Status', style: 'label' }, incident.status.toUpperCase()],
    [{ text: 'Detected', style: 'label' }, new Date(incident.created_at).toLocaleString()],
    [{ text: 'Last Updated', style: 'label' }, new Date(incident.updated_at).toLocaleString()],
  ];
  if (pir?.classification) headerRows.push([{ text: 'Classification', style: 'label' }, pir.classification]);
  if (pir?.prepared_by) headerRows.push([{ text: 'Prepared By', style: 'label' }, pir.prepared_by]);
  headerRows.push([{ text: 'Report Generated', style: 'label' }, new Date().toLocaleString()]);
  headerRows.push([{ text: 'Template', style: 'label' }, isFull ? 'Full Technical Report' : 'Executive Briefing']);

  const content: Content[] = [
    { text: 'Post-Incident Report', style: 'header' },
    { text: incident.title, style: 'title' },
    {
      table: { widths: ['auto', '*'], body: headerRows },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 16],
    },
    ...narrativeSection('Executive Summary', pir?.executive_summary),
    ...narrativeSection('Impact Assessment', pir?.impact_assessment),
  ];

  if (isFull) {
    content.push(...narrativeSection('Root Cause', pir?.root_cause));
    content.push(...narrativeSection('Response Summary', pir?.response_summary));
  }

  content.push(...narrativeSection('Lessons Learned', pir?.lessons_learned));
  content.push(...narrativeSection('Recommendations', pir?.recommendations));

  // ── Remediation progress (both templates, one line) ──
  content.push({ text: 'Remediation Progress', style: 'sectionHeader' });
  content.push({
    text: remediation.total > 0
      ? `${remediation.verified} of ${remediation.total} remediation item(s) verified complete.`
      : 'No remediation items recorded.',
    margin: [0, 0, 0, 8],
  });

  // ── Timeline (full = every event; executive = condensed) ──
  content.push({ text: 'Incident Timeline', style: 'sectionHeader' });
  if (timeline.length === 0) {
    content.push({ text: 'No timeline events recorded.', style: 'muted' });
  } else if (isFull) {
    content.push({
      table: {
        widths: ['auto', 'auto', 'auto', '*'],
        body: [
          [{ text: 'Time', bold: true }, { text: 'Type', bold: true }, { text: 'Actor', bold: true }, { text: 'Description', bold: true }],
          ...timeline.map((e) => [
            new Date(e.ts).toLocaleString(),
            (e.action_type ?? '').replace(/_/g, ' '),
            e.user_email ?? 'unknown',
            e.description ?? '',
          ]),
        ] as TableCell[][],
      },
      layout: 'lightHorizontalLines',
      fontSize: 9,
      margin: [0, 0, 0, 12],
    } as Content);
  } else {
    // Condensed: one representative entry per action_type (the earliest), plus a
    // "+N more events" note so the executive briefing shows the shape of the
    // incident's activity without a full granular log.
    const seen = new Set<string>();
    const milestones: TimelineRow[] = [];
    for (const e of [...timeline].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())) {
      if (!seen.has(e.action_type)) { seen.add(e.action_type); milestones.push(e); }
    }
    content.push({
      table: {
        widths: ['auto', 'auto', '*'],
        body: [
          [{ text: 'Time', bold: true }, { text: 'Type', bold: true }, { text: 'Description', bold: true }],
          ...milestones.map((e) => [
            new Date(e.ts).toLocaleString(),
            (e.action_type ?? '').replace(/_/g, ' '),
            e.description ?? '',
          ]),
        ] as TableCell[][],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 4],
    } as Content);
    const remainingCount = timeline.length - milestones.length;
    if (remainingCount > 0) {
      content.push({ text: `+${remainingCount} more event(s) in the full report.`, style: 'muted', margin: [0, 0, 0, 12] });
    }
  }

  if (isFull) {
    // ── Entity inventory, grouped by type ──
    content.push({ text: 'Entity Inventory', style: 'sectionHeader' });
    if (entities.length === 0) {
      content.push({ text: 'No entities recorded.', style: 'muted' });
    } else {
      const entityTypes = [...new Set(entities.map((e) => e.type))];
      for (const type of entityTypes) {
        const typeEntities = entities.filter((e) => e.type === type);
        content.push({ text: type.charAt(0).toUpperCase() + type.slice(1), style: 'subHeader' });
        content.push({
          table: {
            widths: ['*', 'auto', '*'],
            body: [
              [{ text: 'Value', bold: true }, { text: 'IOC Status', bold: true }, { text: 'Notes', bold: true }],
              ...typeEntities.map((e) => [e.value, e.ioc_status ?? e.status ?? '', e.notes ?? '']),
            ] as TableCell[][],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 12],
        } as Content);
      }
    }

    // ── Kill chain breakdown ──
    content.push({ text: 'Kill Chain Breakdown', style: 'sectionHeader' });
    if (matrix.length === 0) {
      content.push({ text: 'No kill chain mappings recorded.', style: 'muted' });
    } else {
      const stageMap = new Map<string, KillChainRow[]>();
      for (const row of matrix) {
        if (!stageMap.has(row.stage_name)) stageMap.set(row.stage_name, []);
        stageMap.get(row.stage_name)!.push(row);
      }
      for (const [stageName, rows] of stageMap.entries()) {
        content.push({ text: stageName, style: 'subHeader' });
        for (const r of rows) {
          content.push({ text: `• [${r.type}] ${r.value} — confidence: ${r.confidence}`, margin: [8, 2, 0, 2] });
        }
      }
    }

    // ── Relationships ──
    content.push({ text: 'Entity Relationships', style: 'sectionHeader' });
    if (relationships.length === 0) {
      content.push({ text: 'No relationships recorded.', style: 'muted' });
    } else {
      content.push({
        table: {
          widths: ['*', 'auto', '*'],
          body: [
            [{ text: 'Source', bold: true }, { text: 'Relationship', bold: true }, { text: 'Target', bold: true }],
            ...relationships.map((r) => [r.source_value ?? '', r.relationship_type, r.target_value ?? '']),
          ] as TableCell[][],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12],
      } as Content);
    }

    // ── Response actions / tasks ──
    content.push({ text: 'Response Actions', style: 'sectionHeader' });
    if (tasks.length === 0) {
      content.push({ text: 'No tasks recorded.', style: 'muted' });
    } else {
      content.push({
        table: {
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            [{ text: 'Task', bold: true }, { text: 'Assignee', bold: true }, { text: 'Priority', bold: true }, { text: 'Status', bold: true }],
            ...tasks.map((t) => [t.title, t.assignee_name ?? t.assignee_email ?? 'Unassigned', t.priority, t.status.replace(/_/g, ' ')]),
          ] as TableCell[][],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12],
      } as Content);
    }

    // ── Network boundary summary ──
    content.push({ text: 'Network Boundary Summary', style: 'sectionHeader' });
    if (boundaries.length === 0) {
      content.push({ text: 'No network boundaries defined.', style: 'muted' });
    } else {
      for (const boundary of boundaries) {
        const residents = zoneAssignments.filter((z) => z.boundary_id === boundary.id);
        content.push({ text: `${boundary.name} (${boundary.zone_type})`, style: 'subHeader' });
        if (residents.length > 0) {
          residents.forEach((r) => content.push({ text: `  • [${r.entity_type}] ${r.entity_value}`, margin: [8, 1, 0, 1] }));
        } else {
          content.push({ text: '  No entities assigned.', style: 'muted' });
        }
      }
      if (traversals.length > 0) {
        content.push({ text: 'Traversals', style: 'subHeader' });
        content.push({
          table: {
            widths: ['*', 'auto', '*'],
            body: [
              [{ text: 'Source', bold: true }, { text: 'Label', bold: true }, { text: 'Target', bold: true }],
              ...traversals.map((t) => [t.source_boundary_name, t.label ?? '', t.target_boundary_name]),
            ] as TableCell[][],
          },
          layout: 'lightHorizontalLines',
        } as Content);
      }
    }
  }

  const docDefinition: TDocumentDefinitions = {
    defaultStyle: { font: 'Helvetica', fontSize: 10 },
    styles: {
      header: { fontSize: 20, bold: true, margin: [0, 0, 0, 4] },
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 12] },
      sectionHeader: { fontSize: 14, bold: true, margin: [0, 16, 0, 8], decoration: 'underline' },
      subHeader: { fontSize: 11, bold: true, margin: [0, 8, 0, 4] },
      label: { bold: true },
      muted: { color: '#666666', italics: true },
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: '#999999',
      margin: [0, 8, 0, 0],
    }),
    content,
  };

  // pdfmake 0.3.x made this async (it used to return the document directly).
  const pdfDoc = await printer.createPdfKitDocument(docDefinition);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="pir-report-${incident.id}.pdf"`);
  pdfDoc.pipe(res);
  pdfDoc.end();
});

export default router;
