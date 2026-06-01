import { useState, useCallback, useEffect } from 'react';
import { useLicense } from '../context/LicenseContext';
import UpgradePrompt from './UpgradePrompt';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
} from '@xyflow/react';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Entity, EntityRelationship } from '../types';

const ENTITY_TYPE_ICONS: Record<string, string> = { hostname: '🖥', ip: '🌐', email: '📧', domain: '🔗', account: '👤', file: '📄' };
const ENTITY_TYPE_COLORS: Record<string, string> = { hostname: '#58a6ff', ip: '#3fb950', email: '#d29922', domain: '#a371f7', account: '#f0883e', file: '#79c0ff' };
const RELATIONSHIP_SUGGESTIONS = ['visited', 'downloaded', 'executed', 'communicated_with', 'owns', 'hosted_on', 'resolved_to', 'lateral_movement_to', 'authenticated_to', 'spawned'];

interface EntityNodeData {
  entity: Entity;
  color: string;
  [key: string]: unknown;
}

function EntityNode({ data, selected }: NodeProps) {
  const d = data as EntityNodeData;
  const { entity, color } = d;
  return (
    <div style={{
      background: selected ? `${color}22` : '#161b22',
      border: `2px solid ${selected ? color : color + '66'}`,
      borderRadius: '10px',
      padding: '10px 14px',
      minWidth: '140px',
      maxWidth: '200px',
      transition: 'all 0.15s',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontSize: '16px' }}>{ENTITY_TYPE_ICONS[entity.type] ?? '•'}</span>
        <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>{entity.type}</span>
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entity.value}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

interface SidePanelProps {
  entity: Entity;
  onClose: () => void;
}

function SidePanel({ entity, onClose }: SidePanelProps) {
  const color = ENTITY_TYPE_COLORS[entity.type] ?? '#8b949e';
  const { data: fullEntity } = useFetch<Entity>(
    () => apiClient.get(`/entities/${entity.id}`).then((r) => r.data),
    [entity.id],
  );
  const e = fullEntity ?? entity;

  return (
    <div style={{
      width: '340px',
      background: '#161b22',
      borderLeft: '1px solid #30363d',
      padding: '20px',
      overflowY: 'auto',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '5px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, display: 'inline-block', marginBottom: '6px' }}>
            {ENTITY_TYPE_ICONS[entity.type]} {entity.type}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: '#e6edf3' }}>{entity.value}</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }}>✕</button>
      </div>

      {e.notes && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Notes</div>
          <div style={{ color: '#c9d1d9', fontSize: '13px', lineHeight: '1.5' }}>{e.notes}</div>
        </div>
      )}

      {e.entity_details && Object.keys(e.entity_details).length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Details</div>
          {Object.entries(e.entity_details).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #21262d' }}>
              <span style={{ color: '#8b949e', fontSize: '12px' }}>{k}</span>
              <span style={{ color: '#e6edf3', fontSize: '12px', fontFamily: 'monospace' }}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {e.kill_chain_mappings && e.kill_chain_mappings.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Kill Chain Stages</div>
          {e.kill_chain_mappings.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #21262d' }}>
              <span style={{ color: '#e6edf3', fontSize: '12px' }}>{m.stage_name}</span>
              <span style={{ color: '#3fb950', fontSize: '11px' }}>{m.confidence}</span>
            </div>
          ))}
        </div>
      )}

      {e.boundary_mappings && e.boundary_mappings.length > 0 && (
        <div>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Boundary Traversals</div>
          {e.boundary_mappings.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #21262d' }}>
              <span style={{ color: '#e6edf3', fontSize: '12px' }}>{m.boundary_name}</span>
              <span style={{ color: '#a371f7', fontSize: '11px' }}>{m.direction}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AddRelationshipFormProps {
  entities: Entity[];
  incidentId: string;
  onCreated: () => void;
  onClose: () => void;
}

function AddRelationshipForm({ entities, incidentId, onCreated, onClose }: AddRelationshipFormProps) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [relType, setRelType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px',
    padding: '8px 10px', color: '#e6edf3', fontSize: '13px', outline: 'none', marginBottom: '10px',
  };

  async function handleSubmit() {
    if (!source || !target || !relType) { setError('Source, target, and relationship type are required.'); return; }
    if (source === target) { setError('Source and target must be different entities.'); return; }
    setLoading(true); setError('');
    try {
      await apiClient.post(`/incidents/${incidentId}/relationships`, {
        source_entity_id: source, target_entity_id: target, relationship_type: relType, notes: notes || undefined,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.error ?? 'Failed to create relationship');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'absolute', top: '60px', left: '50%', transform: 'translateX(-50%)',
      background: '#161b22', border: '1px solid #30363d', borderRadius: '10px',
      padding: '20px', zIndex: 10, width: '360px', boxShadow: '0 8px 32px #00000066',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: '14px' }}>Add Relationship</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '16px', cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Source Entity</div>
      <select style={inputStyle} value={source} onChange={(e) => setSource(e.target.value)}>
        <option value="">Select source…</option>
        {entities.map((e) => <option key={e.id} value={e.id}>{ENTITY_TYPE_ICONS[e.type]} {e.value}</option>)}
      </select>
      <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Relationship</div>
      <input
        list="rel-suggestions"
        style={inputStyle}
        value={relType}
        onChange={(e) => setRelType(e.target.value)}
        placeholder="e.g. visited, downloaded, executed…"
      />
      <datalist id="rel-suggestions">
        {RELATIONSHIP_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
      </datalist>
      <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Target Entity</div>
      <select style={inputStyle} value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Select target…</option>
        {entities.map((e) => <option key={e.id} value={e.id}>{ENTITY_TYPE_ICONS[e.type]} {e.value}</option>)}
      </select>
      <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Notes (optional)</div>
      <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional context…" />
      {error && <div style={{ color: '#f85149', fontSize: '12px', marginBottom: '10px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, background: '#238636', border: 'none', borderRadius: '6px', padding: '9px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Adding…' : 'Add Relationship'}
        </button>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '9px 14px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

interface GraphInnerProps {
  incidentId: string;
}

function GraphInner({ incidentId }: GraphInnerProps) {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: entities } = useFetch<Entity[]>(
    () => apiClient.get(`/incidents/${incidentId}/entities`).then((r) => r.data),
    [incidentId],
  );

  const { data: relationships, refetch: refetchRels } = useFetch<EntityRelationship[]>(
    () => apiClient.get(`/incidents/${incidentId}/relationships`).then((r) => r.data),
    [incidentId],
  );

  const buildGraph = useCallback(() => {
    const ents = entities ?? [];
    const cols = 4;
    const xSpacing = 220;
    const ySpacing = 140;

    const nodes: Node[] = ents.map((e, i) => ({
      id: e.id,
      type: 'entity',
      position: { x: (i % cols) * xSpacing, y: Math.floor(i / cols) * ySpacing },
      data: { entity: e, color: ENTITY_TYPE_COLORS[e.type] ?? '#8b949e' } as EntityNodeData,
    }));

    const edges: Edge[] = (relationships ?? []).map((r) => ({
      id: r.id,
      source: r.source_entity_id,
      target: r.target_entity_id,
      label: r.relationship_type,
      labelStyle: { fill: '#8b949e', fontSize: 10 },
      labelBgStyle: { fill: '#161b22', fillOpacity: 0.9 },
      labelBgPadding: [4, 4] as [number, number],
      style: { stroke: '#58a6ff66', strokeWidth: 1.5 },
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#58a6ff66' },
    }));

    return { nodes, edges };
  }, [entities, relationships]);

  const { nodes: initNodes, edges: initEdges } = buildGraph();
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  // Only reset node positions when the set of entity IDs changes (new/removed entities).
  // Relationship changes only update edges so dragged positions are preserved.
  const entityIds = (entities ?? []).map((e) => e.id).join(',');
  useEffect(() => {
    const { nodes: n } = buildGraph();
    // Preserve positions of nodes that already exist in state.
    setNodes((prev) => {
      const posMap = new Map(prev.map((p) => [p.id, p.position]));
      return n.map((node) => ({ ...node, position: posMap.get(node.id) ?? node.position }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityIds]);

  useEffect(() => {
    const { edges: e } = buildGraph();
    setEdges(e);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationships]);

  const autoLayout = useCallback(() => {
    const ents = entities ?? [];
    const cols = 4;
    setNodes(ents.map((e, i) => ({
      id: e.id,
      type: 'entity',
      position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 140 },
      data: { entity: e, color: ENTITY_TYPE_COLORS[e.type] ?? '#8b949e' } as EntityNodeData,
    })));
  }, [entities, setNodes]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as EntityNodeData;
    setSelectedEntity((prev) => prev?.id === d.entity.id ? null : d.entity);
    setShowAddForm(false);
  }, []);

  const isEmpty = !entities?.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', position: 'relative' }}>
        <button
          onClick={() => { setShowAddForm((v) => !v); setSelectedEntity(null); }}
          style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '7px 16px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          + Add Relationship
        </button>
        <button
          onClick={autoLayout}
          style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 14px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' }}
        >
          Auto Layout
        </button>
        <span style={{ color: '#8b949e', fontSize: '12px', marginLeft: '4px' }}>
          {relationships?.length ?? 0} relationship{relationships?.length !== 1 ? 's' : ''} · {entities?.length ?? 0} entities
        </span>

        {showAddForm && (
          <AddRelationshipForm
            entities={entities ?? []}
            incidentId={incidentId}
            onCreated={refetchRels}
            onClose={() => setShowAddForm(false)}
          />
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 0, minHeight: 0 }}>
        <div style={{ flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: selectedEntity ? '8px 0 0 8px' : '8px', overflow: 'hidden', position: 'relative' }}>
          {isEmpty ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8b949e' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🕸</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e6edf3' }}>No entities yet</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Add entities to the incident first, then map relationships.</div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={3}
              colorMode="dark"
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#21262d" gap={20} />
              <Controls style={{ background: '#161b22', border: '1px solid #30363d' }} />
              <MiniMap
                nodeColor={(n) => {
                  const d = n.data as EntityNodeData | undefined;
                  return d?.color ?? '#8b949e';
                }}
                style={{ background: '#161b22', border: '1px solid #30363d' }}
              />
            </ReactFlow>
          )}
        </div>

        {selectedEntity && (
          <SidePanel entity={selectedEntity} onClose={() => setSelectedEntity(null)} />
        )}
      </div>

      <div style={{ marginTop: '10px', color: '#484f58', fontSize: '11px' }}>
        Click a node to view entity details. Drag nodes to reposition. Use Add Relationship to connect entities.
      </div>
    </div>
  );
}

export default function EntityRelationshipGraph({ incidentId }: { incidentId: string }) {
  const { isFeatureEnabled } = useLicense();
  if (!isFeatureEnabled('relationships')) {
    return <UpgradePrompt feature="relationships" requiredTier="professional" />;
  }
  return (
    <ReactFlowProvider>
      <div style={{ height: '560px', display: 'flex', flexDirection: 'column' }}>
        <GraphInner incidentId={incidentId} />
      </div>
    </ReactFlowProvider>
  );
}
