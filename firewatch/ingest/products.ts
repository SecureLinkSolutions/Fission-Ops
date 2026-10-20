// firewatch-products-v1: maps a rule's log source / data connector / index hints
// to one product family, so the Library can be filtered by what you collect.
// First match wins, so specific products come before broad families.

const PRODUCT_RULES: [string, RegExp][] = [
  ['Microsoft Entra ID', /\b(entra|azure ?ad|aad|signinlogs|auditlogs|azureactivedirectory|identity_?protection)\b/i],
  ['Microsoft 365', /\b(office ?365|o365|m365|microsoft ?365|exchange ?online|sharepoint|onedrive|teams|officeactivity|purview)\b/i],
  ['Microsoft Defender', /\b(defender|mde|device(process|network|file|registry|logon|image|events)|microsoft ?365 ?defender|mdatp|securityalert)\b/i],
  ['Okta', /\bokta\b/i],
  ['Google Workspace', /\b(google ?workspace|gsuite|g ?suite|gworkspace)\b/i],
  ['GitHub', /\bgithub\b/i],
  ['Kubernetes', /\b(kubernetes|k8s|aks|eks|gke)\b/i],
  ['AWS', /\b(aws|cloudtrail|guardduty|amazon)\b/i],
  ['Google Cloud', /\b(gcp|google ?cloud|gcp_?audit)\b/i],
  ['Azure', /\b(azure|azureactivity|azurediagnostics|azure_?monitor)\b/i],
  ['Palo Alto Networks', /\b(palo ?alto|pan-?os|panw|prisma)\b/i],
  ['Fortinet', /\b(fortinet|fortigate|fortios)\b/i],
  ['Cisco', /\b(cisco|asa|umbrella|meraki|duo)\b/i],
  ['Zscaler', /\bzscaler\b/i],
  ['CrowdStrike', /\bcrowdstrike\b/i],
  ['Containers', /\b(docker|container)\b/i],
  ['Email', /\b(email|mail|proofpoint|mimecast)\b/i],
  ['DNS', /\bdns\b/i],
  ['Web', /\b(web|proxy|apache|nginx|iis|http|waf|webserver)\b/i],
  ['Network', /\b(network|firewall|zeek|netflow|commonsecuritylog|syslog|vpn|suricata)\b/i],
  ['macOS', /\b(macos|osx|mac os)\b/i],
  ['Linux', /\b(linux|auditd|unix)\b/i],
  ['Windows', /\b(windows|sysmon|powershell|security ?event|wineventlog|winlog|process_creation|registry|endgame|logs-endpoint|securityevent)\b/i],
];

export function productOf(...hints: (string | null | undefined)[]): string | null {
  const text = hints.filter(Boolean).join(' ').replace(/[_:./-]/g, ' ');
  if (!text.trim()) return null;
  for (const [label, re] of PRODUCT_RULES) if (re.test(text)) return label;
  return null;
}
