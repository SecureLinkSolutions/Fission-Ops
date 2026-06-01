import { EntityStatus } from '../types';

export const ENTITY_STATUS_CONFIG: Record<EntityStatus, { color: string; icon: string; label: string }> = {
  unreviewed: { color: '#8b949e', icon: '○', label: 'Unreviewed' },
  under_investigation: { color: '#58a6ff', icon: '🔍', label: 'Under Investigation' },
  isolated: { color: '#f0883e', icon: '🛡', label: 'Isolated' },
  contained: { color: '#e3b341', icon: '🔒', label: 'Contained' },
  cleared: { color: '#3fb950', icon: '✓', label: 'Cleared' },
  confirmed_malicious: { color: '#f85149', icon: '☠', label: 'Confirmed Malicious' },
};

interface Props {
  status: EntityStatus | string;
  compact?: boolean;
}

export default function EntityStatusBadge({ status, compact }: Props) {
  const cfg = ENTITY_STATUS_CONFIG[status as EntityStatus] ?? { color: '#8b949e', icon: '○', label: status };
  return (
    <span style={{
      background: `${cfg.color}22`,
      color: cfg.color,
      border: `1px solid ${cfg.color}44`,
      borderRadius: '12px',
      padding: compact ? '1px 6px' : '3px 10px',
      fontSize: compact ? '10px' : '11px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}
