import { IncidentOperationalStatus } from '../types';

export const INCIDENT_STATUS_CONFIG: Record<IncidentOperationalStatus, { color: string; label: string }> = {
  active: { color: '#f85149', label: 'Active' },
  contained: { color: '#f0883e', label: 'Contained' },
  eradicated: { color: '#e3b341', label: 'Eradicated' },
  recovered: { color: '#58a6ff', label: 'Recovered' },
  closed: { color: '#8b949e', label: 'Closed' },
};

interface Props {
  status: IncidentOperationalStatus | string;
}

export default function IncidentStatusBadge({ status }: Props) {
  const cfg = INCIDENT_STATUS_CONFIG[status as IncidentOperationalStatus] ?? { color: '#8b949e', label: status };
  return (
    <span style={{
      background: `${cfg.color}22`,
      color: cfg.color,
      border: `1px solid ${cfg.color}44`,
      borderRadius: '12px',
      padding: '3px 10px',
      fontSize: '11px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}
