import { useState } from 'react';

interface EntityProp {
  id: string;
  type: string;
  value: string;
  status?: string;
  ioc_status?: string;
}

interface Props {
  entity: EntityProp;
  incidentId: string;
  canCreateTask?: boolean;
  onCreateTask: (title: string) => void;
}

// RFC 1918, loopback, link-local, CGNAT, and other non-routable ranges
function isPrivateIp(value: string): boolean {
  const v = value.trim();
  // Strip CIDR suffix if present
  const addr = v.split('/')[0];
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||  // link-local
    (a === 100 && b >= 64 && b <= 127) || // CGNAT RFC 6598
    (a === 198 && (b === 18 || b === 19)) || // benchmark RFC 2544
    a === 0 ||
    (a === 255 && b === 255)     // broadcast
  );
}

// Investigation actions for internal / RFC-1918 IPs
const INVESTIGATE_INTERNAL_IP: string[] = [
  'Identify the device assigned to {value} via DHCP leases or IPAM',
  'Search SIEM for all traffic to/from {value} in the last 30 days',
  'Review firewall and switch logs for connection frequency involving {value}',
  'Determine which other internal hosts communicated with {value}',
  'Check network access control (NAC) records — is {value} an authorised device?',
  'Pull ARP tables from adjacent routers/switches to find the MAC address at {value}',
  'Review DNS logs for hostnames resolving to {value}',
  'Check if {value} is within an expected subnet for its apparent role',
];

// Response actions for internal / RFC-1918 IPs
const RESPOND_INTERNAL_IP: string[] = [
  'Isolate the device at {value} at the switch port or via NAC policy',
  'Block all lateral traffic from {value} at internal firewall/VLAN ACL',
  'Revoke DHCP lease for {value} and prevent re-assignment to the same device',
  'Coordinate with network team to identify and physically locate the device at {value}',
  'Search for active sessions from {value} and terminate them',
  'Add {value} to SIEM watchlist for ongoing lateral movement detection',
  'Document device identity, owner, and business justification for {value}',
];

