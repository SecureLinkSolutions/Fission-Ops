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
  sso_provider?: string;
  sso_subject?: string;
  created_at: Date;
}

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Entity {
  id: string;
  incident_id: string;
  type: EntityType;
  value: string;
  notes?: string;
  entity_details?: Record<string, unknown>;
  created_by: string;
  created_at: Date;
}

export interface KillChainStage {
  id: string;
  name: string;
  description?: string;
  order_index: number;
}

export interface EntityKillChainMapping {
  id: string;
  entity_id: string;
  stage_id: string;
  confidence: ConfidenceLevel;
  notes?: string;
  mapped_by: string;
  mapped_at: Date;
}

export interface NetworkBoundary {
  id: string;
  incident_id: string;
  name: string;
  zone_type: ZoneType;
  description?: string;
  created_by: string;
  created_at: Date;
}

export interface EntityBoundaryMapping {
  id: string;
  entity_id: string;
  boundary_id: string;
  direction: DirectionType;
  notes?: string;
  mapped_by: string;
  mapped_at: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
