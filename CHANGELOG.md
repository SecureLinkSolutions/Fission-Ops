# Changelog

All notable changes to Fission Ops are documented in this file.

## [Unreleased]

### Added
- Multi-tenancy: `organizations` table with `org_id` scoped to all users, incidents, and audit logs
- Super admin role with platform-wide access across all organizations
- Public organization registration endpoint (`POST /auth/register`)
- Organization onboarding wizard (3-step flow after registration)
- Organization settings page (name editing, SSO status, usage stats)
- Super Admin console (list/create/deactivate/reactivate organizations)
- `docker-compose.prod.yml` with Traefik v3 and Let's Encrypt HTTPS
- Helmet.js security headers on all API responses
- Rate limiting: 100 req/15min global, 10 req/15min on auth routes
- `.env.example` updated with all required and optional variables

### Changed
- NavBar now shows Org Settings and Super Admin links for appropriate roles
- JWT payload includes `org_id` for row-level tenant isolation
- All incident/entity queries filtered by `org_id` from JWT

---

## [0.4.0] — Audit, SSO, Timeline, Users

### Added
- Full MITRE ATT&CK Enterprise and ICS dataset seeded at startup from MITRE CTI GitHub
- Azure AD and Okta OIDC SSO integration (`openid-client` v6)
- SSO callback frontend page that reads `?token=` and stores JWT
- Incident timeline view with action-type and user filters
- Audit logging middleware capturing create/update/delete on incidents and entities
- Audit log viewer page (incident_commander only, filterable, paginated)
- User management dashboard: create users, assign roles, deactivate/reactivate
- Incident assignment controls (restrict incident visibility per analyst)
- `deactivated_at`, `last_login_at`, `password_reset_required` columns on users
- `audit_logs` table (append-only, no delete route exposed)
- `incident_assignments` table for per-analyst incident visibility

---

## [0.3.0] — Network, TTPs, Report Export

### Added
- Network Boundary Visualization: React Flow swimlane view with drag-to-assign entities to zones
- Entity zone assignments and boundary traversal tracking
- TTP Assignment: MITRE ATT&CK technique search and assignment per kill-chain mapping
- TTP badges displayed on entity chips in the Kill Chain view
- PDF Incident Report export (pdfmake, server-side, streams attachment)
- `ttps` and `entity_stage_ttps` tables
- `boundary_traversals` and `entity_zone_assignments` tables

---

## [0.2.0] — Kill Chain Visualization & Relationship Graph

### Added
- Kill Chain Flow: React Flow canvas with draggable entity chips across stages
- Framework toggle: Lockheed Martin (7 stages), MITRE ATT&CK Enterprise (12), MITRE ATT&CK ICS (12)
- Entity Relationship Graph: directed force-layout graph with labeled edges, zoom/pan, MiniMap
- Add relationship form with source/target dropdowns and relationship type
- `entity_relationships` table with unique constraint
- `framework` column on `kill_chain_stages`
- MITRE ATT&CK Enterprise and ICS stages pre-seeded

---

## [0.1.0] — Core Platform

### Added
- PostgreSQL schema: users, incidents, entities, kill_chain_stages, entity_kill_chain_mappings, network_boundaries, entity_boundary_mappings
- JWT authentication with bcrypt password hashing
- RBAC: analyst → senior_analyst → incident_commander rank system
- Express API: incidents, entities, kill chain, network boundaries CRUD
- React frontend with dark SOC theme
- Incident list, create, and detail pages
- Entity form with type-specific fields (hostname, IP, email, domain, account)
- Entity detail page with kill chain and boundary assignment
- Docker Compose for local development (postgres, backend, frontend)
- Idempotent migration system auto-applied on startup