// Investigation actions: shown when suspected / under investigation
const INVESTIGATE_TEMPLATES: Record<string, string[]> = {
  ip: [
    'Look up {value} in VirusTotal / threat intel platforms',
    'Search SIEM for all traffic to/from {value} in last 30 days',
    'Check ASN and geolocation of {value} for anomalies',
    'Review firewall logs for connection frequency to {value}',
    'Determine which internal hosts contacted {value}',
    'Check if {value} appears in any known threat feeds',
    'Perform reverse DNS lookup and WHOIS on {value}',
    'Correlate {value} with open-source threat intelligence (AbuseIPDB, Shodan)',
  ],
  hostname: [
    'Pull process list and review running services on {value}',
    'Check recent login history and active sessions on {value}',
    'Review Windows Event Logs (4624, 4625, 4688) on {value}',
    'Scan {value} with EDR for known IOC signatures',
    'Check {value} for unusual scheduled tasks or startup entries',
    'Review network connections currently established from {value}',
    'Determine if {value} is domain-joined and check for anomalous GPO changes',
  ],
  domain: [
    'Perform WHOIS lookup on {value} — check registration date and registrar',
    'Check {value} in VirusTotal, URLhaus, and OpenPhish',
    'Review DNS resolution history for {value} (passive DNS)',
    'Identify all internal hosts that resolved {value}',
    'Check certificate transparency logs for {value}',
    'Look for typosquatting or lookalike variants of {value}',
    'Enumerate subdomains of {value} for infrastructure scope',
  ],
  email: [
    'Analyse full email headers of {value} for spoofing indicators',
    'Check sending IP reputation and SPF/DKIM/DMARC alignment for {value}',
    'Search mail gateway logs for other recipients of {value}',
    'Review link and attachment contents of {value} in sandbox',
    'Check sender domain registration date and MX records',
    'Look for similar phishing campaigns targeting the organisation',
    'Verify if {value} is a known phishing kit or campaign',
  ],
  account: [
    'Review login history for {value} — look for unusual times or locations',
    'Check for MFA bypass or anomalous auth events for {value}',
    'Enumerate resources accessed by {value} in last 7 days',
    'Review group membership and permissions assigned to {value}',
    'Check if {value} has performed any privilege escalation',
    'Search for credential usage of {value} across other systems',
    'Verify if {value} should have the access observed',
  ],
  file: [
    'Submit hash of {value} to VirusTotal and sandbox analysis',
    'Check {value} for code-signing certificate validity',
    'Review execution chain — what process dropped or launched {value}',
    'Search EDR telemetry for execution of {value} across all endpoints',
    'Extract strings from {value} for C2 indicators',
    'Check {value} PE header and compilation timestamp',
    'Compare {value} against known malware family signatures',
  ],
  process: [
    'Review parent process and command-line arguments of {value}',
    'Check executable path of {value} against known-good baseline',
    'Verify digital signature of {value} binary',
    'Look for similar {value} instances running on other hosts',
    'Review network connections established by {value}',
    'Check if {value} has loaded any suspicious DLLs',
  ],
  url: [
    'Submit {value} to URL sandbox (URLscan.io, Any.run)',
    'Check {value} in Google Safe Browsing and VirusTotal',
    'Search proxy logs for internal users who visited {value}',
    'Review hosting IP and infrastructure behind {value}',
    'Check redirect chain of {value} for final destination',
  ],
  registry: [
    'Check {value} against known persistence registry keys',
    'Review who or what created/modified {value}',
    'Search all endpoints for presence of {value}',
    'Determine what executable is referenced by {value}',
  ],
  certificate: [
    'Verify issuer CA and chain of trust for {value}',
    'Check {value} in certificate transparency logs',
    'Look up {value} in Shodan for services using it',
    'Check if {value} was issued to a known threat actor domain',
  ],
  custom: [
    'Investigate {value} in threat intelligence platforms',
    'Search SIEM for activity related to {value}',
    'Document all observations about {value}',
    'Correlate {value} with other IOCs in the incident',
  ],
};

