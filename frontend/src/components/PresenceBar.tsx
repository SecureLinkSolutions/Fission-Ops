import { PresenceUser } from '../hooks/useIncidentSocket';

const COLORS = ['#58a6ff', '#3fb950', '#d29922', '#a371f7', '#f0883e', '#f85149'];

function getColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name: string, email: string): string {
  const n = name || email;
  const parts = n.split(/[\s@.]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

interface PresenceBarProps {
  presenceList: PresenceUser[];
  connected: boolean;
}

export default function PresenceBar({ presenceList, connected }: PresenceBarProps) {
  if (!presenceList.length && !connected) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: '#8b949e', fontSize: '12px' }}>Online:</span>
      {presenceList.map((user) => {
        const color = getColor(user.userId);
        return (
          <div
            key={user.userId}
            title={user.name || user.email}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: `${color}33`,
              border: `2px solid ${color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
              color,
              position: 'relative',
            }}
          >
            {initials(user.name, user.email)}
            <span style={{
              position: 'absolute',
              bottom: '-1px',
              right: '-1px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#3fb950',
              border: '1px solid #0d1117',
            }} />
          </div>
        );
      })}
    </div>
  );
}
