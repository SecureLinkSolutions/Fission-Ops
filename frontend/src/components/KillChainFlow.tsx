import { useState, useCallback, useRef } from 'react';
import { useLicense } from '../context/LicenseContext';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { KillChainStage, KillChainFramework } from '../types';
import EntityStatusBadge from './EntityStatusBadge';
import TTPSearch from './TTPSearch';

interface TTPInfo {
  id: string;
  ttp_id: string;
  technique_id: string;
  name: string;
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
  status?: string;
  enrichment_data?: { verdict?: string };
}

interface StageNodeData {
  label: string;
  description?: string;
  entities: MatrixRow[];
  stageId: string;
  onDrop: (mappingId: string, newStageId: string) => void;
  onNewMapping: (entityId: string, stageId: string) => void;
  onEntityClick: (row: MatrixRow) => void;
  [key: string]: unknown;
}

const ENTITY_TYPE_ICONS: Record<string, string> = { hostname: '🖥', ip: '🌐', email: '📧', domain: '🔗', account: '👤', file: '📄', process: '🔧', registry: '🗝', certificate: '🏅', url: '🌍', custom: '📌' };
const CONFIDENCE_COLORS: Record<string, string> = { low: '#d29922', medium: '#58a6ff', high: '#3fb950' };
const FRAMEWORK_LABELS: Record<KillChainFramework, string> = {
  lockheed_martin: 'Lockheed Martin',
  mitre_attack: 'MITRE ATT&CK Enterprise',
  mitre_ics: 'MITRE ATT&CK ICS',
};

