import axios from 'axios';

export interface ShodanResult {
  ports: number[];
  vulns: string[];
  org: string;
  os: string;
}

export async function queryShodan(apiKey: string, ip: string): Promise<ShodanResult | null> {
  try {
    const response = await axios.get(`https://api.shodan.io/shodan/host/${ip}`, {
      params: { key: apiKey },
      timeout: 10000,
    });

    const d = response.data;
    return {
      ports: d.ports ?? [],
      vulns: d.vulns ? Object.keys(d.vulns) : [],
      org: d.org ?? '',
      os: d.os ?? '',
    };
  } catch {
    return null;
  }
}
