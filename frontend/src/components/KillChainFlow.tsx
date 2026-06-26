import { useState, useCallback, useRef } from 'react';
import { useLicense } from '../context/LicenseContext';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { KillChainStage, KillChainFramework } from '../types';
import TTPSearch from './TTPSearch';
import TTPSuggestionPanel from './TTPSuggestionPanel';
import { ENTITY_TYPE_ICONS } from '../utils/constants';

interface TTPInfo {
  id: string;
  ttp_id: string;
  technique_id: string;
  name: string;
}

interface EntityDetails {
  ti_isp?: string;
  ti_asn?: string;
  ti_country?: string;
  ti_ports?: string;
  registrar?: string;
  registration_date?: string;
  a_records?: string | string[];
  sha256?: string;
  file_type?: string;
  os?: string;
  domain_joined?: boolean;
  ip_address?: string;
  sender_address?: string;
  sending_ip?: string;
  account_type?: string;
  last_login?: string;
  [key: string]: unknown;
}

interface MatrixRow {
  entity_id: string;
  value: string;
  type: string;
  stage_id: string;
  stage_name: string;
  order_index: number;
  confidence: string;
  mapping_id: string;
  framework?: string;
  ttps?: TTPInfo[];
  ioc_status?: string;
  entity_status?: string;
  entity_details?: EntityDetails;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  low: '#d29922',
  medium: '#58a6ff',
  high: '#3fb950',
};

const FRAMEWORK_LABELS: Record<KillChainFramework, string> = {
  lockheed_martin: 'Lockheed Martin',
  mitre_attack: 'MITRE ATT&CK Enterprise',
  mitre_ics: 'MITRE ATT&CK ICS',
};

function getEntityBorderColor(ioc_status?: string): string {
  if (ioc_status === 'confirmed') return '#f97316';
  if (ioc_status === 'suspected') return '#58a6ff';
  return '#30363d';
}

