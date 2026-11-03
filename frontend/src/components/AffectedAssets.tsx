import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Entity } from '../types';
import { ENTITY_TYPE_ICONS, ENTITY_TYPE_COLORS, ENTITY_TYPE_LABELS } from '../utils/constants';
import EntityStatusBadge from './EntityStatusBadge';
import { apiClient } from '../api/client';

interface AffectedAssetsProps {
  incidentId: string;
  incidentTitle: string;
  entities: Entity[];
}

interface KillChainMatrixRow {
  entity_id: string;
  stage_name: string;
}

const IOC_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'CONFIRMED', color: '#f85149' },
  suspected: { label: 'SUSPECTED', color: '#d29922' },
  cleared: { label: 'CLEARED', color: '#3fb950' },
};

const CATEGORY_GROUPS: { label: string; types: string[] }[] = [
  { label: 'Endpoints & Workstations', types: ['hostname'] },
  { label: 'User Accounts', types: ['account'] },
  { label: 'Files & Malware', types: ['file', 'process', 'registry'] },
  { label: 'Network Infrastructure', types: ['ip', 'domain', 'url'] },
  { label: 'Email', types: ['email'] },
  { label: 'Certificates', types: ['certificate'] },
  { label: 'Other', types: ['custom'] },
];

function getCategoryForType(type: string): string {
  for (const g of CATEGORY_GROUPS) {
    if (g.types.includes(type)) return g.label;
  }
  return 'Other';
}

