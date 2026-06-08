export const ROLE_RANK: Record<string, number> = {
  analyst: 1,
  senior_analyst: 2,
  incident_commander: 3,
  platform_admin: 99,
};

export const SEVERITY_COLORS: Record<string, string> = {
  low: '#3fb950',
  medium: '#d29922',
  high: '#f85149',
  critical: '#ff7b72',
};

export const INCIDENT_STATUS_COLORS: Record<string, string> = {
  open: '#58a6ff',
  contained: '#d29922',
  closed: '#8b949e',
};

export const ENTITY_TYPE_ICONS: Record<string, string> = {
  hostname: '🖥',
  ip: '🌐',
  email: '📧',
  domain: '🔗',
  account: '👤',
  file: '📄',
  process: '🔧',
  registry: '🗝',
  certificate: '🏅',
  url: '🌍',
  custom: '📌',
};

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  hostname: '#58a6ff',
  ip: '#3fb950',
  email: '#d29922',
  domain: '#a371f7',
  account: '#f0883e',
  file: '#79c0ff',
  process: '#79c0ff',
  registry: '#d2a8ff',
  certificate: '#56d364',
  url: '#ffa657',
  custom: '#8b949e',
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  hostname: 'HOST',
  ip: 'IP',
  email: 'EMAIL',
  domain: 'DOMAIN',
  account: 'ACCT',
  file: 'FILE',
  process: 'PROC',
  registry: 'REG',
  certificate: 'CERT',
  url: 'URL',
  custom: 'CUSTOM',
};
