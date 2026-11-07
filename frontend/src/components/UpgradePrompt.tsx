interface UpgradePromptProps {
  feature: string;
  requiredTier: 'professional' | 'enterprise';
}

const TIER_COLORS: Record<string, string> = {
  professional: '#58a6ff',
  enterprise: '#a371f7',
};

const TIER_LABELS: Record<string, string> = {
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export default function UpgradePrompt({ feature, requiredTier }: UpgradePromptProps) {
  const color = TIER_COLORS[requiredTier] ?? '#58a6ff';
  const tierLabel = TIER_LABELS[requiredTier] ?? requiredTier;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 32px',
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: '12px',
      textAlign: 'center',
      gap: '16px',
    }}>
      <div style={{
        width: '56px', height: '56px',
        background: `${color}18`,
        border: `2px solid ${color}44`,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px', fontWeight: 700, color,
      }}>
        {tierLabel.charAt(0)}
      </div>
      <div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#e6edf3', marginBottom: '6px' }}>
          {formatFeatureName(feature)} Locked
        </div>
        <div style={{ fontSize: '13px', color: '#8b949e', maxWidth: '320px', lineHeight: '1.5' }}>
          This feature requires a{' '}
          <span style={{ color, fontWeight: 600 }}>{tierLabel}</span>{' '}
          license or higher.
        </div>
      </div>
      <div style={{
        background: `${color}12`,
        border: `1px solid ${color}33`,
        borderRadius: '8px',
        padding: '12px 20px',
        fontSize: '13px',
        color: '#8b949e',
      }}>
        Contact your administrator to upgrade your license.
      </div>
    </div>
  );
}

function formatFeatureName(feature: string): string {
  return feature
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
