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
  onCreateTask: (title: string) => void;
}

const ACTION_TEMPLATES: Record<string, string[]> = {
  ip: [
    'Block {value} at perimeter firewall',
    'Add {value} to SIEM threat feed blocklist',
    'Search SIEM for all connections to/from {value}',
    'Null-route {value} on core router',
    'Check for lateral movement from {value}',
    'Capture network traffic from {value}',
  ],
  hostname: [
    'Isolate {value} from network immediately',
    'Pull memory dump from {value}',
    'Acquire forensic disk image of {value}',
    'Force logoff all sessions on {value}',
    'Review process list and running services on {value}',
    'Check {value} for persistence mechanisms (scheduled tasks, services, run keys)',
  ],
  account: [
    'Disable account {value} in Active Directory',
    'Force password reset for {value}',
    'Revoke all active sessions for {value}',
    'Enable enhanced logging on {value}',
    'Review recent login history for {value}',
    'Check for privilege escalation by {value}',
  ],
  email: [
    'Quarantine all emails from sender of {value}',
    'Block sender domain at mail gateway',
    'Search mail logs for other recipients of {value}',
    'Report {value} to anti-phishing feed',
    'Notify recipients of {value} to not click links',
  ],
  domain: [
    'Block {value} at DNS resolver / firewall',
    'Check for DNS resolution logs of {value} across endpoints',
    'Submit {value} to domain blocklist feed',
    'Investigate registrar and hosting of {value}',
    'Check for typosquatting variants of {value}',
  ],
  url: [
    'Block {value} at web proxy',
    'Search proxy logs for requests to {value}',
    'Notify users who visited {value}',
    'Submit {value} to URL threat feed',
  ],
  file: [
    'Quarantine file {value} on all endpoints',
    'Add {value} hash to EDR blocklist',
    'Search EDR for execution of {value} across environment',
    'Submit {value} to sandbox for analysis',
    'Review parent process that dropped {value}',
  ],
  process: [
    'Kill process {value} on affected hosts',
    'Quarantine executable for {value}',
    'Review process tree for {value}',
    'Search EDR for execution of {value} across environment',
  ],
  registry: [
    'Delete registry key {value}',
    'Monitor {value} for re-creation',
    'Review all hosts for presence of {value}',
    'Check {value} for persistence or credential harvesting',
  ],
  certificate: [
    'Revoke certificate {value}',
    'Check all services using {value}',
    'Monitor for re-issuance of {value}',
  ],
  custom: [
    'Investigate {value} further',
    'Document findings for {value}',
  ],
};

function ActionItem({ text, onCreateTask }: { text: string; onCreateTask: (title: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [addHover, setAddHover] = useState(false);
  const [copyHover, setCopyHover] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: '#0d1117', borderRadius: '6px', border: '1px solid #21262d' }}>
      <span style={{ flex: 1, color: '#e6edf3', fontSize: '13px', lineHeight: '1.5' }}>{text}</span>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => onCreateTask(text)}
          onMouseEnter={() => setAddHover(true)}
          onMouseLeave={() => setAddHover(false)}
          title="Add as task"
          style={{
            background: addHover ? '#238636' : '#23863622',
            border: '1px solid #23863644',
            borderRadius: '4px',
            padding: '4px 8px',
            color: addHover ? '#fff' : '#3fb950',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'none',
          }}
        >
          ＋ Add as Task
        </button>
        <button
          onClick={handleCopy}
          onMouseEnter={() => setCopyHover(true)}
          onMouseLeave={() => setCopyHover(false)}
          title="Copy to clipboard"
          style={{
            background: copyHover ? '#21262d' : 'transparent',
            border: '1px solid #30363d',
            borderRadius: '4px',
            padding: '4px 8px',
            color: copied ? '#3fb950' : '#8b949e',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
    </div>
  );
}

export default function SuggestedActions({ entity, onCreateTask }: Props) {
  const shouldShow =
    entity.status === 'confirmed_malicious' ||
    entity.ioc_status === 'confirmed' ||
    entity.status === 'under_investigation';

  if (!shouldShow) return null;

  const templates = ACTION_TEMPLATES[entity.type] ?? ACTION_TEMPLATES['custom'];
  const actions = templates.map((t) => t.replace(/\{value\}/g, entity.value));

  return (
    <div style={{
      background: '#f0883e08',
      border: '1px solid #f0883e44',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#f0883e' }}>⚡ Suggested Actions</span>
        <span style={{
          background: '#f0883e22',
          color: '#f0883e',
          border: '1px solid #f0883e44',
          borderRadius: '10px',
          padding: '1px 8px',
          fontSize: '11px',
          fontWeight: 700,
        }}>
          {actions.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {actions.map((action, i) => (
          <ActionItem key={i} text={action} onCreateTask={onCreateTask} />
        ))}
      </div>
    </div>
  );
}
