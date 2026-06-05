import { EntityStatus } from '../types';

export const ENTITY_STATUS_CONFIG: Record<EntityStatus, { color: string; label: string; shortLabel: string; icon: string }> = {
  unreviewed: { color: '#8b949e', label: 'Unreviewed', shortLabel: 'Unreviewed', icon: '○' },
  under_investigation: { color: '#58a6ff', label: 'Under Investigation', shortLabel: 'Investigating', icon: '⬡' },
  isolated: { color: '#f0883e', label: 'Isolated', shortLabel: 'Isolated', icon: '⊘' },
  contained: { color: '#e3b341', label: 'Contained', shortLabel: 'Contained', icon: '⬟' },
  cleared: { color: '#3fb950', label: 'Cleared', shortLabel: 'Cleared', icon: '✓' },
  confirmed_malicious: { color: '#f85149', label: 'Confirmed Malicious', shortLabel: 'Malicious', icon: '✕' },
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
        gap: '4px',
        whiteSpace: 'nowrap',
      }}>
        <span style={{
          color: cfg.color,
          fontSize: '10px',
          lineHeight: 1,
          fontWeight: 700,
        }}>
          {cfg.icon}
        </span>
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
      <span style={{ fontSize: '11px', lineHeight: 1 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
