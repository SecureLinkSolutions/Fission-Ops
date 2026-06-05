import { EntityStatus } from '../types';

export const ENTITY_STATUS_CONFIG: Record<EntityStatus, { color: string; label: string; shortLabel: string }> = {
  unreviewed: { color: '#8b949e', label: 'Unreviewed', shortLabel: 'Unreviewed' },
  under_investigation: { color: '#58a6ff', label: 'Under Investigation', shortLabel: 'Investigating' },
  isolated: { color: '#f0883e', label: 'Isolated', shortLabel: 'Isolated' },
  contained: { color: '#e3b341', label: 'Contained', shortLabel: 'Contained' },
  cleared: { color: '#3fb950', label: 'Cleared', shortLabel: 'Cleared' },
  confirmed_malicious: { color: '#f85149', label: 'Confirmed Malicious', shortLabel: 'Malicious' },
};

interface Props {
  status: EntityStatus | string;
  compact?: boolean;
}

export default function EntityStatusBadge({ status, compact }: Props) {
  const cfg = ENTITY_STATUS_CONFIG[status as EntityStatus] ?? { color: '#8b949e', label: status, shortLabel: status };

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        whiteSpace: 'nowrap',
      }}>
        <span style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
          display: 'inline-block',
        }} />
        <span style={{
          color: cfg.color,
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.01em',
        }}>
          {cfg.shortLabel}
        </span>
      </span>
    );
  }

  return (
    <span style={{
      background: `${cfg.color}18`,
      color: cfg.color,
      border: `1px solid ${cfg.color}55`,
      borderRadius: '4px',
      padding: '3px 8px',
      fontSize: '11px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      letterSpacing: '0.02em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}
