import { useState } from 'react';
import { apiClient } from '../api/client';
import { useLicense } from '../context/LicenseContext';

export default function LicenseAdmin() {
  const license = useLicense();
  const [newKey, setNewKey] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');

  const TIER_COLORS: Record<string, string> = {
    starter: '#8b949e',
    professional: '#58a6ff',
    enterprise: '#a371f7',
  };

  const tierColor = TIER_COLORS[license.tier] ?? '#8b949e';

  async function handleUpdateLicense() {
    if (!newKey.trim()) {
      setUpdateError('Please enter a license key.');
      return;
    }
    setUpdating(true);
    setUpdateError('');
    setUpdateSuccess('');
    try {
      await apiClient.post('/license/activate', { license_key: newKey.trim() });
      await license.refresh();
      setUpdateSuccess('License updated successfully!');
      setNewKey('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setUpdateError(e.response?.data?.error ?? 'Failed to update license.');
    } finally {
      setUpdating(false);
    }
  }

  const expiresDate = license.expires_at ? new Date(license.expires_at) : null;
  const daysUntilExpiry = expiresDate
    ? Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e6edf3', marginBottom: '24px' }}>
        License Management
      </h1>

      {/* Grace mode warning */}
      {license.grace_mode && (
        <div style={{
          background: license.grace_mode_expired ? '#3a1a1a' : '#3a2a1a',
          border: `1px solid ${license.grace_mode_expired ? '#6a2d2d' : '#6a4f2d'}`,
          borderRadius: '8px',
          padding: '14px 16px',
          marginBottom: '20px',
          color: license.grace_mode_expired ? '#f85149' : '#d29922',
          fontSize: '13px',
        }}>
          {license.grace_mode_expired
            ? '⛔ Grace period expired. Enterprise features are locked. Please update your license.'
            : '⚠️ License server unreachable. Running in grace mode — features remain active temporarily.'}
        </div>
      )}

      {/* Fingerprint warning */}
      {license.fingerprint_warning && (
        <div style={{
          background: '#3a2a1a', border: '1px solid #6a4f2d',
          borderRadius: '8px', padding: '14px 16px', marginBottom: '20px',
          color: '#d29922', fontSize: '13px',
        }}>
          ⚠️ Deployment fingerprint mismatch detected. If this is unexpected, contact your vendor.
        </div>
      )}

      {/* Current license card */}
      <div style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: '12px', padding: '24px', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{
            background: `${tierColor}18`,
            border: `1px solid ${tierColor}44`,
            borderRadius: '20px',
            padding: '4px 16px',
            color: tierColor,
            fontSize: '14px',
            fontWeight: 700,
            textTransform: 'capitalize' as const,
          }}>
            {license.tier} Tier
          </span>
          {license.validated_ok && (
            <span style={{ color: '#3fb950', fontSize: '12px' }}>✓ Validated</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: '#0d1117', borderRadius: '8px', padding: '14px' }}>
            <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Expiry</div>
            <div style={{ color: daysUntilExpiry !== null && daysUntilExpiry < 30 ? '#d29922' : '#e6edf3', fontSize: '15px', fontWeight: 600 }}>
              {expiresDate ? expiresDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
            </div>
            {daysUntilExpiry !== null && (
              <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '2px' }}>{daysUntilExpiry} days remaining</div>
            )}
          </div>
          <div style={{ background: '#0d1117', borderRadius: '8px', padding: '14px' }}>
            <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Max Users</div>
            <div style={{ color: '#e6edf3', fontSize: '15px', fontWeight: 600 }}>{license.max_users}</div>
          </div>
          <div style={{ background: '#0d1117', borderRadius: '8px', padding: '14px' }}>
            <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Max Incidents</div>
            <div style={{ color: '#e6edf3', fontSize: '15px', fontWeight: 600 }}>{license.max_incidents}</div>
          </div>
        </div>

        {/* Features */}
        {license.features.length > 0 && (
          <div>
            <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Enabled Features
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {license.features.map((f) => (
                <span key={f} style={{
                  background: '#1a3a2a', border: '1px solid #2d6a3f',
                  borderRadius: '4px', padding: '2px 8px',
                  color: '#3fb950', fontSize: '11px',
                }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Update license */}
      <div style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: '12px', padding: '24px',
      }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Update License Key</h2>

        {updateError && (
          <div style={{
            background: '#3a1a1a', border: '1px solid #6a2d2d',
            borderRadius: '6px', padding: '10px 14px',
            color: '#f85149', fontSize: '13px', marginBottom: '12px',
          }}>
            {updateError}
          </div>
        )}
        {updateSuccess && (
          <div style={{
            background: '#1a3a2a', border: '1px solid #2d6a3f',
            borderRadius: '6px', padding: '10px 14px',
            color: '#3fb950', fontSize: '13px', marginBottom: '12px',
          }}>
            {updateSuccess}
          </div>
        )}

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            New License Key
          </label>
          <textarea
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Paste new license key here..."
            rows={4}
            style={{
              width: '100%',
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '10px 12px',
              color: '#3fb950',
              fontFamily: 'monospace',
              fontSize: '11px',
              resize: 'vertical',
              outline: 'none',
              lineHeight: '1.6',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button type="button"
          onClick={handleUpdateLicense}
          disabled={updating}
          style={{
            background: updating ? '#21262d' : '#238636',
            border: '1px solid',
            borderColor: updating ? '#30363d' : '#2ea043',
            borderRadius: '6px',
            padding: '8px 20px',
            color: updating ? '#8b949e' : '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: updating ? 'not-allowed' : 'pointer',
          }}
        >
          {updating ? 'Updating…' : 'Update License'}
        </button>
      </div>
    </div>
  );
}
