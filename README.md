# ⚡ Fission Ops

A full-stack incident response platform for SOC analysts — built for security teams to track, investigate, and collaborate on live security incidents in real time.

Developed by **NullVector Security**.

---

## Features

### Incident Management
- **Incident tracking** — Create and manage incidents with severity (low / medium / high / critical), operational status (active / contained / eradicated / recovered / closed), and lifecycle status (open / contained / closed)
- **Entity tracking** — Add entities of type hostname, IP, email, domain, account, file, process, registry key, certificate, URL, or custom; each with type-specific metadata (JSONB `entity_details`)
- **IOC Flagging** — Flag entities as `suspected`, `confirmed`, or `cleared`; analysts suggest, senior analysts confirm; confirmation triggers live notifications and email broadcast
- **Suggested Actions** — Context-aware investigation and containment playbooks based on entity type and IOC status
- **Incident Tasking** — Kanban task board (Open / In Progress / Complete) with priority, due dates, overdue highlighting, and entity linkage; task completion progress shown in incident header
- **IOC Summary Panel** — Instant view of all confirmed/suspected IOCs pinned to the incident page
- **Affected Asset Inventory** — Categorised entity list with IOC-only filter, kill chain stage indicators, and CSV export
- **Containment Checklist** — Per-entity checklists with type-specific default items (IP, domain, account, hostname, file, email, and more); custom items; checked-by attribution
- **Remediation Tracking Board** — 4-column Kanban (Pending / In Progress / Completed / Verified) with drag-and-drop, inline before/after state capture, and entity linkage; verification gated to Incident Commander+

### Intelligence & Visualisation
- **Kill Chain Mapping** — Drag-and-drop entity assignment across Lockheed Martin (7 stages), MITRE ATT&CK Enterprise (14 tactics), or MITRE ATT&CK ICS (12 stages); entities can appear in multiple stages
- **AI Attack Narrative** — Generates a 2–4 paragraph analyst-quality attack narrative from kill chain data via the Anthropic API; API key configurable per org in Org Settings
- **TTP Assignment** — Full MITRE ATT&CK technique search and assignment per kill chain mapping; 1,000+ techniques seeded at startup
- **Attack Pattern Recognition** — Co-occurrence suggestions: when a TTP is assigned, the platform suggests related techniques commonly seen together (seeded from known MITRE ATT&CK pairs); accept or dismiss per suggestion
- **Entity Relationship Graph** — Interactive directed graph (React Flow) showing entity relationships with labelled edges, bidirectional support, drag to reposition, delete via keyboard or click
- **Network Boundary Visualisation** — Swimlane flow showing entity zone assignments (IT / OT / trusted / untrusted / DMZ) and boundary traversals
- **Threat Intelligence Enrichment** — Automatic async enrichment on entity create using VirusTotal v3, AbuseIPDB, and Shodan; per-org API keys configured in Org Settings; verdict badge (malicious / suspicious / clean / unknown); enrichment history with collapsible raw JSON
- **Activity Heat Map** — Time-bucketed activity grid on the incident Timeline tab; click any cell to drill into the events for that period
- **Evidence Chain of Custody** — Append-only audit trail per entity recording every view, edit, IOC status change, enrichment, kill chain mapping, and comment; enforced at the database level (PostgreSQL rules prevent DELETE/UPDATE); viewable under the Chain of Custody tab on each entity

### Collaboration & Communication
- **Real-Time Collaboration** — Socket.io with JWT-authenticated incident rooms; entity, kill chain, and relationship changes pushed live to all connected analysts
- **Presence Bar** — Live avatar chips showing which analysts are currently viewing an incident
- **Discussion Panel** — Persistent slide-out comment drawer accessible from any incident tab without losing context; supports `@mention` autocomplete, markdown (bold, italic, code), and edit/delete; main content shifts to accommodate the open panel
- **Live Mentions** — `@mentioning` a team member sends an instant socket notification and bell badge update
- **Incident Timeline** — Chronological event feed filterable by action type and analyst
- **Toast Notifications** — Non-blocking in-app toasts for task assignments, mentions, and IOC events; click to navigate directly to the relevant resource

