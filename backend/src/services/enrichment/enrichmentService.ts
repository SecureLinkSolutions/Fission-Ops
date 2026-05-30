import { pool } from '../../db/pool';
import { queryVirusTotal } from './virustotal';
import { queryAbuseIPDB } from './abuseipdb';
import { queryShodan } from './shodan';
import { emitToIncident } from '../../socket';

export async function runEnrichment(entityId: string, orgId: string): Promise<void> {
  // Mark as running
  await pool.query(
    `UPDATE entities SET enrichment_status = 'running' WHERE id = $1`,
    [entityId],
  );

  const entityResult = await pool.query('SELECT * FROM entities WHERE id = $1', [entityId]);
  const entity = entityResult.rows[0];
  if (!entity) return;

  // Fetch API keys for this org
  const keysResult = await pool.query(
    'SELECT service, api_key FROM org_api_keys WHERE org_id = $1',
    [orgId],
  );
  const keys: Record<string, string> = {};
  for (const row of keysResult.rows) {
    keys[row.service] = row.api_key;
  }

  if (!keys['virustotal'] && !keys['abuseipdb'] && !keys['shodan']) {
    await pool.query(
      `UPDATE entities SET enrichment_status = 'skipped', enrichment_updated_at = NOW() WHERE id = $1`,
      [entityId],
    );
    return;
  }

  const enrichmentData: Record<string, unknown> = {};

  // VirusTotal — ip, domain, hostname
  if (keys['virustotal'] && ['ip', 'domain', 'hostname'].includes(entity.type)) {
    const vtResult = await queryVirusTotal(keys['virustotal'], entity.type, entity.value);
    if (vtResult) enrichmentData.virustotal = vtResult;
  }

  // AbuseIPDB — ip only
  if (keys['abuseipdb'] && entity.type === 'ip') {
    const abuseResult = await queryAbuseIPDB(keys['abuseipdb'], entity.value);
    if (abuseResult) enrichmentData.abuseipdb = abuseResult;
  }

  // Shodan — ip only
  if (keys['shodan'] && entity.type === 'ip') {
    const shodanResult = await queryShodan(keys['shodan'], entity.value);
    if (shodanResult) enrichmentData.shodan = shodanResult;
  }

  // Determine verdict
  const vt = enrichmentData.virustotal as { malicious?: number; suspicious?: number } | undefined;
  const abuse = enrichmentData.abuseipdb as { abuse_confidence_score?: number } | undefined;

  let verdict = 'unknown';
  if (vt) {
    if ((vt.malicious ?? 0) > 2) verdict = 'malicious';
    else if ((vt.suspicious ?? 0) > 0 || (abuse?.abuse_confidence_score ?? 0) > 25) verdict = 'suspicious';
    else verdict = 'clean';
  } else if (abuse) {
    if ((abuse.abuse_confidence_score ?? 0) > 25) verdict = 'suspicious';
    else verdict = 'clean';
  }

  enrichmentData.verdict = verdict;

  await pool.query(
    `UPDATE entities
     SET enrichment_status = 'complete', enrichment_data = $1, enrichment_updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(enrichmentData), entityId],
  );

  // Emit to incident room
  if (entity.incident_id) {
    emitToIncident(entity.incident_id, 'entity:enriched', { entityId, verdict, enrichmentData });
  }
}
