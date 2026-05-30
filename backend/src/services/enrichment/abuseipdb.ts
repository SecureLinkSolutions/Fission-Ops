import axios from 'axios';

export interface AbuseIPDBResult {
  abuse_confidence_score: number;
  country: string;
  isp: string;
  total_reports: number;
}

export async function queryAbuseIPDB(apiKey: string, ip: string): Promise<AbuseIPDBResult | null> {
  try {
    const response = await axios.get('https://api.abuseipdb.com/api/v2/check', {
      headers: { Key: apiKey, Accept: 'application/json' },
      params: { ipAddress: ip, maxAgeInDays: 90 },
      timeout: 10000,
    });

    const d = response.data?.data;
    if (!d) return null;

    return {
      abuse_confidence_score: d.abuseConfidenceScore ?? 0,
      country: d.countryCode ?? '',
      isp: d.isp ?? '',
      total_reports: d.totalReports ?? 0,
    };
  } catch {
    return null;
  }
}