// Response actions: shown when confirmed malicious
const RESPOND_TEMPLATES: Record<string, string[]> = {
  ip: [
    'Block {value} at perimeter firewall — inbound and outbound',
    'Add {value} to SIEM threat feed and SOAR blocklist',
    'Null-route {value} on core router to prevent any connectivity',
    'Search for and terminate all active connections to {value}',
    'Check for lateral movement originating from hosts that contacted {value}',
    'Add {value} to EDR network isolation rules',
    'Notify upstream ISP to block/null-route {value} if possible',
  ],
  hostname: [
    'Isolate {value} from the network immediately via EDR or switch port',
    'Acquire forensic memory dump from {value} before shutdown',
    'Acquire forensic disk image of {value} for investigation',
    'Force logoff all active sessions on {value}',
    'Revoke all Kerberos tickets (krbtgt reset if domain controller involved)',
    'Check {value} for persistence mechanisms — scheduled tasks, services, run keys, WMI',
    'Reset local admin credentials on {value}',
  ],
  domain: [
    'Block {value} at DNS resolver and web proxy',
    'Add {value} to all endpoint DNS sinkholes',
    'Submit {value} to domain takedown services if company-owned or lookalike',
    'Search mail gateway logs and block any email from {value}',
    'Alert all internal users who have visited or emailed {value}',
    'Monitor for re-registration of {value} or variants',
  ],
  email: [
    'Quarantine all emails associated with {value} across all mailboxes',
    'Block sending domain and IP at mail gateway',
    'Retract delivered copies of {value} from user mailboxes',
    'Notify all recipients of {value} — instruct not to click links or open attachments',
    'Report {value} to anti-phishing feeds (Google, Microsoft, APWG)',
    'Enable enhanced logging for the affected email accounts',
  ],
  account: [
    'Disable account {value} in Active Directory / IdP immediately',
    'Revoke all active sessions and OAuth tokens for {value}',
    'Force password reset for {value} via secure out-of-band channel',
    'Audit and revoke any API keys or service credentials for {value}',
    'Review and remove any new permissions or group memberships added to {value}',
    'Enable enhanced audit logging on {value} if re-enabled later',
    'Check if attacker created any backdoor accounts using {value} privileges',
  ],
  file: [
    'Quarantine {value} on all endpoints via EDR',
    'Add hash of {value} to EDR and AV blocklist across all endpoints',
    'Search for and remove all copies of {value} from the environment',
    'Submit {value} to AV vendors for signature updates',
    'Review and remove any persistence installed by {value}',
    'Check for other files dropped by {value} or its parent process',
  ],
  process: [
    'Kill process {value} on all affected hosts via EDR',
    'Quarantine the executable backing {value}',
    'Add {value} hash to application allowlist deny list',
    'Review and remediate all files created or modified by {value}',
    'Check for child processes spawned by {value}',
    'Search EDR for execution of {value} across the environment',
  ],
  url: [
    'Block {value} at web proxy and DNS',
    'Search proxy logs and identify all users who visited {value}',
    'Notify users who visited {value} to check for malware infection',
    'Submit {value} to Google Safe Browsing and Microsoft SmartScreen',
    'Review any files downloaded from {value}',
  ],
  registry: [
    'Delete registry key {value} from all affected hosts',
    'Monitor {value} for automatic re-creation (indicates active malware)',
    'Review all hosts in the environment for presence of {value}',
    'Identify and remediate the process responsible for creating {value}',
  ],
  certificate: [
    'Revoke certificate {value} immediately via issuing CA',
    'Replace {value} with a new certificate across all services',
    'Audit all services that were using {value}',
    'Check if private key for {value} has been exfiltrated',
  ],
  custom: [
    'Contain and isolate systems affected by {value}',
    'Remove or disable {value} from the environment',
    'Document full scope and impact of {value}',
    'Escalate {value} to incident commander for response decision',
  ],
};

