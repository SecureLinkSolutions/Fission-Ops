import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient } from '../api/client';

interface LicenseStatus {
  tier: string;
  features: string[];
  max_users: number;
  max_incidents: number;
  expires_at: string | null;
  grace_mode: boolean;
  grace_mode_expired: boolean;
  fingerprint_warning: boolean;
  validated_ok: boolean;
  license_key: string | null;
}

interface LicenseContextValue {
  tier: string;
  features: string[];
  max_users: number;
  max_incidents: number;
  expires_at: string | null;
  grace_mode: boolean;
  grace_mode_expired: boolean;
  fingerprint_warning: boolean;
  validated_ok: boolean;
  license_key: string | null;
  isFeatureEnabled: (feature: string) => boolean;
  refresh: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

const DEFAULT_STATUS: LicenseStatus = {
  tier: 'starter',
  features: [],
  max_users: 3,
  max_incidents: 10,
  expires_at: null,
  grace_mode: false,
  grace_mode_expired: false,
  fingerprint_warning: false,
  validated_ok: false,
  license_key: null,
};

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus>(DEFAULT_STATUS);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<LicenseStatus>('/license/status');
      setStatus(res.data);
    } catch {
      // Keep defaults on error
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const isFeatureEnabled = useCallback((feature: string): boolean => {
    // If no license key is configured (no validated_ok and no license_key), full access
    if (!status.license_key && !status.validated_ok) return true;
    if (status.grace_mode_expired) {
      return ['core_incidents', 'basic_kill_chain'].includes(feature);
    }
    return status.features.includes(feature);
  }, [status]);

  return (
    <LicenseContext.Provider value={{
      ...status,
      isFeatureEnabled,
      refresh: fetchStatus,
    }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider');
  return ctx;
}
