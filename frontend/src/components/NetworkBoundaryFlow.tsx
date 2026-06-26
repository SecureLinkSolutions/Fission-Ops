import { useState, useCallback, useEffect } from 'react';
import { useLicense } from '../context/LicenseContext';
import UpgradePrompt from './UpgradePrompt';
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
import { NetworkBoundary, Entity } from '../types';
import { ENTITY_TYPE_ICONS } from '../utils/constants';

const ZONE_COLORS: Record<string, string> = {
  IT: '#58a6ff', OT: '#d29922', trusted: '#3fb950', untrusted: '#f85149', dmz: '#a371f7',
};

interface EntityZoneAssignment {
  entity_id: string;
  entity_type: string;
  entity_value: string;
  boundary_id: string;
  boundary_name: string;
  zone_type: string;
  entity_status?: string;
}

interface BoundaryTraversal {
  id: string;
  source_boundary_id: string;
  target_boundary_id: string;
  source_boundary_name: string;
  target_boundary_name: string;
  label?: string;
}

interface ZoneGroupData {
  label: string;
  zone_type: string;
  color: string;
  entities: EntityZoneAssignment[];
  onEntityDrop: (entityId: string, boundaryId: string) => void;
  boundaryId: string;
  [key: string]: unknown;
}

function ZoneGroupNode({ data }: NodeProps) {
  const d = data as ZoneGroupData;
  const color = d.color;
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const entityId = e.dataTransfer.getData('entityId');
        if (entityId) d.onEntityDrop(entityId, d.boundaryId);
      }}
      style={{
        background: isDragOver ? `${color}15` : `${color}08`,
        border: `2px solid ${isDragOver ? color : color + '55'}`,
        borderRadius: '10px',
        width: '260px',
        minHeight: '160px',
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
        boxShadow: isDragOver ? `0 0 18px ${color}55` : `0 0 8px ${color}18`,
        animation: 'nodeEntrance 0.35s ease-out',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, border: 'none', width: 10, height: 10 }} />
      {/* Header */}
      <div style={{
        background: `${color}22`, borderBottom: `1px solid ${color}44`,
        borderRadius: '8px 8px 0 0', padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{
          fontSize: '10px', fontWeight: 700, color,
          background: `${color}22`, border: `1px solid ${color}44`,
          borderRadius: '8px', padding: '2px 7px', textTransform: 'uppercase',
        }}>
          {d.zone_type}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#e6edf3', flex: 1 }}>{d.label}</span>
        <span style={{ fontSize: '11px', color, fontWeight: 600 }}>{d.entities.length}</span>
      </div>
      {/* Entities */}
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '80px' }}>
        {d.entities.map((ent) => (
          <div key={ent.entity_id} style={{
            background: '#21262d', border: '1px solid #30363d', borderRadius: '5px',
            padding: '4px 8px', fontSize: '11px', color: '#e6edf3',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span>{ENTITY_TYPE_ICONS[ent.entity_type] ?? '•'}</span>
            <span style={{ fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ent.entity_value}</span>
          </div>
        ))}
        {d.entities.length === 0 && (
          <div style={{ color: '#484f58', fontSize: '11px', textAlign: 'center', padding: '16px 0' }}>
            Drop entities here
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color, border: 'none', width: 10, height: 10 }} />
    </div>
  );
}

const nodeTypes = { zoneGroup: ZoneGroupNode };

interface TraversalModalProps {
  boundaries: NetworkBoundary[];
  onConfirm: (sourceId: string, targetId: string, label: string) => void;
  onClose: () => void;
}

function TraversalModal({ boundaries, onConfirm, onClose }: TraversalModalProps) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [label, setLabel] = useState('');

  const inputStyle: React.CSSProperties = {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px',
    padding: '8px 12px', color: '#e6edf3', fontSize: '13px', outline: 'none', width: '100%',
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: '10px',
        padding: '24px', width: '420px', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#e6edf3', marginBottom: '16px' }}>Add Traversal</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#8b949e', display: 'block', marginBottom: '4px' }}>Source Zone</label>
            <select style={inputStyle} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Select source...</option>
              {boundaries.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.zone_type})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#8b949e', display: 'block', marginBottom: '4px' }}>Label</label>
            <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Firewall bypass" />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#8b949e', display: 'block', marginBottom: '4px' }}>Target Zone</label>
            <select style={inputStyle} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select target...</option>
              {boundaries.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.zone_type})</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 16px', color: '#8b949e', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
          <button type="button"
            onClick={() => { if (sourceId && targetId) onConfirm(sourceId, targetId, label); }}
            disabled={!sourceId || !targetId}
            style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: (!sourceId || !targetId) ? 0.5 : 1 }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  incidentId: string;
}

