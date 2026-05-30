import { Router, Request, Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake');
import { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { authenticate } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import * as incidentRepo from '../repositories/incidentRepository';
import * as entityRepo from '../repositories/entityRepository';
import * as killChainRepo from '../repositories/killChainRepository';
import * as boundaryRepo from '../repositories/boundaryRepository';
import * as boundaryTraversalRepo from '../repositories/boundaryTraversalRepository';
import * as relationshipRepo from '../repositories/relationshipRepository';
import * as ttpRepo from '../repositories/ttpRepository';

const router = Router();

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const printer = new PdfPrinter(fonts);

router.get('/:id/report', authenticate, async (req: Request, res: Response) => {
  const incident = await incidentRepo.getIncidentById(req.params.id);
  if (!incident) throw createError('Incident not found', 404, 'NOT_FOUND');

  const [entities, matrix, boundaries, traversals, relationships, ttps] = await Promise.all([
    entityRepo.listEntitiesByIncident(incident.id),
    killChainRepo.getKillChainMatrix(incident.id),
    boundaryRepo.listBoundaries(incident.id),
    boundaryTraversalRepo.listBoundaryTraversals(incident.id),
    relationshipRepo.listRelationships(incident.id),
    ttpRepo.getTtpsByIncident(incident.id),
  ]);

  // Section 1: Incident Overview
  const overviewSection: Content[] = [
    { text: 'Incident Report', style: 'header' },
    { text: incident.title, style: 'title' },
    {
      table: {
        widths: ['auto', '*'],
        body: [
          [{ text: 'Severity', style: 'label' }, incident.severity.toUpperCase()],
          [{ text: 'Status', style: 'label' }, incident.status.toUpperCase()],
          [{ text: 'Created', style: 'label' }, new Date(incident.created_at).toLocaleString()],
          [{ text: 'Updated', style: 'label' }, new Date(incident.updated_at).toLocaleString()],
          ...(incident.description ? [[{ text: 'Description', style: 'label' }, incident.description]] : []),
        ] as TableCell[][],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 16],
    },
  ];

  // Section 2: Entities by Type
  const entityTypes = [...new Set((entities as { type: string }[]).map((e) => e.type))];
  const entitiesSection: Content[] = [
    { text: 'Entities', style: 'sectionHeader' },
  ];
  if (entities.length === 0) {
    entitiesSection.push({ text: 'No entities recorded.', style: 'muted' } as Content);
  } else {
    for (const type of entityTypes) {
      const typeEntities = (entities as { type: string; value: string; notes?: string; entity_details?: unknown }[]).filter((e) => e.type === type);
      entitiesSection.push({ text: type.charAt(0).toUpperCase() + type.slice(1), style: 'subHeader' } as Content);
      entitiesSection.push({
        table: {
          widths: ['*', '*', '*'],
          body: [
            [{ text: 'Value', bold: true }, { text: 'Notes', bold: true }, { text: 'Details', bold: true }],
            ...typeEntities.map((e) => [
              e.value,
              e.notes ?? '',
              e.entity_details ? JSON.stringify(e.entity_details) : '',
            ]),
          ] as TableCell[][],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12],
      } as Content);
    }
  }

  // Section 3: Kill Chain Breakdown
  const matrixRows = matrix as { stage_name: string; entity_id: string; value: string; type: string; confidence: string; mapping_id: string }[];
  const stageMap = new Map<string, typeof matrixRows>();
  for (const row of matrixRows) {
    const key = row.stage_name;
    if (!stageMap.has(key)) stageMap.set(key, []);
    stageMap.get(key)!.push(row);
  }
  const ttpRows = ttps as { mapping_id?: string; kill_chain_mapping_id?: string; technique_id: string; name: string; tactic: string }[];

  const killChainSection: Content[] = [
    { text: 'Kill Chain Breakdown', style: 'sectionHeader' },
  ];
  if (matrixRows.length === 0) {
    killChainSection.push({ text: 'No kill chain mappings recorded.', style: 'muted' } as Content);
  } else {
    for (const [stageName, stageEntities] of stageMap.entries()) {
      killChainSection.push({ text: stageName, style: 'subHeader' } as Content);
      for (const ent of stageEntities) {
        const entTtps = ttpRows.filter((t) => (t as unknown as { entity_value?: string }).entity_value === ent.value);
        const ttpText = entTtps.length > 0 ? `  TTPs: ${entTtps.map((t) => `${t.technique_id} (${t.name})`).join(', ')}` : '';
        killChainSection.push({
          text: `• [${ent.type}] ${ent.value} — confidence: ${ent.confidence}${ttpText}`,
          margin: [8, 2, 0, 2],
        } as Content);
      }
    }
  }

  // Section 4: Network Boundary Summary
  const boundarySection: Content[] = [
    { text: 'Network Boundary Summary', style: 'sectionHeader' },
  ];
  const zoneAssignments = await boundaryTraversalRepo.listEntityZoneAssignments(incident.id);
  const zoneRows = zoneAssignments as { boundary_id: string; boundary_name: string; zone_type: string; entity_value: string; entity_type: string }[];
  const traversalRows = traversals as { source_boundary_name: string; target_boundary_name: string; label?: string }[];

  if ((boundaries as { id: string; name: string; zone_type: string }[]).length === 0) {
    boundarySection.push({ text: 'No network boundaries defined.', style: 'muted' } as Content);
  } else {
    for (const boundary of boundaries as { id: string; name: string; zone_type: string }[]) {
      const residents = zoneRows.filter((z) => z.boundary_id === boundary.id);
      boundarySection.push({ text: `${boundary.name} (${boundary.zone_type})`, style: 'subHeader' } as Content);
      if (residents.length > 0) {
        residents.forEach((r) => {
          boundarySection.push({ text: `  • [${r.entity_type}] ${r.entity_value}`, margin: [8, 1, 0, 1] } as Content);
        });
      } else {
        boundarySection.push({ text: '  No entities assigned.', style: 'muted' } as Content);
      }
    }
    if (traversalRows.length > 0) {
      boundarySection.push({ text: 'Traversals', style: 'subHeader' } as Content);
      boundarySection.push({
        table: {
          widths: ['*', 'auto', '*'],
          body: [
            [{ text: 'Source', bold: true }, { text: 'Label', bold: true }, { text: 'Target', bold: true }],
            ...traversalRows.map((t) => [t.source_boundary_name, t.label ?? '', t.target_boundary_name]),
          ] as TableCell[][],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12],
      } as Content);
    }
  }

  // Section 5: Entity Relationships
  const relSection: Content[] = [
    { text: 'Entity Relationships', style: 'sectionHeader' },
  ];
  if (relationships.length === 0) {
    relSection.push({ text: 'No relationships recorded.', style: 'muted' } as Content);
  } else {
    relSection.push({
      table: {
        widths: ['*', 'auto', '*'],
        body: [
          [{ text: 'Source', bold: true }, { text: 'Relationship', bold: true }, { text: 'Target', bold: true }],
          ...relationships.map((r) => [r.source_value ?? '', r.relationship_type, r.target_value ?? '']),
        ] as TableCell[][],
      },
      layout: 'lightHorizontalLines',
    } as Content);
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
    content: [
      ...overviewSection,
      ...entitiesSection,
      ...killChainSection,
      ...boundarySection,
      ...relSection,
    ],
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="incident-${incident.id}.pdf"`);

  pdfDoc.pipe(res);
  pdfDoc.end();
});

export default router;
