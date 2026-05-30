import axios from 'axios';

export interface VTResult {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  engines_total: number;
}

export async function queryVirusTotal(apiKey: string, type: string, value: string): Promise<VTResult | null> {
  try {
    let endpoint = '';
    const encodedValue = encodeURIComponent(value);

    if (type === 'ip') {
      endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${encodedValue}`;
    } else if (type === 'domain' || type === 'hostname') {
      endpoint = `https://www.virustotal.com/api/v3/domains/${encodedValue}`;
    } else if (type === 'email') {
      // email not directly supported, skip
      return null;
    } else {
      // treat as URL
      const urlId = Buffer.from(value).toString('base64').replace(/=/g, '');
      endpoint = `https://www.virustotal.com/api/v3/urls/${urlId}`;
    }

    const response = await axios.get(endpoint, {
      headers: { 'x-apikey': apiKey },
      timeout: 10000,
    });

    const stats = response.data?.data?.attributes?.last_analysis_stats;
    if (!stats) return null;

    return {
      malicious: stats.malicious ?? 0,
      suspicious: stats.suspicious ?? 0,
      harmless: stats.harmless ?? 0,
      undetected: stats.undetected ?? 0,
      engines_total: (stats.malicious ?? 0) + (stats.suspicious ?? 0) + (stats.harmless ?? 0) + (stats.undetected ?? 0),
    };
  } catch {
    return null;
  }
}
