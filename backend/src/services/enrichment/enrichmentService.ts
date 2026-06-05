import { pool } from '../../db/pool';
import { queryVirusTotal } from './virustotal';
import { queryAbuseIPDB } from './abuseipdb';
import { queryShodan } from './shodan';
import { emitToIncident } from '../../socket';

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) || // link-local
    a === 0
  );
}

export async function runEnrichment(entityId: string, orgId: string): Promise<void> {
  // Mark as running
  await pool.query(
    `UPDATE entities SET enrichment_status = 'running' WHERE id = $1`,
    [entityId],
  );

  const entityResult = await pool.query('SELECT * FROM entities WHERE id = $1', [entityId]);
  const entity = entityResult.rows[0];
  if (!entity) return;

  if (entity.type === 'ip' && isPrivateIP(entity.value)) {
    await pool.query(
      `UPDATE entities SET enrichment_status = 'skipped', enrichment_updated_at = NOW() WHERE id = $1`,
      [entityId],
    );
    return;
  }

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

  // --- Auto-populate entity_details from enrichment results ---
  const currentDetailsResult = await pool.query('SELECT entity_details FROM entities WHERE id = $1', [entityId]);
  const currentDetails: Record<string, unknown> = currentDetailsResult.rows[0]?.entity_details ?? {};
  const tiFields: Record<string, unknown> = {};

  const vtTyped = enrichmentData.virustotal as { malicious?: number; suspicious?: number; engines_total?: number } | undefined;
  const abuseTyped = enrichmentData.abuseipdb as { country?: string; isp?: string; asn?: string } | undefined;
  const shodanTyped = enrichmentData.shodan as { ports?: number[]; org?: string } | undefined;

  if (entity.type === 'ip') {
    if (abuseTyped?.country != null) tiFields['ti_country'] = abuseTyped.country;
    if (abuseTyped?.isp != null) tiFields['ti_isp'] = abuseTyped.isp;
    if (abuseTyped?.asn != null) tiFields['ti_asn'] = abuseTyped.asn;
    if (shodanTyped?.ports != null) tiFields['ti_ports'] = shodanTyped.ports.join(', ');
    if (shodanTyped?.org != null) tiFields['ti_org'] = shodanTyped.org;
    if (vtTyped?.malicious != null) tiFields['ti_vt_malicious'] = vtTyped.malicious;
    if (vtTyped?.suspicious != null) tiFields['ti_vt_suspicious'] = vtTyped.suspicious;
  } else if (entity.type === 'domain') {
    if (vtTyped?.malicious != null) tiFields['ti_vt_malicious'] = vtTyped.malicious;
    if (vtTyped?.suspicious != null) tiFields['ti_vt_suspicious'] = vtTyped.suspicious;
  } else if (entity.type === 'url') {
    if (vtTyped?.malicious != null) tiFields['ti_vt_malicious'] = vtTyped.malicious;
    if (vtTyped?.suspicious != null) tiFields['ti_vt_suspicious'] = vtTyped.suspicious;
  } else if (entity.type === 'file') {
    if (vtTyped?.malicious != null) tiFields['ti_vt_malicious'] = vtTyped.malicious;
    if (vtTyped?.suspicious != null) tiFields['ti_vt_suspicious'] = vtTyped.suspicious;
    if (vtTyped?.engines_total != null) tiFields['ti_vt_total_engines'] = vtTyped.engines_total;
  } else if (entity.type === 'hostname') {
    if (shodanTyped?.ports != null) tiFields['ti_ports'] = shodanTyped.ports.join(', ');
    if (shodanTyped?.org != null) tiFields['ti_org'] = shodanTyped.org;
  }

  const mergedDetails = { ...currentDetails, ...tiFields };

  await pool.query(
    `UPDATE entities
     SET enrichment_status = 'complete', enrichment_data = $1, enrichment_updated_at = NOW(), entity_details = $3
     WHERE id = $2`,
    [JSON.stringify(enrichmentData), entityId, JSON.stringify(mergedDetails)],
  );

  // Emit to incident room
  if (entity.incident_id) {
    emitToIncident(entity.incident_id, 'entity:enriched', { entityId, verdict, enrichmentData });
  }
}
