import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useLicense } from '../context/LicenseContext';

export default function LicenseActivation() {
  const navigate = useNavigate();
  const { refresh } = useLicense();
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<null | {
    tier: string;
    features: string[];
    expires_at: string | null;
  }>(null);

  const TIER_COLORS: Record<string, string> = {
    starter: '#8b949e',
    professional: '#58a6ff',
    enterprise: '#a371f7',
  };

  async function handleActivate() {
    if (!licenseKey.trim()) {
      setError('Please enter a license key.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/license/activate', { license_key: licenseKey.trim() });
      setSuccess(res.data);
      await refresh();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? 'Activation failed. Please check the license key.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e6edf3', marginBottom: '8px' }}>
            Activate Fission Ops
          </h1>
          <p style={{ color: '#8b949e', fontSize: '14px' }}>
            Enter your license key to unlock your tier's features.
          </p>
        </div>

        {!success ? (
          <div style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '12px',
            padding: '28px',
          }}>
            {error && (
              <div style={{
                background: '#3a1a1a', border: '1px solid #6a2d2d',
                borderRadius: '6px', padding: '10px 14px',
                color: '#f85149', fontSize: '13px', marginBottom: '16px',
              }}>
                {error}
              </div>
            )}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                License Key
              </label>
              <textarea
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Paste your license key here..."
                rows={5}
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
                onFocus={(e) => e.target.style.borderColor = '#58a6ff'}
                onBlur={(e) => e.target.style.borderColor = '#30363d'}
              />
            </div>
            <button type="button"
              onClick={handleActivate}
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#21262d' : '#238636',
                border: '1px solid',
                borderColor: loading ? '#30363d' : '#2ea043',
                borderRadius: '6px',
                padding: '10px',
                color: loading ? '#8b949e' : '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {loading ? 'Activating…' : 'Activate License'}
            </button>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button type="button"
                onClick={() => navigate('/login')}
                style={{ background: 'none', border: 'none', color: '#58a6ff', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Skip — Continue without license
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#161b22',
            border: '1px solid #2d6a3f',
            borderRadius: '12px',
            padding: '28px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
            <h2 style={{ fontSize: '18px', color: '#3fb950', marginBottom: '8px' }}>License Activated!</h2>
            <div style={{ marginBottom: '20px' }}>
              <span style={{
                background: `${TIER_COLORS[success.tier] ?? '#8b949e'}18`,
                border: `1px solid ${TIER_COLORS[success.tier] ?? '#8b949e'}44`,
                borderRadius: '20px',
                padding: '4px 14px',
                color: TIER_COLORS[success.tier] ?? '#8b949e',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'capitalize' as const,
              }}>
                {success.tier} Tier
              </span>
            </div>
            {success.expires_at && (
              <p style={{ color: '#8b949e', fontSize: '13px', marginBottom: '12px' }}>
                Valid until {new Date(success.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
            <div style={{ marginBottom: '20px', textAlign: 'left' }}>
              <p style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Enabled Features
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {success.features.map((f) => (
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
            <button type="button"
              onClick={() => navigate('/register')}
              style={{
                width: '100%',
                background: '#238636',
                border: '1px solid #2ea043',
                borderRadius: '6px',
                padding: '10px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Continue to Setup →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
