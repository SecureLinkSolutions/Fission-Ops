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
  EdgeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  ConnectionMode,
} from '@xyflow/react';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Entity, EntityRelationship } from '../types';
import EntityStatusBadge from './EntityStatusBadge';

const ENTITY_TYPE_ICONS: Record<string, string> = { hostname: '🖥', ip: '🌐', email: '📧', domain: '🔗', account: '👤', file: '📄', process: '🔧', registry: '🗝', certificate: '🏅', url: '🌍', custom: '📌' };
const ENTITY_TYPE_COLORS: Record<string, string> = { hostname: '#58a6ff', ip: '#3fb950', email: '#d29922', domain: '#a371f7', account: '#f0883e', file: '#79c0ff', process: '#79c0ff', registry: '#d2a8ff', certificate: '#56d364', url: '#ffa657', custom: '#8b949e' };
const RELATIONSHIP_SUGGESTIONS = ['visited', 'downloaded', 'executed', 'communicated_with', 'owns', 'hosted_on', 'resolved_to', 'lateral_movement_to', 'authenticated_to', 'spawned'];

interface EntityNodeData {
  entity: Entity;
  color: string;
  [key: string]: unknown;
}

function EntityNode({ data, selected }: NodeProps) {
  const d = data as EntityNodeData;
  const { entity, color } = d;
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected ? `${color}22` : hovered ? `${color}11` : '#161b22',
        border: `2px solid ${selected ? color : hovered ? color + 'aa' : color + '66'}`,
        borderRadius: '10px',
        padding: '10px 14px',
        minWidth: '140px',
        maxWidth: '200px',
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        boxShadow: hovered || selected ? `0 0 12px ${color}44` : '0 1px 4px rgba(0,0,0,0.4)',
        animation: 'nodeEntrance 0.3s ease-out',
      }}
    >
      <Handle type="target" id="left"   position={Position.Left}   style={{ background: color, width: 9, height: 9, border: '2px solid #0d1117' }} />
      <Handle type="target" id="top"    position={Position.Top}    style={{ background: color, width: 9, height: 9, border: '2px solid #0d1117' }} />
      <Handle type="source" id="right"  position={Position.Right}  style={{ background: color, width: 9, height: 9, border: '2px solid #0d1117' }} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ background: color, width: 9, height: 9, border: '2px solid #0d1117' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontSize: '16px' }}>{ENTITY_TYPE_ICONS[entity.type] ?? '•'}</span>
        <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>{entity.type}</span>
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entity.value}
      </div>
      {entity.status && entity.status !== 'unreviewed' && (
        <div style={{ marginTop: '4px' }}>
          <EntityStatusBadge status={entity.status} compact />
        </div>
      )}
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

function DirectionalEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  data, label, markerEnd, markerStart,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const bidirectional = (data as { bidirectional?: boolean } | undefined)?.bidirectional ?? false;
  const edgeId = `flow-${id}`;

  return (
    <>
      <defs>
        <marker id={`arrow-end-${id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#58a6ff99" />
        </marker>
        {bidirectional && (
          <marker id={`arrow-start-${id}`} markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto-start-reverse">
            <path d="M0,0 L0,6 L8,3 z" fill="#a371f799" />
          </marker>
        )}
      </defs>

      {/* Base path */}
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} markerStart={bidirectional ? markerStart : undefined} style={{ stroke: bidirectional ? '#a371f755' : '#58a6ff55', strokeWidth: 2 }} />

      {/* Animated flow particle — forward direction */}
      <path id={edgeId} d={edgePath} fill="none" stroke="none" />
      <circle r="4" fill={bidirectional ? '#a371f7' : '#58a6ff'} opacity="0.85">
        <animateMotion dur={bidirectional ? '1.8s' : '2.2s'} repeatCount="indefinite" rotate="auto">
          <mpath href={`#${edgeId}`} />
        </animateMotion>
      </circle>

      {/* Bidirectional: second particle going backwards */}
      {bidirectional && (
        <circle r="4" fill="#58a6ff" opacity="0.85">
          <animateMotion dur="1.8s" repeatCount="indefinite" rotate="auto" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
            <mpath href={`#${edgeId}`} />
          </animateMotion>
        </circle>
      )}

      {/* Edge label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              background: '#161b22',
              border: `1px solid ${bidirectional ? '#a371f744' : '#58a6ff44'}`,
              borderRadius: '4px',
              padding: '2px 7px',
              fontSize: '10px',
              color: bidirectional ? '#a371f7' : '#58a6ff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
            className="nodrag nopan"
          >
            {bidirectional ? '⇄' : '→'} {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = { directional: DirectionalEdge };


const LABEL_MAP: Record<string, string> = {
  sha256: 'SHA-256', md5: 'MD5', sha1: 'SHA-1', file_size: 'File Size', file_type: 'File Type',
  file_path: 'File Path', first_seen: 'First Seen', last_seen: 'Last Seen',
  signature_status: 'Signature Status', asn: 'ASN', isp: 'ISP/Organization', open_ports: 'Open Ports',
  reverse_dns: 'Reverse DNS', registrar: 'Registrar', registration_date: 'Registration Date',
  expiry_date: 'Expiry Date', nameservers: 'Nameservers', a_records: 'A Records',
  mx_records: 'MX Records', whois_data: 'WHOIS Data', full_url: 'Full URL',
  http_status: 'HTTP Status', redirect_chain: 'Redirect Chain', page_title: 'Page Title',
  hosting_ip: 'Hosting IP', username: 'Username', account_type: 'Account Type',
  last_login: 'Last Login', mfa_enabled: 'MFA Enabled', created_date: 'Created Date',
  ip_address: 'IP Address', operating_system: 'Operating System', os_version: 'OS Version',
  mac_address: 'MAC Address', domain_joined: 'Domain Joined', sender_address: 'Sender Address',
  recipients: 'Recipients', date_sent: 'Date Sent', sending_ip: 'Sending IP',
  attachments: 'Attachments', process_name: 'Process Name', pid: 'PID',
  parent_process: 'Parent Process', command_line: 'Command Line', executable_path: 'Executable Path',
  user_context: 'User Context', key_path: 'Key Path', value_name: 'Value Name',
  value_data: 'Value Data', last_modified: 'Last Modified', serial_number: 'Serial Number',
  valid_from: 'Valid From', valid_to: 'Valid To', thumbprint: 'Thumbprint',
};

function humanLabel(key: string): string {
  return LABEL_MAP[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

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

      {e.status && (
        <div style={{ marginBottom: '12px' }}>
          <EntityStatusBadge status={e.status} />
        </div>
      )}
      {e.notes && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Notes</div>
          <div style={{ color: '#c9d1d9', fontSize: '13px', lineHeight: '1.5' }}>{e.notes}</div>
        </div>
      )}

      {e.entity_details && Object.keys(e.entity_details).length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Metadata</div>
          {Object.entries(e.entity_details).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #21262d' }}>
              <span style={{ color: '#8b949e', fontSize: '12px' }}>{humanLabel(k)}</span>
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
  presetSource?: string;
  presetTarget?: string;
}

function AddRelationshipForm({ entities, incidentId, onCreated, onClose, presetSource, presetTarget }: AddRelationshipFormProps) {
  const [source, setSource] = useState(presetSource ?? '');
  const [target, setTarget] = useState(presetTarget ?? '');
  const [relType, setRelType] = useState('');
  const [notes, setNotes] = useState('');
  const [bidirectional, setBidirectional] = useState(false);
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
        source_entity_id: source, target_entity_id: target, relationship_type: relType,
        bidirectional, notes: notes || undefined,
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
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
        <input type="checkbox" checked={bidirectional} onChange={(e) => setBidirectional(e.target.checked)} />
        <span style={{ color: '#c9d1d9', fontSize: '13px' }}>Bidirectional relationship <span style={{ color: '#a371f7', fontSize: '11px' }}>⇄</span></span>
      </label>
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
  const [connectPreset, setConnectPreset] = useState<{ source: string; target: string } | null>(null);

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
      type: 'directional',
      data: { bidirectional: r.bidirectional },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#58a6ff99' },
      markerStart: r.bidirectional ? { type: MarkerType.ArrowClosed, color: '#a371f799' } : undefined,
    }));

    return { nodes, edges };
  }, [entities, relationships]);

  const storageKey = `relgraph-positions-${incidentId}`;

  function loadSavedPositions(): Map<string, { x: number; y: number }> {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return new Map();
      return new Map(Object.entries(JSON.parse(raw)));
    } catch {
      return new Map();
    }
  }

  function savePositions(ns: Node[]) {
    const obj: Record<string, { x: number; y: number }> = {};
    ns.forEach((n) => { obj[n.id] = n.position; });
    localStorage.setItem(storageKey, JSON.stringify(obj));
  }

  const { nodes: initNodes, edges: initEdges } = buildGraph();
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  // Only reset node positions when the set of entity IDs changes (new/removed entities).
  // Prefer saved positions (localStorage) over default grid, then fall back to existing state.
  const entityIds = (entities ?? []).map((e) => e.id).join(',');
  useEffect(() => {
    const { nodes: n } = buildGraph();
    const saved = loadSavedPositions();
    setNodes((prev) => {
      const stateMap = new Map(prev.map((p) => [p.id, p.position]));
      return n.map((node) => ({
        ...node,
        position: saved.get(node.id) ?? stateMap.get(node.id) ?? node.position,
      }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityIds]);

  useEffect(() => {
    const { edges: e } = buildGraph();
    setEdges(e);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationships]);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, _node: Node, allNodes: Node[]) => {
    savePositions(allNodes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const autoLayout = useCallback(() => {
    const ents = entities ?? [];
    const cols = 4;
    const newNodes = ents.map((e, i) => ({
      id: e.id,
      type: 'entity',
      position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 140 },
      data: { entity: e, color: ENTITY_TYPE_COLORS[e.type] ?? '#8b949e' } as EntityNodeData,
    }));
    setNodes(newNodes);
    savePositions(newNodes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, setNodes, storageKey]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as EntityNodeData;
    setSelectedEntity((prev) => prev?.id === d.entity.id ? null : d.entity);
    setShowAddForm(false);
  }, []);

  const handleConnect = useCallback((connection: { source: string | null; target: string | null }) => {
    if (!connection.source || !connection.target) return;
    setConnectPreset({ source: connection.source, target: connection.target });
    setShowAddForm(true);
    setSelectedEntity(null);
  }, []);

  const isEmpty = !entities?.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        @keyframes nodeEntrance { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
      `}</style>
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
            presetSource={connectPreset?.source}
            presetTarget={connectPreset?.target}
            onClose={() => { setShowAddForm(false); setConnectPreset(null); }}
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
              edgeTypes={edgeTypes}
              onNodeClick={handleNodeClick}
              onNodeDragStop={handleNodeDragStop}
              onConnect={handleConnect}
              connectionMode={ConnectionMode.Loose}
              connectionLineStyle={{ stroke: '#58a6ff', strokeWidth: 2, strokeDasharray: '6 3' }}
              connectionRadius={40}
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
          <div style={{ padding: '6px 10px', borderTop: '1px solid #21262d', background: '#0d1117', borderRadius: '0 0 8px 8px' }}>
            <span style={{ color: '#484f58', fontSize: '11px' }}>
              Click a node to view details · Drag between connection points to link entities · Drag nodes to reposition
            </span>
          </div>
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
