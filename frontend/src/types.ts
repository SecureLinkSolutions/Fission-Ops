export type UserRole = 'analyst' | 'senior_analyst' | 'incident_commander' | 'platform_admin';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'contained' | 'closed';
export type IncidentOperationalStatus = 'active' | 'contained' | 'eradicated' | 'recovered' | 'closed';
export type EntityType = 'hostname' | 'ip' | 'email' | 'domain' | 'account' | 'file' | 'process' | 'registry' | 'certificate' | 'url' | 'custom';
export type EntityStatus = 'unreviewed' | 'under_investigation' | 'isolated' | 'contained' | 'cleared' | 'confirmed_malicious';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type ZoneType = 'IT' | 'OT' | 'trusted' | 'untrusted' | 'dmz';
export type DirectionType = 'ingress' | 'egress' | 'lateral';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: string;
  active: boolean;
  platform_admin_access: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  org_id?: string;
  password_reset_required?: boolean;
}

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  incident_status: IncidentOperationalStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  entity_count?: number;
}

export interface Entity {
  id: string;
  incident_id: string;
  type: EntityType;
  value: string;
  notes?: string;
  entity_details?: Record<string, unknown>;
  status: EntityStatus;
  created_by: string;
  created_at: string;
  kill_chain_mappings?: KillChainMappingWithStage[];
  boundary_mappings?: BoundaryMappingWithBoundary[];
}

export interface YaraStringDef {
  identifier: string;
  type: 'text' | 'hex' | 'regex';
  value: string;
  nocase?: boolean;
  wide?: boolean;
  ascii?: boolean;
  fullword?: boolean;
}

export interface YaraHashes {
  md5?: string;
  sha1?: string;
  sha256?: string;
}

export interface YaraRule {
  id: string;
  incident_id: string;
  entity_id: string | null;
  name: string;
  description: string | null;
  author: string | null;
  reference: string | null;
  tags: string[];
  strings: YaraStringDef[];
  hashes: YaraHashes;
  condition: string;
  rule_text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type KillChainFramework = 'lockheed_martin' | 'mitre_attack' | 'mitre_ics';

export interface KillChainStage {
  id: string;
  name: string;
  description?: string;
  order_index: number;
  framework?: KillChainFramework;
}

export interface EntityRelationship {
  id: string;
  incident_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  bidirectional: boolean;
  notes?: string;
  created_by: string;
  created_at: string;
  source_value?: string;
  source_type?: string;
  target_value?: string;
  target_type?: string;
}

export interface KillChainMappingWithStage {
  id: string;
  entity_id: string;
  stage_id: string;
  stage_name: string;
  order_index: number;
  confidence: ConfidenceLevel;
  notes?: string;
  mapped_by: string;
  mapped_at: string;
}

export interface NetworkBoundary {
  id: string;
  incident_id: string;
  name: string;
  zone_type: ZoneType;
  description?: string;
  created_by: string;
  created_at: string;
}

export interface TimelineEntry {
  ts: string;
  user_id: string;
  user_email: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  description: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  created_at: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sso_provider: string | null;
  sso_subject: string | null;
  deactivated_at: string | null;
  last_login_at: string | null;
  password_reset_required: boolean;
  created_at: string;
}

export interface BoundaryMappingWithBoundary {
  id: string;
  entity_id: string;
  boundary_id: string;
  boundary_name: string;
  zone_type: ZoneType;
  direction: DirectionType;
  notes?: string;
  mapped_by: string;
  mapped_at: string;
}

export interface ExerciseParticipant {
  exercise_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_role: UserRole;
  added_at: string;
}

export interface SessionInjectRelease {
  id: string;
  session_id: string;
  inject_id: string;
  released_by?: string;
  released_by_name?: string;
  released_at: string;
}

export interface TabletopExercise {
  id: string;
  org_id: string;
  title: string;
  description?: string;
  scenario: string;
  objectives?: string;
  status: 'draft' | 'ready' | 'active' | 'completed' | 'archived';
  scheduled_at?: string;
  duration_minutes: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  inject_count?: number;
  injects?: ExerciseInject[];
  incident_id?: string | null;
  incident_title?: string | null;
}

export interface ExerciseInject {
  id: string;
  exercise_id: string;
  sequence_order: number;
  title: string;
  description: string;
  inject_type: 'information' | 'decision' | 'complication' | 'escalation' | 'resolution';
  trigger_minutes?: number;
  expected_actions?: string;
  discussion_prompts?: string;
  created_at: string;
  release?: SessionInjectRelease;
}

export interface ExerciseSession {
  id: string;
  exercise_id: string;
  org_id: string;
  facilitator_id?: string;
  status: 'in_progress' | 'completed';
  started_at: string;
  completed_at?: string;
  participant_notes?: string;
  exercise?: TabletopExercise;
  responses?: ExerciseInjectResponse[];
  releases?: SessionInjectRelease[];
}

export interface ExerciseInjectResponse {
  id: string;
  session_id: string;
  inject_id: string;
  response_text: string;
  gaps_identified?: string;
  submitted_by?: string;
  submitted_at: string;
}

export interface ExerciseAAR {
  id: string;
  session_id: string;
  org_id: string;
  strengths?: string;
  weaknesses?: string;
  gaps?: string;
  recommendations?: string;
  overall_rating?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