function EntityEnrichment({ type, details }: { type: string; details?: EntityDetails }) {
  if (!details) return null;
  const rows: { label: string; value: string }[] = [];

  if (details.ti_isp) rows.push({ label: 'ISP', value: String(details.ti_isp) });
  if (details.ti_country) rows.push({ label: 'Country', value: String(details.ti_country) });
  if (details.ti_asn) rows.push({ label: 'ASN', value: String(details.ti_asn) });
  if (details.ti_ports) rows.push({ label: 'Ports', value: String(details.ti_ports) });

  if (type === 'domain') {
    if (details.registrar) rows.push({ label: 'Registrar', value: String(details.registrar) });
    if (details.registration_date) rows.push({ label: 'Registered', value: String(details.registration_date) });
    if (details.a_records) {
      const ar = Array.isArray(details.a_records) ? details.a_records.join(', ') : String(details.a_records);
      rows.push({ label: 'A records', value: ar });
    }
  } else if (type === 'hostname') {
    if (details.os) rows.push({ label: 'OS', value: String(details.os) });
    if (details.domain_joined !== undefined) rows.push({ label: 'Domain joined', value: details.domain_joined ? 'Yes' : 'No' });
    if (details.ip_address) rows.push({ label: 'IP', value: String(details.ip_address) });
  } else if (type === 'file') {
    if (details.sha256) rows.push({ label: 'SHA256', value: String(details.sha256).substring(0, 16) + '…' });
    if (details.file_type) rows.push({ label: 'Type', value: String(details.file_type) });
  } else if (type === 'email') {
    if (details.sender_address) rows.push({ label: 'Sender', value: String(details.sender_address) });
    if (details.sending_ip) rows.push({ label: 'Sending IP', value: String(details.sending_ip) });
  } else if (type === 'account') {
    if (details.account_type) rows.push({ label: 'Type', value: String(details.account_type) });
    if (details.last_login) rows.push({ label: 'Last login', value: String(details.last_login) });
  }

  if (rows.length === 0) return null;

  return (
    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {rows.map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', gap: '4px', fontSize: '10px' }}>
          <span style={{ color: '#484f58', minWidth: '52px', flexShrink: 0 }}>{label}:</span>
          <span style={{ color: '#8b949e', wordBreak: 'break-all' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

interface EntityCardProps {
  row: MatrixRow;
  onRemove: (mappingId: string, entityId: string) => void;
  onClick: (row: MatrixRow) => void;
}

function EntityCard({ row, onRemove, onClick }: EntityCardProps) {
  const borderColor = getEntityBorderColor(row.ioc_status);
  const confColor = CONFIDENCE_COLORS[row.confidence] ?? '#8b949e';

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('mappingId', row.mapping_id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{
        background: '#21262d',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: '6px',
        padding: '8px 10px',
        cursor: 'grab',
        userSelect: 'none',
        marginBottom: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ color: '#484f58', fontSize: '10px', cursor: 'grab' }}>⠿</span>
        <span style={{ fontSize: '12px' }}>{ENTITY_TYPE_ICONS[row.type] ?? '•'}</span>
        <span
          style={{ flex: 1, fontFamily: 'monospace', fontSize: '11px', color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
          onClick={() => onClick(row)}
          title={row.value}
        >
          {row.value}
        </span>
        {row.ioc_status === 'confirmed' && (
          <span style={{ fontSize: '9px', background: '#f9731622', color: '#f97316', border: '1px solid #f9731644', borderRadius: '4px', padding: '1px 4px', whiteSpace: 'nowrap' }}>
            CONFIRMED
          </span>
        )}
        {row.ioc_status === 'suspected' && (
          <span style={{ fontSize: '9px', background: '#58a6ff22', color: '#58a6ff', border: '1px solid #58a6ff44', borderRadius: '4px', padding: '1px 4px', whiteSpace: 'nowrap' }}>
            SUSPECTED
          </span>
        )}
        <button type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(row.mapping_id, row.entity_id); }}
          title="Remove from kill chain"
          style={{ background: 'transparent', border: 'none', color: '#484f58', cursor: 'pointer', padding: '0 2px', fontSize: '12px', lineHeight: 1, flexShrink: 0 }}
        >
          🗑
        </button>
      </div>
      <EntityEnrichment type={row.type} details={row.entity_details} />
      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '10px',
          background: `${confColor}22`,
          color: confColor,
          border: `1px solid ${confColor}44`,
          borderRadius: '10px',
          padding: '1px 7px',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          {row.confidence}
        </span>
        {(row.ttps ?? []).map((t) => (
          <span
            key={t.id}
            style={{ fontSize: '9px', fontFamily: 'monospace', background: '#0d111799', border: '1px solid #30363d', borderRadius: '3px', padding: '1px 4px', color: '#58a6ff' }}
          >
            {t.technique_id}
          </span>
        ))}
      </div>
    </div>
  );
}

interface StageColumnProps {
  stage: KillChainStage;
  entities: MatrixRow[];
  onDrop: (mappingId: string, stageId: string) => void;
  onNewMapping: (entityId: string, stageId: string) => void;
  onRemove: (mappingId: string, entityId: string) => void;
  onEntityClick: (row: MatrixRow) => void;
  columnRef?: (el: HTMLDivElement | null) => void;
}

function StageColumn({ stage, entities, onDrop, onNewMapping, onRemove, onEntityClick, columnRef }: StageColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const hasEntities = entities.length > 0;

  return (
    <div
      ref={columnRef}
      style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{
        padding: '8px 10px',
        background: '#161b22',
        borderRadius: '6px 6px 0 0',
        borderBottom: `2px solid ${hasEntities ? '#f97316' : '#30363d'}`,
        marginBottom: '4px',
      }}>
        <div style={{ fontSize: '10px', color: '#484f58', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
          Stage {stage.order_index}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: hasEntities ? '#f97316' : '#8b949e' }}>{stage.name}</span>
          {hasEntities && (
            <span style={{ background: '#f9731622', color: '#f97316', border: '1px solid #f9731644', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 700 }}>
              {entities.length}
            </span>
          )}
        </div>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const mappingId = e.dataTransfer.getData('mappingId');
          const entityId = e.dataTransfer.getData('entityId');
          if (mappingId) onDrop(mappingId, stage.id);
          else if (entityId) onNewMapping(entityId, stage.id);
        }}
        style={{
          flex: 1,
          padding: '8px',
          background: isDragOver ? '#1a2f1a' : '#0d1117',
          border: `1px solid ${isDragOver ? '#3fb950' : '#30363d'}`,
          borderRadius: '6px',
          transition: 'background 0.15s, border-color 0.15s',
          minHeight: '120px',
          overflowY: 'auto',
          maxHeight: '400px',
        }}
      >
        {entities.map((ent) => (
          <EntityCard
            key={ent.mapping_id}
            row={ent}
            onRemove={onRemove}
            onClick={onEntityClick}
          />
        ))}
        {!hasEntities && (
          <div style={{ color: '#484f58', fontSize: '11px', textAlign: 'center', paddingTop: '24px' }}>
            Drop entity here ↓
          </div>
        )}
      </div>
    </div>
  );
}

interface AddEntityModalProps {
  allEntities: { id: string; type: string; value: string }[];
  stages: KillChainStage[];
  onClose: () => void;
  onAdd: (entityId: string, stageId: string, confidence: string) => Promise<void>;
}

function AddEntityModal({ allEntities, stages, onClose, onAdd }: AddEntityModalProps) {
  const [entityId, setEntityId] = useState('');
  const [stageId, setStageId] = useState('');
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!entityId || !stageId) return;
    setLoading(true);
    try {
      await onAdd(entityId, stageId, confidence);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '7px 10px',
    color: '#e6edf3',
    fontSize: '13px',
    width: '100%',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '24px', width: '380px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#e6edf3', marginBottom: '16px' }}>Map Entity to Kill Chain</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#8b949e', marginBottom: '4px', display: 'block' }}>Entity</label>
            <select style={selectStyle} value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="">Select entity…</option>
              {allEntities.map((ent) => (
                <option key={ent.id} value={ent.id}>{ENTITY_TYPE_ICONS[ent.type] ?? '•'} {ent.value}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#8b949e', marginBottom: '4px', display: 'block' }}>Stage</label>
            <select style={selectStyle} value={stageId} onChange={(e) => setStageId(e.target.value)}>
              <option value="">Select stage…</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.order_index}. {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#8b949e', marginBottom: '4px', display: 'block' }}>Confidence</label>
            <select style={selectStyle} value={confidence} onChange={(e) => setConfidence(e.target.value as 'low' | 'medium' | 'high')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 16px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="button"
              onClick={handleSubmit}
              disabled={!entityId || !stageId || loading}
              style={{ background: '#f97316', border: 'none', borderRadius: '6px', padding: '7px 16px', color: '#fff', fontSize: '13px', cursor: 'pointer', opacity: (!entityId || !stageId || loading) ? 0.5 : 1 }}
            >
              {loading ? 'Mapping…' : 'Map Entity'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface NarrativePanelProps {
  incidentId: string;
}

function NarrativePanel({ incidentId }: NarrativePanelProps) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post(`/incidents/${incidentId}/kill-chain/narrative`);
      const data = res.data as { narrative: string | null; error?: string };
      if (data.error === 'ANTHROPIC_API_KEY not configured') {
        setError('Narrative generation requires an ANTHROPIC_API_KEY. Configure it in your backend environment.');
        setNarrative(null);
      } else {
        setNarrative(data.narrative);
        setError(null);
        setGenerated(true);
      }
    } catch {
      setError('Failed to generate narrative. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🤖</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#e6edf3' }}>Attack Narrative</span>
        </div>
        <button type="button"
          onClick={generate}
          disabled={loading}
          style={{
            background: 'transparent',
            border: '1px solid #f97316',
            borderRadius: '6px',
            padding: '5px 14px',
            color: '#f97316',
            fontSize: '12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>
              Generating…
            </>
          ) : (
            <>{generated ? '↻ Regenerate' : 'Generate ↻'}</>
          )}
        </button>
      </div>
      {error && (
        <div style={{ color: '#8b949e', fontSize: '13px', lineHeight: 1.6, fontStyle: 'italic' }}>{error}</div>
      )}
      {!narrative && !error && (
        <div style={{ color: '#484f58', fontSize: '13px', lineHeight: 1.6 }}>
          Click Generate to create an AI-powered attack narrative based on your kill chain mappings.
        </div>
      )}
      {narrative && (
        <div style={{ color: '#c9d1d9', fontSize: '14px', lineHeight: 1.7 }}>
          {narrative.split('\n\n').map((para, i) => (
            <p key={i} style={{ margin: '0 0 12px 0' }}>{para}</p>
          ))}
        </div>
      )}
    </div>
  );
}

interface KillChainFlowProps {
  incidentId: string;
}

export default function KillChainFlow({ incidentId }: KillChainFlowProps) {
  const { isFeatureEnabled } = useLicense();
  const [framework, setFramework] = useState<KillChainFramework>('lockheed_martin');
  const [updating, setUpdating] = useState(false);
  const [ttpModal, setTtpModal] = useState<MatrixRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ttpSuggestions, setTtpSuggestions] = useState<{
    entityId: string; mappingId: string;
    techniqueId: string; techniqueName: string;
    suggestions: { technique_id: string; name: string; weight: number }[];
  } | null>(null);
  const matrixRef = useRef<MatrixRow[]>([]);
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { data: stages, loading: stagesLoading } = useFetch<KillChainStage[]>(
    () => apiClient.get(`/kill-chain/stages?framework=${framework}`).then((r) => r.data),
    [framework],
  );

  const { data: matrix, refetch: refetchMatrix } = useFetch<MatrixRow[]>(
    () => apiClient.get(`/incidents/${incidentId}/kill-chain/matrix`).then((r) => r.data),
    [incidentId],
  );

  const { data: allEntities } = useFetch<{ id: string; type: string; value: string }[]>(
    () => apiClient.get(`/incidents/${incidentId}/entities`).then((r) => r.data),
    [incidentId],
  );

  matrixRef.current = matrix ?? [];

  const handleDrop = useCallback(async (mappingId: string, newStageId: string) => {
    const mapping = matrixRef.current.find((m) => m.mapping_id === mappingId);
    if (!mapping || mapping.stage_id === newStageId) return;
    setUpdating(true);
    try {
      await apiClient.patch(`/entities/${mapping.entity_id}/kill-chain/${mappingId}`, { stage_id: newStageId });
      refetchMatrix();
    } finally {
      setUpdating(false);
    }
  }, [refetchMatrix]);

  const handleNewMapping = useCallback(async (entityId: string, stageId: string, confidence = 'medium') => {
    setUpdating(true);
    try {
      await apiClient.post(`/entities/${entityId}/kill-chain`, { stage_id: stageId, confidence });
      refetchMatrix();
    } finally {
      setUpdating(false);
    }
  }, [refetchMatrix]);

  const handleRemove = useCallback(async (mappingId: string, entityId: string) => {
    setUpdating(true);
    try {
      await apiClient.delete(`/entities/${entityId}/kill-chain/${mappingId}`);
      refetchMatrix();
    } finally {
      setUpdating(false);
    }
  }, [refetchMatrix]);

  const handleEntityClick = useCallback((row: MatrixRow) => {
    setTtpModal(row);
  }, []);

  function scrollToStage(stageId: string) {
    const el = columnRefs.current.get(stageId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  if (stagesLoading) return <div style={{ padding: '40px', textAlign: 'center', color: '#8b949e' }}>Loading kill chain…</div>;

  const stageList = stages ?? [];
  const matrixRows = matrix ?? [];
  const entities = allEntities ?? [];

  return (
    <div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#8b949e', fontSize: '12px', fontWeight: 600 }}>Framework:</span>
        {(['lockheed_martin', 'mitre_attack', 'mitre_ics'] as KillChainFramework[]).map((fw) => {
          const isMitre = fw !== 'lockheed_martin';
          const locked = isMitre && !isFeatureEnabled('mitre_full');
          return (
            <button type="button"
              key={fw}
              onClick={() => !locked && setFramework(fw)}
              title={locked ? 'Requires Professional license' : undefined}
              style={{
                background: framework === fw ? '#21262d' : 'transparent',
                border: `1px solid ${locked ? '#30363d' : framework === fw ? '#58a6ff' : '#30363d'}`,
                borderRadius: '6px',
                padding: '5px 12px',
                color: locked ? '#484f58' : framework === fw ? '#58a6ff' : '#8b949e',
                fontSize: '12px',
                cursor: locked ? 'not-allowed' : 'pointer',
                fontWeight: framework === fw ? 600 : 400,
                opacity: locked ? 0.5 : 1,
              }}
            >
              {FRAMEWORK_LABELS[fw]}{locked ? ' 🔒' : ''}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button type="button"
          onClick={() => setShowAddModal(true)}
          style={{ background: '#f97316', border: 'none', borderRadius: '6px', padding: '6px 14px', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
        >
          + Map Entity to Stage
        </button>
        {updating && <span style={{ color: '#8b949e', fontSize: '12px' }}>Updating…</span>}
      </div>

      {/* Stage timeline header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto', paddingBottom: '8px', marginBottom: '8px' }}>
        {stageList.map((stage, i) => {
          const stageEntities = matrixRows.filter((m) => m.stage_id === stage.id);
          const active = stageEntities.length > 0;
          return (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <button type="button"
                onClick={() => scrollToStage(stage.id)}
                style={{
                  background: active ? '#1a1a0e' : 'transparent',
                  border: `1px solid ${active ? '#f97316' : '#30363d'}`,
                  borderRadius: '6px',
                  padding: '5px 12px',
                  color: active ? '#f97316' : '#484f58',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: active ? 700 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                }}
              >
                {stage.name}
                {active && (
                  <span style={{ background: '#f9731622', color: '#f97316', border: '1px solid #f9731644', borderRadius: '8px', padding: '0 5px', fontSize: '10px' }}>
                    {stageEntities.length}
                  </span>
                )}
              </button>
              {i < stageList.length - 1 && (
                <span style={{ color: '#30363d', fontSize: '14px', padding: '0 4px' }}>→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* All entities — drag any entity to any stage (including entities already mapped elsewhere) */}
      {entities.length > 0 && (() => {
        const mappedEntityIds = new Set(matrixRows.map((m) => m.entity_id));
        return (
          <div style={{ marginBottom: '10px', padding: '10px 12px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
              Entities — drag to assign to a stage (entities can span multiple stages)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {entities.map((ent) => {
                const isMapped = mappedEntityIds.has(ent.id);
                return (
                  <div
                    key={ent.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('entityId', ent.id); e.dataTransfer.effectAllowed = 'move'; }}
                    style={{ background: isMapped ? '#1a2f1a' : '#21262d', border: `1px solid ${isMapped ? '#3fb95066' : '#30363d'}`, borderRadius: '4px', padding: '3px 8px', fontSize: '11px', color: '#e6edf3', cursor: 'grab', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title={isMapped ? 'Already in kill chain — drag to add to another stage' : 'Drag to assign to a stage'}
                  >
                    <span>{ENTITY_TYPE_ICONS[ent.type] ?? '•'}</span>
                    <span style={{ fontFamily: 'monospace' }}>{ent.value}</span>
                    {isMapped && <span style={{ color: '#3fb950', fontSize: '10px' }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Stage columns */}
      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', minWidth: 'max-content', alignItems: 'flex-start' }}>
          {stageList.map((stage) => {
            const stageEntities = matrixRows.filter((m) => m.stage_id === stage.id);
            return (
              <StageColumn
                key={stage.id}
                stage={stage}
                entities={stageEntities}
                onDrop={handleDrop}
                onNewMapping={handleNewMapping}
                onRemove={handleRemove}
                onEntityClick={handleEntityClick}
                columnRef={(el) => {
                  if (el) columnRefs.current.set(stage.id, el);
                  else columnRefs.current.delete(stage.id);
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '8px', color: '#484f58', fontSize: '11px' }}>
        Drag entity cards between stages to update kill chain mappings. Click a card to assign TTPs.
      </div>

      {/* AI Narrative */}
      <NarrativePanel incidentId={incidentId} />

      {/* Modals */}
      {showAddModal && (
        <AddEntityModal
          allEntities={entities}
          stages={stageList}
          onClose={() => setShowAddModal(false)}
          onAdd={handleNewMapping}
        />
      )}
      {ttpModal && (
        <TTPSearch
          mappingId={ttpModal.mapping_id}
          entityId={ttpModal.entity_id}
          entityValue={ttpModal.value}
          onUpdated={async (addedTechniqueId?: string, addedTechniqueName?: string) => {
            refetchMatrix();
            if (addedTechniqueId && addedTechniqueName && ttpModal) {
              try {
                const res = await apiClient.get(
                  `/incidents/${incidentId}/ttp-suggestions?technique_id=${addedTechniqueId}`,
                );
                const suggestions = res.data as { technique_id: string; name: string; weight: number }[];
                if (suggestions.length > 0) {
                  setTtpSuggestions({
                    entityId: ttpModal.entity_id,
                    mappingId: ttpModal.mapping_id,
                    techniqueId: addedTechniqueId,
                    techniqueName: addedTechniqueName,
                    suggestions,
                  });
                }
              } catch { /* suggestions are non-critical */ }
            }
          }}
          onClose={() => setTtpModal(null)}
        />
      )}
      {ttpSuggestions && (
        <div style={{
          position: 'fixed', bottom: '80px', right: '24px',
          width: '380px', zIndex: 500,
        }}>
          <TTPSuggestionPanel
            incidentId={incidentId}
            entityId={ttpSuggestions.entityId}
            triggerTechniqueId={ttpSuggestions.techniqueId}
            triggerTechniqueName={ttpSuggestions.techniqueName}
            suggestions={ttpSuggestions.suggestions}
            onAddTTP={async (techniqueId, techniqueName) => {
              // Assign the suggested TTP to the same mapping
              await apiClient.post(
                `/entities/${ttpSuggestions.entityId}/kill-chain/${ttpSuggestions.mappingId}/ttps`,
                { technique_id: techniqueId },
              ).catch(() => {});
              refetchMatrix();
              // Update suggestion list name for context
              setTtpSuggestions((prev) => prev ? {
                ...prev,
                techniqueId: techniqueId,
                techniqueName: techniqueName,
              } : null);
            }}
            onDismiss={() => setTtpSuggestions(null)}
          />
        </div>
      )}
    </div>
  );
}