### Notifications
- **Notification Bell** — Unread count badge, dropdown of last 20 notifications, mark read / mark all read
- **Live Push** — Socket.io delivers notifications instantly without polling
- **Task Deep-Link** — Notification click opens the Tasks tab, expands and scrolls to the specific task
- **Email** — Nodemailer for critical alerts (IOC confirmed, status changes); silently skipped if SMTP is not configured

### Analyst Workflow
- **War Room Dashboard** — Fullscreen SOC wall-screen view with live stat tiles (duration, IOC counts, entity count), kill chain progress, active analyst presence, activity feed, and a scrolling ticker; auto-refreshes every 30 seconds
- **My Tasks** — Cross-incident task view for the logged-in analyst, grouped by incident with priority and due-date indicators
- **Executive Summary** — Non-technical incident summary (overview, attack timeline, business impact, key findings, remediation, risk rating); editable by Senior Analyst+; printable
- **PDF Report Export** — Server-side incident report generation with pdfmake
- **Global Search** — Debounced full-text search across incidents and entities from the NavBar; results link directly to the relevant incident or entity page

### Firewatch — Exploited Vulnerability Watch
- **Standalone service** (`firewatch/`) — which vulnerabilities are being exploited now (CISA KEV + FIRST EPSS), which published SIEM detections cover them, and where your platform has gaps
- **Detection index** — rules from Microsoft Sentinel, Splunk, Elastic, Sigma, Cortex XSIAM/XSOAR, and Emerging Threats Open, shown verbatim with source links; ATT&CK technique gap analysis per platform
- **How to find** — open-source package advisories (GitHub, Debian), Nuclei network checks, Metasploit and Exploit-DB, appliance flags
- **Threat news** — 31 government, vendor research, and news feeds, clustered into stories
- **Data Health** — per-source freshness, fallbacks, and ingest warnings; see [`firewatch/README.md`](firewatch/README.md)