export default function AffectedAssets({ incidentId, incidentTitle, entities }: AffectedAssetsProps) {
  const [killChainMap, setKillChainMap] = useState<Record<string, string[]>>({});
  const [filter, setFilter] = useState<'all' | 'ioc'>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiClient
      .get(`/incidents/${incidentId}/kill-chain/matrix`)
      .then((r) => {
        const rows: KillChainMatrixRow[] = r.data ?? [];
        const map: Record<string, string[]> = {};
        for (const row of rows) {
          if (!map[row.entity_id]) map[row.entity_id] = [];
          map[row.entity_id].push(row.stage_name);
        }
        setKillChainMap(map);
      })
      .catch(() => {});
  }, [incidentId]);

  const extEntities = entities as (Entity & { ioc_status?: string })[];

  const filteredEntities =
    filter === 'ioc'
      ? extEntities.filter((e) => e.ioc_status === 'confirmed' || e.ioc_status === 'suspected')
      : extEntities;

  const confirmedCount = extEntities.filter((e) => e.ioc_status === 'confirmed').length;
  const suspectedCount = extEntities.filter((e) => e.ioc_status === 'suspected').length;
  const clearedCount = extEntities.filter((e) => e.ioc_status === 'cleared').length;

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function exportCsv() {
    const headers = ['Category', 'Type', 'Value', 'IOC Status', 'Entity Status', 'Kill Chain Stages', 'Notes'];
    const rows = filteredEntities.map((e) => {
      const category = getCategoryForType(e.type);
      const iocStatus = (e as Entity & { ioc_status?: string }).ioc_status ?? '';
      const stages = (killChainMap[e.id] ?? []).join('; ');
      const notes = e.notes ?? '';
      return [category, e.type, e.value, iocStatus, e.status, stages, notes].map((v) =>
        `"${String(v).replace(/"/g, '""')}"`,
      );
    });
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const date = new Date().toISOString().slice(0, 10);
    const safeName = incidentTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `entities-${safeName}-${date}.csv`;
    const uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const a = document.createElement('a');
    a.href = uri;
    a.download = filename;
    a.click();
  }

  const pillBtn = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px',
    borderRadius: '20px',
    border: active ? '1px solid #58a6ff' : '1px solid #30363d',
    background: active ? '#58a6ff22' : 'transparent',
    color: active ? '#58a6ff' : '#8b949e',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  });

  return (
    <div style={{ color: '#e6edf3' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#e6edf3' }}>Entity Inventory</div>
        <button type="button"
          onClick={exportCsv}
          style={{
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '6px 14px',
            color: '#8b949e',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          &#8595; Export CSV
        </button>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: '#8b949e', fontSize: '13px' }}>
          <strong style={{ color: '#e6edf3' }}>{extEntities.length}</strong> total entities
        </span>
        {confirmedCount > 0 && (
          <span style={{ background: '#f8514922', color: '#f85149', border: '1px solid #f8514944', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>
            {confirmedCount} Confirmed IOC
          </span>
        )}
        {suspectedCount > 0 && (
          <span style={{ background: '#d2992222', color: '#d29922', border: '1px solid #d2992244', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>
            {suspectedCount} Suspected IOC
          </span>
        )}
        {clearedCount > 0 && (
          <span style={{ background: '#3fb95022', color: '#3fb950', border: '1px solid #3fb95044', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>
            {clearedCount} Cleared
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
        <button type="button" style={pillBtn(filter === 'all')} onClick={() => setFilter('all')}>
          All Entities ({extEntities.length})
        </button>
        <button type="button" style={pillBtn(filter === 'ioc')} onClick={() => setFilter('ioc')}>
          Confirmed &amp; Suspected IOC only ({confirmedCount + suspectedCount})
        </button>
      </div>

      {filteredEntities.length === 0 && (
        <div style={{ color: '#8b949e', fontSize: '14px', padding: '24px 0' }}>No entities match the current filter.</div>
      )}

      {/* Groups */}
      {CATEGORY_GROUPS.map((group) => {
        const groupEntities = filteredEntities.filter((e) => group.types.includes(e.type));
        if (groupEntities.length === 0) return null;
        const collapsed = collapsedGroups.has(group.label);

        return (
          <div key={group.label} style={{ marginBottom: '16px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
            <button type="button"
              onClick={() => toggleGroup(group.label)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: collapsed ? 'none' : '1px solid #30363d',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ color: '#8b949e', fontSize: '11px', width: '12px' }}>{collapsed ? '▶' : '▼'}</span>
              <span style={{ color: '#c9d1d9', fontSize: '13px', fontWeight: 600, flex: 1 }}>{group.label}</span>
              <span style={{ background: '#21262d', color: '#8b949e', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}>
                {groupEntities.length}
              </span>
            </button>

            {!collapsed && groupEntities.map((e) => {
              const ext = e as Entity & { ioc_status?: string };
              const ioc = ext.ioc_status ? IOC_STATUS_DISPLAY[ext.ioc_status] : null;
              const stages = killChainMap[e.id] ?? [];

              return (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 16px',
                    borderBottom: '1px solid #21262d',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{
                    background: `${ENTITY_TYPE_COLORS[e.type]}22`,
                    color: ENTITY_TYPE_COLORS[e.type],
                    border: `1px solid ${ENTITY_TYPE_COLORS[e.type]}44`,
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    fontFamily: 'monospace',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                  }}>
                    <span>{ENTITY_TYPE_ICONS[e.type] ?? '•'}</span>
                    <span>{ENTITY_TYPE_LABELS[e.type] ?? e.type.toUpperCase()}</span>
                  </span>

                  <span style={{ color: '#e6edf3', fontSize: '13px', fontFamily: 'monospace', flex: 1, minWidth: '120px' }}>
                    {e.value}
                  </span>

                  {ioc ? (
                    <span style={{
                      background: `${ioc.color}22`,
                      color: ioc.color,
                      border: `1px solid ${ioc.color}44`,
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {ioc.label}
                    </span>
                  ) : (
                    <span style={{
                      background: '#8b949e22',
                      color: '#8b949e',
                      border: '1px solid #8b949e44',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      Unreviewed
                    </span>
                  )}

                  <EntityStatusBadge status={e.status ?? 'unreviewed'} compact />

                  <span style={{ color: stages.length ? '#8b949e' : '#484f58', fontSize: '12px', flexShrink: 0, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stages.length ? stages.join(', ') : '—'}
                  </span>

                  <Link
                    to={`/incidents/${incidentId}/entities/${e.id}`}
                    style={{ color: '#58a6ff', textDecoration: 'none', fontSize: '12px', flexShrink: 0 }}
                  >
                    View &rarr;
                  </Link>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
