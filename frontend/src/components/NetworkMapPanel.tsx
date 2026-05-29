import { NetworkBoundary } from '../types';

interface Props {
  boundaries: NetworkBoundary[];
}

const ZONE_COLORS: Record<string, string> = { IT: '#58a6ff', OT: '#d29922', trusted: '#3fb950', untrusted: '#f85149', dmz: '#a371f7' };

export default function NetworkMapPanel({ boundaries }: Props) {
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#e6edf3', marginBottom: '16px' }}>Network Boundaries</div>
      {boundaries.length === 0 ? (
        <div style={{ color: '#8b949e', fontSize: '13px' }}>No boundaries defined for this incident.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {boundaries.map((b) => {
            const color = ZONE_COLORS[b.zone_type] ?? '#8b949e';
            return (
              <div key={b.id} style={{ background: `${color}11`, border: `1px solid ${color}44`, borderRadius: '8px', padding: '14px' }}>
                <div style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, display: 'inline-block', marginBottom: '6px' }}>{b.zone_type}</div>
                <div style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600 }}>{b.name}</div>
                {b.description && <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '4px' }}>{b.description}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