function StageNode({ data }: NodeProps) {
  const d = data as StageNodeData;
  const hasEntities = d.entities.length > 0;
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={(e) => { e.stopPropagation(); setIsDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const mappingId = e.dataTransfer.getData('mappingId');
        const entityId = e.dataTransfer.getData('entityId');
        if (mappingId) {
          d.onDrop(mappingId, d.stageId);
        } else if (entityId) {
          d.onNewMapping(entityId, d.stageId);
        }
      }}
      style={{
        background: isDragOver ? '#2d3f2d' : (hasEntities ? '#1a2f1a' : '#161b22'),
        border: `1px solid ${isDragOver ? '#4fb960' : (hasEntities ? '#3fb950' : '#30363d')}`,
        borderRadius: '8px',
        padding: '12px',
        width: '180px',
        minHeight: '120px',
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
        boxShadow: isDragOver ? '0 0 14px #3fb95055' : hasEntities ? '0 0 8px #3fb95022' : '0 1px 3px rgba(0,0,0,0.3)',
        animation: 'nodeEntrance 0.35s ease-out',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: hasEntities ? '#3fb950' : '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1.3' }}>
          {d.label}
        </div>
        {hasEntities && (
          <span style={{ background: '#3fb95022', color: '#3fb950', border: '1px solid #3fb95044', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700 }}>
            {d.entities.length}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {d.entities.map((ent) => (
          <div
            key={ent.mapping_id}
            className="nodrag nopan"
            draggable
            onDragStart={(e) => { e.dataTransfer.setData('mappingId', ent.mapping_id); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); }}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '4px',
              padding: '4px 7px',
              fontSize: '11px',
              color: '#e6edf3',
              cursor: 'grab',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              onClick={(e) => { e.stopPropagation(); d.onEntityClick(ent); }}
            >
              <span>{ENTITY_TYPE_ICONS[ent.type] ?? '•'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{ent.value}</span>
              {ent.ioc_status === 'confirmed' && <span style={{ fontSize: '8px', color: '#f85149' }}>💀</span>}
              {ent.ioc_status === 'suspected' && <span style={{ fontSize: '8px', color: '#d29922' }}>⚠</span>}
              {ent.enrichment_data?.verdict === 'malicious' && !ent.ioc_status && <span style={{ color: '#f85149', fontSize: '9px' }}>●</span>}
              {ent.enrichment_data?.verdict === 'suspicious' && !ent.ioc_status && <span style={{ color: '#d29922', fontSize: '9px' }}>●</span>}
              {ent.enrichment_data?.verdict === 'clean' && !ent.ioc_status && <span style={{ color: '#3fb950', fontSize: '9px' }}>●</span>}
              {ent.status && ent.status !== 'unreviewed' && <EntityStatusBadge status={ent.status} compact />}
              {!ent.enrichment_data?.verdict && <span style={{ color: CONFIDENCE_COLORS[ent.confidence] ?? '#8b949e', fontSize: '9px' }}>●</span>}
            </div>
            {(ent.ttps ?? []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '3px' }}>
                {(ent.ttps ?? []).map((t) => (
                  <span key={t.id} style={{ fontSize: '9px', fontFamily: 'monospace', background: '#0d111799', border: '1px solid #30363d', borderRadius: '3px', padding: '1px 4px', color: '#58a6ff' }}>
                    {t.technique_id}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {!hasEntities && (
          <div style={{ color: '#484f58', fontSize: '11px', textAlign: 'center', paddingTop: '8px' }}>
            Drop entity here
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { stage: StageNode };

interface KillChainFlowInnerProps {
  incidentId: string;
}

function KillChainFlowInner({ incidentId }: KillChainFlowInnerProps) {
  const { isFeatureEnabled } = useLicense();
  const [framework, setFramework] = useState<KillChainFramework>('lockheed_martin');
  const [updating, setUpdating] = useState(false);
  const [ttpModal, setTtpModal] = useState<MatrixRow | null>(null);
  const matrixRef = useRef<MatrixRow[]>([]);

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

  const handleEntityClick = useCallback((row: MatrixRow) => {
    setTtpModal(row);
  }, []);

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

  const handleNewMapping = useCallback(async (entityId: string, stageId: string) => {
    setUpdating(true);
    try {
      await apiClient.post(`/entities/${entityId}/kill-chain`, { stage_id: stageId, confidence: 'medium' });
      refetchMatrix();
    } finally {
      setUpdating(false);
    }
  }, [refetchMatrix]);

  const buildNodes = useCallback((): Node[] => {
    if (!stages) return [];
    const stageWidth = 200;
    const gap = 20;
    return stages.map((stage, i) => {
      const stageEntities = (matrix ?? []).filter((m) => m.stage_id === stage.id);
      return {
        id: stage.id,
        type: 'stage',
        position: { x: i * (stageWidth + gap), y: 0 },
        data: {
          label: stage.name,
          description: stage.description,
          entities: stageEntities,
          stageId: stage.id,
          onDrop: handleDrop,
          onNewMapping: handleNewMapping,
          onEntityClick: handleEntityClick,
        } as StageNodeData,
        draggable: false,
      };
    });
  }, [stages, matrix, handleDrop, handleNewMapping, handleEntityClick]);

  const buildEdges = useCallback((): Edge[] => {
    if (!stages || stages.length < 2) return [];
    return stages.slice(0, -1).map((stage, i) => ({
      id: `e-${stage.id}-${stages[i + 1].id}`,
      source: stage.id,
      target: stages[i + 1].id,
      style: { stroke: '#58a6ff44', strokeWidth: 2, strokeDasharray: '6 3' },
      animated: true,
    }));
  }, [stages]);

  const [nodes, , onNodesChange] = useNodesState(buildNodes());
  const [edges, , onEdgesChange] = useEdgesState(buildEdges());

  // Rebuild nodes when data changes
  const currentNodes = stages ? buildNodes() : nodes;
  const currentEdges = stages ? buildEdges() : edges;

  if (stagesLoading) return <div style={{ padding: '40px', textAlign: 'center', color: '#8b949e' }}>Loading kill chain…</div>;

  return (
    <div>
      <style>{`
        @keyframes nodeEntrance { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <span style={{ color: '#8b949e', fontSize: '12px', fontWeight: 600 }}>Framework:</span>
        {(['lockheed_martin', 'mitre_attack', 'mitre_ics'] as KillChainFramework[]).map((fw) => {
          const isMitre = fw !== 'lockheed_martin';
          const locked = isMitre && !isFeatureEnabled('mitre_full');
          return (
            <button
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
        {updating && <span style={{ color: '#8b949e', fontSize: '12px' }}>Updating…</span>}
      </div>
      {/* Unassigned entities — drag into stages */}
      {(() => {
        const mappedEntityIds = new Set((matrix ?? []).map((m) => m.entity_id));
        const unassigned = (allEntities ?? []).filter((e) => !mappedEntityIds.has(e.id));
        if (unassigned.length === 0) return null;
        return (
          <div style={{ marginBottom: '10px', padding: '10px 12px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
              Unassigned Entities — drag into a stage
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {unassigned.map((ent) => (
                <div
                  key={ent.id}
                  className="nodrag nopan"
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('entityId', ent.id); e.dataTransfer.effectAllowed = 'move'; }}
                  style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', color: '#e6edf3', cursor: 'grab', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>{ENTITY_TYPE_ICONS[ent.type] ?? '•'}</span>
                  <span style={{ fontFamily: 'monospace' }}>{ent.value}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div style={{ height: '480px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
        <ReactFlow
          nodes={currentNodes}
          edges={currentEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#21262d" gap={20} />
          <Controls style={{ background: '#161b22', border: '1px solid #30363d' }} />
        </ReactFlow>
      </div>
      <div style={{ marginTop: '10px', color: '#484f58', fontSize: '11px' }}>
        Drag entity chips between stages to update kill chain mappings. Click a chip to assign TTPs.
      </div>
      {ttpModal && (
        <TTPSearch
          mappingId={ttpModal.mapping_id}
          entityId={ttpModal.entity_id}
          entityValue={ttpModal.value}
          onUpdated={refetchMatrix}
          onClose={() => setTtpModal(null)}
        />
      )}
    </div>
  );
}

export default function KillChainFlow({ incidentId }: { incidentId: string }) {
  return (
    <ReactFlowProvider>
      <KillChainFlowInner incidentId={incidentId} />
    </ReactFlowProvider>
  );
}