function ActionItem({ text, onCreateTask, canCreateTask }: { text: string; canCreateTask: boolean; onCreateTask: (title: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [addHover, setAddHover] = useState(false);
  const [copyHover, setCopyHover] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Clipboard API is unavailable (e.g. no secure context) — fall back to the legacy copy command.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand copy failed');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2000);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: '#0d1117', borderRadius: '6px', border: '1px solid #21262d' }}>
      <span style={{ flex: 1, color: '#e6edf3', fontSize: '13px', lineHeight: '1.5' }}>{text}</span>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button type="button"
         
          
          onClick={() => canCreateTask && onCreateTask(text)}
          onMouseEnter={() => setAddHover(true)}
          onMouseLeave={() => setAddHover(false)}
          disabled={!canCreateTask}
          title={canCreateTask ? 'Add as task' : 'Requires Senior Analyst role to create tasks'}
          style={{
            background: !canCreateTask ? 'transparent' : addHover ? '#238636' : '#23863622',
            border: `1px solid ${canCreateTask ? '#23863644' : '#30363d'}`,
            borderRadius: '4px',
            padding: '4px 8px',
            color: !canCreateTask ? '#484f58' : addHover ? '#fff' : '#3fb950',
            fontSize: '11px',
            cursor: canCreateTask ? 'pointer' : 'not-allowed',
            fontWeight: 600,
          }}
        >
          ＋ Task
        </button>
        <button type="button"
          onClick={handleCopy}
          onMouseEnter={() => setCopyHover(true)}
          onMouseLeave={() => setCopyHover(false)}
          title={copyFailed ? 'Copy failed — clipboard access unavailable' : 'Copy to clipboard'}
          style={{
            background: copyHover ? '#21262d' : 'transparent',
            border: `1px solid ${copyFailed ? '#f85149' : '#30363d'}`,
            borderRadius: '4px',
            padding: '4px 8px',
            color: copyFailed ? '#f85149' : copied ? '#3fb950' : '#8b949e',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {copyFailed ? '✗' : copied ? '✓' : '📋'}
        </button>
      </div>
    </div>
  );
}

function ActionSection({
  title, color, icon, actions, onCreateTask, canCreateTask,
}: {
  title: string;
  color: string;
  icon: string;
  actions: string[];
  canCreateTask: boolean;
  onCreateTask: (title: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ marginBottom: '12px' }}>
      <button type="button"
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '0 0 10px 0', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '13px' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '13px', color }}>{title}</span>
        <span style={{
          background: `${color}22`, color, border: `1px solid ${color}44`,
          borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 700, marginLeft: '2px',
        }}>{actions.length}</span>
        <span style={{ marginLeft: 'auto', color: '#484f58', fontSize: '11px' }}>{collapsed ? '▸ Show' : '▾ Hide'}</span>
      </button>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {actions.map((action, i) => (
            <ActionItem key={i} text={action} onCreateTask={onCreateTask} canCreateTask={canCreateTask} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuggestedActions({ entity, onCreateTask, canCreateTask = true }: Props) {
  const isConfirmed = entity.status === 'confirmed_malicious' || entity.ioc_status === 'confirmed';
  const isSuspected = entity.ioc_status === 'suspected' || entity.status === 'under_investigation';

  if (!isConfirmed && !isSuspected) return null;

  const isInternalIp = entity.type === 'ip' && isPrivateIp(entity.value);
  const type = entity.type in INVESTIGATE_TEMPLATES ? entity.type : 'custom';
  const fill = (t: string) => t.replace(/\{value\}/g, entity.value);
  const investigateActions = (isInternalIp ? INVESTIGATE_INTERNAL_IP : INVESTIGATE_TEMPLATES[type]).map(fill);
  const respondActions = (isInternalIp ? RESPOND_INTERNAL_IP : RESPOND_TEMPLATES[type]).map(fill);

  return (
    <div style={{
      background: isConfirmed ? '#f8514908' : '#58a6ff08',
      border: `1px solid ${isConfirmed ? '#f8514944' : '#58a6ff44'}`,
      borderRadius: '8px',
      padding: '16px 20px',
      marginBottom: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontWeight: 700, fontSize: '14px', color: isConfirmed ? '#f85149' : '#58a6ff' }}>
          {isConfirmed ? '⚡ Response & Remediation Actions' : '🔍 Investigation Actions'}
        </span>
        <span style={{
          background: isConfirmed ? '#f8514922' : '#58a6ff22',
          color: isConfirmed ? '#f85149' : '#58a6ff',
          border: `1px solid ${isConfirmed ? '#f8514944' : '#58a6ff44'}`,
          borderRadius: '4px', padding: '1px 7px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
        }}>
          {isConfirmed ? 'Confirmed Malicious' : 'Under Investigation'}
        </span>
      </div>

      {isInternalIp && (
        <div style={{ background: '#e3b34122', border: '1px solid #e3b34144', borderRadius: '6px', padding: '8px 12px', marginBottom: '14px', fontSize: '12px', color: '#e3b341' }}>
          ⚠️ <strong>{entity.value}</strong> is a private / non-routable IP address. External threat intel lookups (VirusTotal, Shodan, AbuseIPDB, WHOIS) are not applicable — showing internal investigation playbook instead.
        </div>
      )}

      {/* Always show investigation actions — they remain relevant even after confirmation */}
      <ActionSection
        title="Investigation & Triage"
        color="#58a6ff"
        icon="🔍"
        actions={investigateActions}
        onCreateTask={onCreateTask}
        canCreateTask={canCreateTask}
      />

      {/* Response actions only shown once confirmed */}
      {isConfirmed && (
        <ActionSection
          title="Containment & Response"
          color="#f85149"
          icon="🛡"
          actions={respondActions}
          onCreateTask={onCreateTask}
          canCreateTask={canCreateTask}
        />
      )}
    </div>
  );
}