### Security & Administration
- **JWT Authentication** — Local email/password login; minimum 32-character secret enforced at startup; bcrypt cost factor 12
- **SSO** — Azure AD and Okta OIDC via `openid-client` v6; new users auto-provisioned as `analyst`
- **RBAC** — Four roles with rank-based enforcement at both API and UI layers (see [User Roles](#user-roles) below)
- **Password Policy** — NIST SP 800-63B aligned: 15-character minimum for all users; 32-character minimum with letters, numbers, and symbols for Platform Admin accounts
- **Audit Log** — Append-only log of creates/updates/deletes on incidents and entities; never deletable by any role; filterable by user, action type, and resource
- **User Management** — Create users, assign roles, deactivate/reactivate, manage incident assignments
- **Multi-Tenancy** — Organisation-scoped JWTs (`org_id`); all incident, entity, and user data fully isolated per organisation; cross-tenant access denied at the API layer
- **Organisation Onboarding** — Self-service registration with a 3-step wizard
- **Platform Admin Console** — NullVector vendor console for organisation management (create / deactivate / reactivate) and platform-wide user provisioning
- **Platform Admin Access Grants** — Orgs can grant NullVector platform admins time-limited access (7-day expiry) to their incident data for support purposes; every grant, revocation, and auto-expiry is recorded in a tamper-evident audit log viewable by the org's Incident Commander
- **Licensing** — Per-org feature flags with tier-based gating
- **Security Hardening** — Helmet.js headers, rate limiting (100 req/15 min global, 10 req/15 min auth), CORS origin enforcement
- **HTTPS** — Traefik v3 + Let's Encrypt via `docker-compose.prod.yml`

---

## User Roles

| Role | Who | Capabilities |
|---|---|---|
| `analyst` | SOC analyst | Read all incident data; create entities, comments, and tasks; flag IOC as `suspected`; complete assigned tasks |
| `senior_analyst` | Senior SOC analyst | All analyst permissions + update incidents/entities; confirm/clear IOC status; create/manage tasks; add custom checklist items; delete own comments; create remediation items |
| `incident_commander` | Incident lead / team manager | All senior analyst permissions + delete mappings; manage org users (create, deactivate, role changes); manage incident assignments; verify remediation items; manage org settings and API keys; view audit logs; grant/revoke platform admin access |
| `platform_admin` | **NullVector Security only** | Platform-level management: create/deactivate/reactivate organisations; provision users across the platform (including other platform admins); view org incident data **only** when that org has explicitly granted access (7-day expiry, audited) |

> Platform admin accounts are exclusively provisioned by NullVector Security and cannot be created through the standard user management interface.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 15 (raw `pg`, no ORM; repository pattern) |
| Real-Time | Socket.io |
| Auth | JWT, bcryptjs (cost 12), openid-client v6 (OIDC) |
| Validation | Zod |
| Frontend | React 18, TypeScript, React Router v6 |
| Visualisation | React Flow (`@xyflow/react` v12) — relationships + network maps |
| Kill Chain | Pure HTML/CSS pipeline |
| AI Narrative | `@anthropic-ai/sdk` — claude-haiku-4-5 |
| PDF Export | pdfmake (server-side) |
| Email | Nodemailer |
| Infrastructure | Docker Compose, Traefik v3, nginx (`1-alpine-slim`) |

---

## Quick Start (Local Development)

### Prerequisites
- Docker and Docker Compose

### Steps

```bash
git clone https://github.com/securelinksolutions/fission-ops.git
cd fission-ops
cp .env.example .env
# Edit .env — set a strong JWT_SECRET (min 32 chars)
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/v1
- Firewatch: http://localhost:3004 (first data ingest runs on startup and takes a few minutes)

### Demo Accounts

| Email | Password | Role |
|---|---|---|
| analyst@fission.local | analyst123 | Analyst |
| commander@fission.local | analyst123 | Incident Commander |

> Demo passwords are intentionally short for local development only. Production deployments enforce the 15-character minimum.

---

## Production Deployment (HTTPS)

### Requirements
- A domain pointing to your server
- Ports 80 and 443 open

### Steps

```bash
cp .env.example .env.prod
# Set all values in .env.prod, especially:
#   JWT_SECRET — long random string (min 32 chars)
#   DOMAIN     — your domain (e.g. fission.example.com)
#   SSL_EMAIL  — email for Let's Encrypt

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Traefik handles TLS termination and auto-renews certificates via Let's Encrypt.

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret — minimum 32 characters |
| `FRONTEND_URL` | Allowed CORS origin(s), comma-separated |

### Optional — SSO

| Variable | Description |
|---|---|
| `OIDC_AZURE_CLIENT_ID` | Azure AD application client ID |
| `OIDC_AZURE_CLIENT_SECRET` | Azure AD client secret |
| `OIDC_AZURE_TENANT_ID` | Azure AD tenant ID |
| `OIDC_OKTA_CLIENT_ID` | Okta application client ID |
| `OIDC_OKTA_CLIENT_SECRET` | Okta client secret |
| `OIDC_OKTA_DOMAIN` | Okta domain (e.g. `yourorg.okta.com`) |
| `SSO_REDIRECT_BASE_URL` | Base URL for OIDC callback (e.g. `https://fission.example.com`) |

### Optional — Email

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From address (e.g. `noreply@example.com`) |

Email notifications are silently skipped if SMTP variables are absent.

### Optional — AI Narrative

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Fallback Anthropic key if not set per-org in Org Settings |

### Optional — Production

| Variable | Description |
|---|---|
| `DOMAIN` | Public domain for Traefik HTTPS |
| `SSL_EMAIL` | Let's Encrypt registration email |
| `NODE_ENV` | Set to `production` |

### Per-Organisation — Integrations

Configured in **Org Settings → Integrations** (stored per org, not in env):

| Service | Used for |
|---|---|
| VirusTotal | Entity enrichment — IPs, domains, files |
| AbuseIPDB | IP reputation and abuse reports |
| Shodan | Internet-facing device and service discovery |
| Anthropic | AI-generated kill chain attack narratives |

---

## Platform Admin Access (SaaS / Support)

When NullVector Security needs to assist with a support issue, the process is:

1. The organisation's **Incident Commander** opens **Org Settings → Platform Admin Access** and enables access
2. Access is granted for **7 days** with a confirmation prompt before saving
3. NullVector platform admins can view the organisation's incident data for the duration
4. The Incident Commander can **revoke access at any time** before expiry
5. On expiry, access is automatically revoked by the system on the next access attempt

Every grant, revocation, and auto-expiry is recorded in a tamper-evident log (actor, IP, timestamp) viewable under **Org Settings → Platform Admin Access → View access log**.

For **self-hosted deployments**, this mechanism applies equally — a platform admin user would typically be an internal IT/ops team member. If no platform admin user is created, the role has no effect.

---

## Database Migrations

Migrations run automatically on backend startup — no manual intervention required.

| File | Description |
|---|---|
| `db/init.sql` | Core schema; Lockheed Martin kill chain stages; demo users |
| `db/migrate_001.sql` | `entity_relationships`; MITRE ATT&CK Enterprise and ICS stages |
| `db/migrate_002.sql` | `ttps`, `entity_stage_ttps`, `entity_zone_assignments`, `boundary_traversals` |
| `db/migrate_003.sql` | `audit_logs`, `incident_assignments`; user deactivation columns |
| `db/migrate_004.sql` | `organizations`; `platform_admin` role; `org_id` on users/incidents/audit_logs |
| `db/migrate_005.sql` | `incident_executive_summaries`, `notifications`, `comments`, `incident_tasks`, `org_api_keys`; IOC and enrichment columns on entities |
| `db/migrate_006.sql` | `incident_status` operational field; license/feature flag columns on organizations |
| `db/migrate_007.sql` | File, process, registry, certificate, URL, custom entity types |
| `db/migrate_008.sql` | Entity relationship and boundary traversal enhancements |
| `db/migrate_009.sql` | `task_comments`; task–entity linking table |
| `db/migrate_010.sql` | `task_entity_links` foreign key fixes |
| `db/migrate_011.sql` | `entity_relationships` schema cleanup |
| `db/migrate_012.sql` | `task_id` column on `notifications` for task deep-link navigation |
| `db/migrate_013.sql` | `entity_enrichment_history` — per-run enrichment records with source, verdict, raw response |
| `db/migrate_014.sql` | `entity_checklists` — per-entity containment checklist items |
| `db/migrate_015.sql` | `remediation_items` — remediation tracking with status, assignee, before/after state |
| `db/migrate_016.sql` | `ttp_relationships`, `ttp_suggestion_log` — co-occurrence data for attack pattern recognition |
| `db/migrate_017.sql` | `evidence_custody_log` — append-only chain of custody log with DB-level delete/update rules |
| `db/migrate_018.sql` | `platform_admin_access` flag on organisations |
| `db/migrate_019.sql` | `platform_admin_access_log`, `platform_admin_access_expires_at` — access audit trail and expiry |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                     │
│   React Router · React Flow · Socket.io-client · Axios      │
│   utils/constants.ts · utils/time.ts · utils/passwordPolicy │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + WebSocket
                    nginx (proxy /api + /socket.io)
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Backend (Express + Socket.io)                  │
│  JWT Auth · RBAC · Zod Validation · express-async-errors    │
│  Routes → Repositories → PostgreSQL (raw pg)                │
│  Services: enrichment (VT/AbuseIPDB/Shodan), email, AI      │
│  Socket: incident rooms + per-user notification channels    │
│  utils/passwordPolicy.ts — NIST 800-63B policy enforcement  │
└────────────────────────┬────────────────────────────────────┘
                         │ pg pool
┌────────────────────────▼────────────────────────────────────┐
│                    PostgreSQL 15                             │
│  25+ tables · 19 migrations · MITRE ATT&CK seeded           │
│  Append-only custody log enforced via PostgreSQL rules       │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

**Backend won't start — "Database schema not initialized"**
The `users` table doesn't exist. Run `docker compose up postgres` first and wait for it to be healthy before starting the backend.

**"JWT_SECRET must be at least 32 characters"**
Set a longer value in your `.env` file. The backend validates this at startup.

**MITRE ATT&CK data not seeding**
The seeder fetches from `raw.githubusercontent.com` on startup. Ensure outbound HTTPS is allowed from the backend container. Seeding is skipped automatically if more than 200 TTPs already exist.

**SSO redirect mismatch**
Ensure `SSO_REDIRECT_BASE_URL` exactly matches the base URL registered in your IdP, without a trailing slash.

**Enrichment shows "skipped"**
No API keys configured for the entity's organisation. Add them in **Org Settings → Integrations**.

**AI narrative returns an error**
The Anthropic key is not configured. Set it in **Org Settings → Integrations** or via the `ANTHROPIC_API_KEY` environment variable. The org-level key takes precedence over the env var.

**Platform admin access not working after 7 days**
Access expires automatically. The organisation's Incident Commander must re-enable it in **Org Settings → Platform Admin Access**. Each grant resets the 7-day window.
