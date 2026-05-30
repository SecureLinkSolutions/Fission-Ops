export type UserRole = 'analyst' | 'senior_analyst' | 'incident_commander';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'contained' | 'closed';
export type EntityType = 'hostname' | 'ip' | 'email' | 'domain' | 'account';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type ZoneType = 'IT' | 'OT' | 'trusted' | 'untrusted' | 'dmz';
export type DirectionType = 'ingress' | 'egress' | 'lateral';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
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
  created_by: string;
  created_at: string;
  kill_chain_mappings?: KillChainMappingWithStage[];
  boundary_mappings?: BoundaryMappingWithBoundary[];
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
