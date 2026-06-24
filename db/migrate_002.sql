-- Migration 002: Network boundary visualization + TTP assignment

CREATE TABLE IF NOT EXISTS entity_zone_assignments (
  entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  boundary_id UUID NOT NULL REFERENCES network_boundaries(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boundary_traversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  source_boundary_id UUID NOT NULL REFERENCES network_boundaries(id) ON DELETE CASCADE,
  target_boundary_id UUID NOT NULL REFERENCES network_boundaries(id) ON DELETE CASCADE,
  label TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ttps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tactic TEXT NOT NULL,
  description TEXT,
  framework TEXT NOT NULL DEFAULT 'mitre_attack',
  is_subtechnique BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS entity_stage_ttps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kill_chain_mapping_id UUID NOT NULL REFERENCES entity_kill_chain_mappings(id) ON DELETE CASCADE,
  ttp_id UUID NOT NULL REFERENCES ttps(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(kill_chain_mapping_id, ttp_id)
);

INSERT INTO ttps (technique_id, name, tactic, framework, is_subtechnique) VALUES
  ('T1566','Phishing','Initial Access','mitre_attack',false),
  ('T1566.001','Spearphishing Attachment','Initial Access','mitre_attack',true),
  ('T1566.002','Spearphishing Link','Initial Access','mitre_attack',true),
  ('T1190','Exploit Public-Facing Application','Initial Access','mitre_attack',false),
  ('T1133','External Remote Services','Initial Access','mitre_attack',false),
  ('T1078','Valid Accounts','Initial Access','mitre_attack',false),
  ('T1059','Command and Scripting Interpreter','Execution','mitre_attack',false),
  ('T1059.001','PowerShell','Execution','mitre_attack',true),
  ('T1059.003','Windows Command Shell','Execution','mitre_attack',true),
  ('T1204','User Execution','Execution','mitre_attack',false),
  ('T1204.002','Malicious File','Execution','mitre_attack',true),
  ('T1106','Native API','Execution','mitre_attack',false),
  ('T1547','Boot or Logon Autostart Execution','Persistence','mitre_attack',false),
  ('T1547.001','Registry Run Keys / Startup Folder','Persistence','mitre_attack',true),
  ('T1053','Scheduled Task/Job','Persistence','mitre_attack',false),
  ('T1053.005','Scheduled Task','Persistence','mitre_attack',true),
  ('T1505.003','Web Shell','Persistence','mitre_attack',true),
  ('T1136','Create Account','Persistence','mitre_attack',false),
  ('T1548','Abuse Elevation Control Mechanism','Privilege Escalation','mitre_attack',false),
  ('T1548.002','Bypass User Account Control','Privilege Escalation','mitre_attack',true),
  ('T1055','Process Injection','Privilege Escalation','mitre_attack',false),
  ('T1068','Exploitation for Privilege Escalation','Privilege Escalation','mitre_attack',false),
  ('T1027','Obfuscated Files or Information','Defense Evasion','mitre_attack',false),
  ('T1562','Impair Defenses','Defense Evasion','mitre_attack',false),
  ('T1562.001','Disable or Modify Tools','Defense Evasion','mitre_attack',true),
  ('T1070','Indicator Removal','Defense Evasion','mitre_attack',false),
  ('T1070.004','File Deletion','Defense Evasion','mitre_attack',true),
  ('T1036','Masquerading','Defense Evasion','mitre_attack',false),
  ('T1003','OS Credential Dumping','Credential Access','mitre_attack',false),
  ('T1003.001','LSASS Memory','Credential Access','mitre_attack',true),
  ('T1110','Brute Force','Credential Access','mitre_attack',false),
  ('T1555','Credentials from Password Stores','Credential Access','mitre_attack',false),
  ('T1082','System Information Discovery','Discovery','mitre_attack',false),
  ('T1083','File and Directory Discovery','Discovery','mitre_attack',false),
  ('T1018','Remote System Discovery','Discovery','mitre_attack',false),
  ('T1046','Network Service Discovery','Discovery','mitre_attack',false),
  ('T1021','Remote Services','Lateral Movement','mitre_attack',false),
  ('T1021.001','Remote Desktop Protocol','Lateral Movement','mitre_attack',true),
  ('T1021.002','SMB/Windows Admin Shares','Lateral Movement','mitre_attack',true),
  ('T1550.002','Pass the Hash','Lateral Movement','mitre_attack',true),
  ('T1114','Email Collection','Collection','mitre_attack',false),
  ('T1005','Data from Local System','Collection','mitre_attack',false),
  ('T1560','Archive Collected Data','Collection','mitre_attack',false),
  ('T1074','Data Staged','Collection','mitre_attack',false),
  ('T1071','Application Layer Protocol','Command and Control','mitre_attack',false),
  ('T1071.001','Web Protocols','Command and Control','mitre_attack',true),
  ('T1095','Non-Application Layer Protocol','Command and Control','mitre_attack',false),
  ('T1572','Protocol Tunneling','Command and Control','mitre_attack',false),
  ('T1105','Ingress Tool Transfer','Command and Control','mitre_attack',false),
  ('T1041','Exfiltration Over C2 Channel','Exfiltration','mitre_attack',false),
  ('T1048','Exfiltration Over Alternative Protocol','Exfiltration','mitre_attack',false),
  ('T1567','Exfiltration Over Web Service','Exfiltration','mitre_attack',false),
  ('T1486','Data Encrypted for Impact','Impact','mitre_attack',false),
  ('T1490','Inhibit System Recovery','Impact','mitre_attack',false),
  ('T1489','Service Stop','Impact','mitre_attack',false),
  ('T1485','Data Destruction','Impact','mitre_attack',false),
  ('T1498','Network Denial of Service','Impact','mitre_attack',false)
ON CONFLICT (technique_id) DO NOTHING;