interface NetworkBoundaryFlowInnerProps {
  incidentId: string;
}

function NetworkBoundaryFlowInner({ incidentId }: NetworkBoundaryFlowInnerProps) {
  const [showTraversalModal, setShowTraversalModal] = useState(false);
  const [newBoundaryName, setNewBoundaryName] = useState('');
  const [newBoundaryZone, setNewBoundaryZone] = useState('IT');
  const [saving, setSaving] = useState(false);

  const { data: boundaries, refetch: refetchBoundaries } = useFetch<NetworkBoundary[]>(
    () => apiClient.get(`/incidents/${incidentId}/boundaries`).then((r) => r.data),
    [incidentId],
  );

  const { data: entities } = useFetch<Entity[]>(
    () => apiClient.get(`/incidents/${incidentId}/entities`).then((r) => r.data),
    [incidentId],
  );

  const { data: zoneAssignments, refetch: refetchZones } = useFetch<EntityZoneAssignment[]>(
    () => apiClient.get(`/incidents/${incidentId}/boundary-viz/entity-zones`).then((r) => r.data),
    [incidentId],
  );

  const { data: traversals, refetch: refetchTraversals } = useFetch<BoundaryTraversal[]>(
    () => apiClient.get(`/incidents/${incidentId}/boundary-viz/traversals`).then((r) => r.data),
    [incidentId],
  );

  const handleEntityDrop = useCallback(async (entityId: string, boundaryId: string) => {
    await apiClient.post(`/incidents/${incidentId}/boundary-viz/entity-zones`, { entity_id: entityId, boundary_id: boundaryId });
    refetchZones();
  }, [incidentId, refetchZones]);

  const handleAddBoundary = async () => {
    if (!newBoundaryName) return;
    setSaving(true);
    try {
      await apiClient.post(`/incidents/${incidentId}/boundaries`, { name: newBoundaryName, zone_type: newBoundaryZone });
      setNewBoundaryName('');
      refetchBoundaries();
    } finally {
      setSaving(false);
    }
  };

  const handleAddTraversal = async (sourceId: string, targetId: string, label: string) => {
    await apiClient.post(`/incidents/${incidentId}/boundary-viz/traversals`, {
      source_boundary_id: sourceId,
      target_boundary_id: targetId,
      label: label || undefined,
    });
    setShowTraversalModal(false);
    refetchTraversals();
  };

  const buildNodes = useCallback((): Node[] => {
    if (!boundaries) return [];
    const cols = 2;
    const colWidth = 300;
    const rowHeight = 260;
    return (boundaries as NetworkBoundary[]).map((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const color = ZONE_COLORS[b.zone_type] ?? '#8b949e';
      const assignedEntities = (zoneAssignments ?? []).filter((za) => za.boundary_id === b.id);
      return {
        id: b.id,
        type: 'zoneGroup',
        position: { x: col * colWidth, y: row * rowHeight },
        data: {
          label: b.name,
          zone_type: b.zone_type,
          color,
          entities: assignedEntities,
          onEntityDrop: handleEntityDrop,
          boundaryId: b.id,
        } as ZoneGroupData,
        draggable: false,
      };
    });
  }, [boundaries, zoneAssignments, handleEntityDrop]);

  const buildEdges = useCallback((): Edge[] => {
    if (!traversals) return [];
    return (traversals as BoundaryTraversal[]).map((t) => ({
      id: t.id,
      source: t.source_boundary_id,
      target: t.target_boundary_id,
      label: t.label,
      animated: true,
      style: { stroke: '#58a6ff', strokeWidth: 2 },
      labelStyle: { fill: '#e6edf3', fontSize: 11 },
      labelBgStyle: { fill: '#161b22' },
    }));
  }, [traversals]);

  const storageKey = `netmap-positions-${incidentId}`;

  function loadSavedPositions(): Map<string, { x: number; y: number }> {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return new Map();
      return new Map(Object.entries(JSON.parse(raw)));
    } catch {
      return new Map();
    }
  }

  function saveNodePositions(ns: Node[]) {
    const obj: Record<string, { x: number; y: number }> = {};
    ns.forEach((n) => { obj[n.id] = n.position; });
    localStorage.setItem(storageKey, JSON.stringify(obj));
  }

  // Apply saved positions to nodes and make them draggable
  const baseNodes = buildNodes();
  const savedPositions = loadSavedPositions();
  const currentNodes = baseNodes.map((n) => ({
    ...n,
    draggable: true,
    position: savedPositions.get(n.id) ?? n.position,
  }));
  const currentEdges = buildEdges();

  const [nodes, setNodes, onNodesChange] = useNodesState(currentNodes);
  const [edges, , onEdgesChange] = useEdgesState(currentEdges);

  // Sync when boundary data changes, preserving dragged positions
  const boundaryIds = (boundaries ?? []).map((b: NetworkBoundary) => b.id).join(',');
  useEffect(() => {
    const base = buildNodes();
    const saved = loadSavedPositions();
    setNodes((prev) => {
      const stateMap = new Map(prev.map((p) => [p.id, p.position]));
      return base.map((n) => ({
        ...n,
        draggable: true,
        position: stateMap.get(n.id) ?? saved.get(n.id) ?? n.position,
      }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryIds, zoneAssignments]);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, _node: Node, allNodes: Node[]) => {
    saveNodePositions(allNodes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const assignedEntityIds = new Set((zoneAssignments ?? []).map((za) => za.entity_id));
  const unassignedEntities = (entities ?? []).filter((e) => !assignedEntityIds.has(e.id));

  const inputStyle: React.CSSProperties = {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px',
    padding: '7px 10px', color: '#e6edf3', fontSize: '12px', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <style>{`
        @keyframes nodeEntrance { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, width: '200px' }}
          placeholder="Boundary name..."
          value={newBoundaryName}
          onChange={(e) => setNewBoundaryName(e.target.value)}
        />
        <select style={{ ...inputStyle, width: '120px' }} value={newBoundaryZone} onChange={(e) => setNewBoundaryZone(e.target.value)}>
          {['IT', 'OT', 'trusted', 'untrusted', 'dmz'].map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <button type="button"
          onClick={handleAddBoundary}
          disabled={saving || !newBoundaryName}
          style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '7px 14px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: (!newBoundaryName || saving) ? 0.5 : 1 }}
        >
          Add Boundary
        </button>
        <button type="button"
          onClick={() => setShowTraversalModal(true)}
          style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 14px', color: '#8b949e', fontSize: '12px', cursor: 'pointer' }}
        >
          Add Traversal
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {/* Entities sidebar */}
        <div style={{
          width: '200px', flexShrink: 0, background: '#161b22', border: '1px solid #30363d',
          borderRadius: '8px', padding: '10px', overflowY: 'auto', maxHeight: '600px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', marginBottom: '8px' }}>
            Unassigned Entities
          </div>
          {unassignedEntities.length === 0 && (
            <div style={{ color: '#484f58', fontSize: '11px' }}>All entities assigned</div>
          )}
          {unassignedEntities.map((ent) => (
            <div
              key={ent.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('entityId', ent.id); }}
              style={{
                background: '#21262d', border: '1px solid #30363d', borderRadius: '5px',
                padding: '6px 8px', marginBottom: '5px', cursor: 'grab',
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#e6edf3',
              }}
            >
              <span>{ENTITY_TYPE_ICONS[ent.type] ?? '•'}</span>
              <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ent.value}</span>
            </div>
          ))}
        </div>

        {/* React Flow canvas */}
        <div style={{ flex: 1, height: '600px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
          <ReactFlow
            nodes={nodes}
            edges={currentEdges.length > 0 ? currentEdges : edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={handleNodeDragStop}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.3}
            maxZoom={2}
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#21262d" gap={20} />
            <Controls style={{ background: '#161b22', border: '1px solid #30363d' }} />
          </ReactFlow>
          {(boundaries ?? []).length === 0 && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#484f58', fontSize: '13px', pointerEvents: 'none' }}>
              Add boundaries to visualize zones
            </div>
          )}
        </div>
      </div>

      {showTraversalModal && (
        <TraversalModal
          boundaries={boundaries ?? []}
          onConfirm={handleAddTraversal}
          onClose={() => setShowTraversalModal(false)}
        />
      )}
    </div>
  );
}

export default function NetworkBoundaryFlow({ incidentId }: Props) {
  const { isFeatureEnabled } = useLicense();
  if (!isFeatureEnabled('network_boundaries')) {
    return <UpgradePrompt feature="network_boundaries" requiredTier="professional" />;
  }
  return (
    <ReactFlowProvider>
      <NetworkBoundaryFlowInner incidentId={incidentId} />
    </ReactFlowProvider>
  );
}
