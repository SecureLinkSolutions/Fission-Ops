import { pool } from '../db/pool';

export interface TimelineEntry {
  ts: Date;
  user_id: string;
  user_email: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  description: string;
}

export async function getIncidentTimeline(
  incidentId: string,
  actionType?: string,
  userId?: string,
): Promise<TimelineEntry[]> {
  const result = await pool.query(
    `SELECT t.ts, t.user_id, u.email AS user_email, t.action_type, t.resource_type, t.resource_id, t.description
     FROM (
       SELECT e.created_at AS ts, e.created_by AS user_id, 'ENTITY_CREATED' AS action_type,
              'entity' AS resource_type, e.id::text AS resource_id,
              ('Added ' || e.type || ' entity: ' || e.value) AS description
       FROM entities e WHERE e.incident_id = $1

       UNION ALL

       SELECT ekm.mapped_at, ekm.mapped_by, 'KILL_CHAIN_MAPPED', 'kill_chain_mapping', ekm.id::text,
              ('Mapped ' || e.value || ' to stage: ' || kcs.name || ' (confidence: ' || ekm.confidence || ')')
       FROM entity_kill_chain_mappings ekm
       JOIN entities e ON e.id = ekm.entity_id
       JOIN kill_chain_stages kcs ON kcs.id = ekm.stage_id
       WHERE e.incident_id = $1

       UNION ALL

       SELECT est.created_at, est.created_by, 'TTP_ASSIGNED', 'ttp_assignment', est.id::text,
              ('Assigned TTP ' || t.technique_id || ' (' || t.name || ') to entity: ' || e.value)
       FROM entity_stage_ttps est
       JOIN entity_kill_chain_mappings ekm ON ekm.id = est.kill_chain_mapping_id
       JOIN entities e ON e.id = ekm.entity_id
       JOIN ttps t ON t.id = est.ttp_id
       WHERE e.incident_id = $1

       UNION ALL

       SELECT er.created_at, er.created_by, 'RELATIONSHIP_CREATED', 'relationship', er.id::text,
              (se.value || ' --[' || er.relationship_type || ']--> ' || te.value)
       FROM entity_relationships er
       JOIN entities se ON se.id = er.source_entity_id
       JOIN entities te ON te.id = er.target_entity_id
       WHERE er.incident_id = $1

       UNION ALL

       SELECT bt.created_at, bt.created_by, 'BOUNDARY_TRAVERSAL', 'boundary_traversal', bt.id::text,
              ('Traversal: ' || sb.name || ' → ' || tb.name || COALESCE(': ' || bt.label, ''))
       FROM boundary_traversals bt
       JOIN network_boundaries sb ON sb.id = bt.source_boundary_id
       JOIN network_boundaries tb ON tb.id = bt.target_boundary_id
       WHERE bt.incident_id = $1

       UNION ALL

       SELECT e.ioc_flagged_at, e.ioc_flagged_by, 'IOC_STATUS_CHANGED', 'entity', e.id::text,
              ('Marked ' || e.value || ' as ' || e.ioc_status || ' IOC' || COALESCE(' — ' || e.ioc_notes, ''))
       FROM entities e
       WHERE e.incident_id = $1 AND e.ioc_flagged_by IS NOT NULL
     ) t
     JOIN users u ON u.id = t.user_id
     WHERE ($2::text IS NULL OR t.action_type = $2::text)
       AND ($3::text IS NULL OR t.user_id = $3::uuid)
     ORDER BY ts DESC
     LIMIT 500`,
    [incidentId, actionType ?? null, userId ?? null],
  );

  return result.rows;
}
