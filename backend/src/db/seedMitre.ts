import { pool } from './pool';

interface StixObject {
  type: string;
  name: string;
  description?: string;
  external_references?: Array<{ source_name: string; external_id?: string }>;
  kill_chain_phases?: Array<{ kill_chain_name: string; phase_name: string }>;
  x_mitre_deprecated?: boolean;
  revoked?: boolean;
}

interface StixBundle {
  objects: StixObject[];
}

function toTitleCase(kebab: string): string {
  return kebab
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function fetchBundle(url: string): Promise<StixBundle> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<StixBundle>;
}

function extractTechniques(bundle: StixBundle, framework: string) {
  const results: Array<{
    technique_id: string;
    name: string;
    description: string;
    tactic: string;
    framework: string;
    is_subtechnique: boolean;
  }> = [];

  for (const obj of bundle.objects) {
    if (obj.type !== 'attack-pattern') continue;
    if (obj.x_mitre_deprecated || obj.revoked) continue;

    const ref = obj.external_references?.[0];
    if (!ref || ref.source_name !== 'mitre-attack' || !ref.external_id) continue;

    const technique_id = ref.external_id;
    const name = obj.name;
    const description = (obj.description ?? '').slice(0, 500);
    const phase = obj.kill_chain_phases?.[0]?.phase_name ?? 'unknown';
    const tactic = toTitleCase(phase);
    const is_subtechnique = technique_id.includes('.');

    results.push({ technique_id, name, description, tactic, framework, is_subtechnique });
  }

  return results;
}

export async function seedMitre(): Promise<void> {
  const countResult = await pool.query('SELECT COUNT(*) FROM ttps WHERE framework IN ($1,$2)', [
    'mitre_attack',
    'mitre_ics',
  ]);
  const count = parseInt(countResult.rows[0].count, 10);
  if (count > 200) {
    console.log(`✅ MITRE ATT&CK already seeded (${count} TTPs)`);
    return;
  }

  console.log('⚙️  Seeding MITRE ATT&CK dataset...');

  const [enterprise, ics] = await Promise.all([
    fetchBundle(
      'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json',
    ).catch((e) => {
      console.warn('⚠️  Failed to fetch Enterprise ATT&CK:', e.message);
      return null;
    }),
    fetchBundle(
      'https://raw.githubusercontent.com/mitre/cti/master/ics-attack/ics-attack.json',
    ).catch((e) => {
      console.warn('⚠️  Failed to fetch ICS ATT&CK:', e.message);
      return null;
    }),
  ]);

  const techniques = [
    ...(enterprise ? extractTechniques(enterprise, 'mitre_attack') : []),
    ...(ics ? extractTechniques(ics, 'mitre_ics') : []),
  ];

  if (techniques.length === 0) {
    console.warn('⚠️  No MITRE techniques fetched, skipping seed');
    return;
  }

  // Bulk insert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < techniques.length; i += BATCH) {
    const batch = techniques.slice(i, i + BATCH);
    const values: unknown[] = [];
    const placeholders = batch.map((t, idx) => {
      const base = idx * 6;
      values.push(t.technique_id, t.name, t.description, t.tactic, t.framework, t.is_subtechnique);
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`;
    });

    await pool.query(
      `INSERT INTO ttps (technique_id, name, description, tactic, framework, is_subtechnique)
       VALUES ${placeholders.join(',')}
       ON CONFLICT (technique_id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         tactic = EXCLUDED.tactic,
         is_subtechnique = EXCLUDED.is_subtechnique`,
      values,
    );
    inserted += batch.length;
  }

  console.log(`✅ MITRE ATT&CK seeded: ${inserted} techniques`);
}
