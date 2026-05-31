# ⚡ Fission Ops

A full-stack incident response platform for cyber analysts — built for SOC teams to track, investigate, and communicate about live security incidents in real time.

---

## Features

### Core Platform
- **Incident Management** — Create and track incidents with severity levels (low/medium/high/critical) and status (open/contained/closed)
- **Entity Tracking** — Add entities of type hostname, IP, email, domain, or account with type-specific metadata (JSONB)
- **Kill Chain Mapping** — Map entities across Lockheed Martin (7 stages), MITRE ATT&CK Enterprise (12 stages), or MITRE ATT&CK ICS (12 stages) with drag-and-drop
- **Entity Relationship Graph** — Directed labeled relationship graph with React Flow (zoom/pan/minimap)
- **Network Boundary Visualization** — Swimlane flow showing entity zone assignments and boundary traversals
- **TTP Assignment** — Full MITRE ATT&CK technique search and assignment per kill-chain mapping (1,000+ techniques seeded at startup)
- **PDF Report Export** — Server-side incident report generation with pdfmake

### Collaboration & Communication
- **Real-Time Collaboration** — Socket.io with JWT-authenticated incident rooms; entity/kill chain/relationship changes pushed live to all connected analysts
- **Presence Bar** — Live avatar chips showing which analysts are currently viewing an incident
- **Comments & Mentions** — Threaded comments on incidents and entities with `@mention` autocomplete, markdown support (bold, italic, code), edit/delete by author or commander
- **Incident Timeline** — Chronological event feed filterable by action type and analyst

### Analyst Workflow
- **Incident Tasking** — Kanban task board (Open / In Progress / Complete) with priority badges, due dates, overdue highlighting, and task completion percentage in incident header
- **My Tasks** — Cross-incident task view for the logged-in analyst, grouped by incident
- **IOC Flagging** — Flag entities as `suspected`, `confirmed`, or `cleared` IOC; analysts suggest, senior analysts+ confirm; confirmation triggers notifications + email broadcast
- **IOC Summary Panel** — Instant view of all confirmed/suspected IOCs on the incident dashboard

### Intelligence & Reporting
- **Threat Intelligence Enrichment** — Automatic async enrichment on entity create; integrates VirusTotal v3, AbuseIPDB, and Shodan; verdict (malicious/suspicious/clean) shown on entity chips
- **Executive Summary** — Non-technical incident summary page (overview, attack timeline, business impact, key findings, remediation, risk rating); editable by senior analysts+; printable

### Notifications
- **In-App Notification Bell** — Unread count badge, dropdown of last 20 notifications, mark read/mark all read
- **Live Notifications** — Socket.io push for mentions, task assignments, IOC confirmations, and incident status changes
- **Email Notifications** — Nodemailer for critical alerts (IOC confirmed, status changes); gracefully skipped if SMTP not configured

### Security & Administration
- **JWT Authentication** — Local email/password login; `jsonwebtoken` with minimum 32-char secret enforced at startup
- **SSO** — Azure AD and Okta OIDC via `openid-client` v6; auto-provisions new users as `analyst`
- **RBAC** — Four roles: `analyst` → `senior_analyst` → `incident_commander` → `super_admin` with rank-based enforcement
- **Audit Logging** — Append-only audit log capturing creates/updates/deletes on incidents and entities; filterable by user, action, and resource type
- **User Management** — Create users, assign roles, deactivate/reactivate, manage incident assignments
- **Multi-Tenancy** — Organizations table with `org_id`-scoped JWT; all data isolated per organization
- **Organization Onboarding** — Self-service registration flow with 3-step wizard
- **Super Admin Console** — Platform-wide organization management (create/deactivate/reactivate)
- **Security Hardening** — Helmet.js headers, rate limiting (100 req/15min global, 10 req/15min auth)
- **HTTPS** — Traefik v3 + Let's Encrypt via `docker-compose.prod.yml`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 15 (raw `pg`, no ORM) |
| Real-Time | Socket.io |
| Auth | JWT, bcryptjs, openid-client v6 (OIDC) |
| Validation | Zod |
| Frontend | React 18, TypeScript, React Router v6 |
| Visualization | React Flow (`@xyflow/react` v12) |
| PDF Export | pdfmake (server-side) |
| Email | Nodemailer |
| Infrastructure | Docker Compose, Traefik v3, nginx |

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

### Demo Accounts

| Email | Password | Role |
|---|---|---|
| analyst@fission.local | analyst123 | Analyst |
| commander@fission.local | analyst123 | Incident Commander |
| superadmin@fission.local | superadmin123 | Super Admin |

All demo accounts belong to the default organization (`org_id: 00000000-0000-0000-0000-000000000001`).

---

## Production Deployment (HTTPS)

### Requirements
- A domain pointing to your server
- Ports 80 and 443 open

### Steps

```bash
cp .env.example .env.prod
# Set all values in .env.prod, especially:
#   JWT_SECRET — long random string
#   DOMAIN — your domain (e.g. fission.example.com)
#   SSL_EMAIL — email for Let's Encrypt

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

If SMTP variables are absent, email notifications are silently skipped.

### Optional — Production

| Variable | Description |
|---|---|
| `DOMAIN` | Public domain for Traefik HTTPS |
| `SSL_EMAIL` | Let's Encrypt registration email |
| `NODE_ENV` | Set to `production` |

### Optional — Threat Intelligence

Configure per-organization in the **Org Settings → API Keys** page (stored encrypted per org, not in env):
- **VirusTotal** API key
- **AbuseIPDB** API key
- **Shodan** API key

---

## User Roles

| Role | Permissions |
|---|---|
| `analyst` | Read all incident data; create entities and comments; suggest IOC status; view tasks |
| `senior_analyst` | All analyst permissions + update incidents/entities; confirm/clear IOC status; create and update tasks |
| `incident_commander` | All senior analyst permissions + delete; manage users; view audit logs; manage incident assignments |
| `super_admin` | Platform-wide access across all organizations |

---

## SSO Configuration

### Azure AD
1. Register an app in Azure Portal → Azure Active Directory → App registrations
2. Set redirect URI to `{SSO_REDIRECT_BASE_URL}/api/v1/auth/sso/callback`
3. Set `OIDC_AZURE_CLIENT_ID`, `OIDC_AZURE_CLIENT_SECRET`, `OIDC_AZURE_TENANT_ID`

### Okta
1. Create an OIDC Web Application in Okta Admin Console
2. Set Sign-in redirect URI to `{SSO_REDIRECT_BASE_URL}/api/v1/auth/sso/callback`
3. Set `OIDC_OKTA_CLIENT_ID`, `OIDC_OKTA_CLIENT_SECRET`, `OIDC_OKTA_DOMAIN`

SSO users are auto-provisioned as `analyst` role on first login and scoped to the configured organization.

---

## Database Migrations

Migrations are applied automatically on backend startup. Never need to run them manually.

| File | Contents |
|---|---|
| `db/init.sql` | Core schema + 7 Lockheed Martin kill chain stages + 2 demo users |
| `db/migrate_001.sql` | `entity_relationships` table; MITRE ATT&CK Enterprise + ICS kill chain stages |
| `db/migrate_002.sql` | `ttps`, `entity_stage_ttps`, `entity_zone_assignments`, `boundary_traversals` tables |
| `db/migrate_003.sql` | `audit_logs`, `incident_assignments`; user deactivation columns |
| `db/migrate_004.sql` | `organizations` table; `super_admin` role; `org_id` on users/incidents/audit_logs |
| `db/migrate_005.sql` | `incident_executive_summaries`, `notifications`, `comments`, `incident_tasks`, `org_api_keys`; IOC and enrichment columns on entities |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                  │
│  React Router · React Flow · Socket.io-client · Axios   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP + WebSocket
┌────────────────────────▼────────────────────────────────┐
│              Backend (Express + Socket.io)               │
│  JWT Auth · RBAC · Zod Validation · express-async-errors│
│  Routes → Repositories → PostgreSQL (raw pg)            │
│  Services: enrichment, email, socket emitters           │
└────────────────────────┬────────────────────────────────┘
                         │ pg pool
┌────────────────────────▼────────────────────────────────┐
│                    PostgreSQL 15                         │
│  15 tables · 5 migrations · MITRE ATT&CK seeded         │
└─────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

**Backend won't start — "Database schema not initialized"**
The `users` table doesn't exist. Run `docker compose up postgres` first and wait for it to be healthy before starting the backend.

**"JWT_SECRET must be at least 32 characters"**
Set a longer value in your `.env` file. The backend validates this at startup.

**MITRE ATT&CK data not seeding**
The seeder fetches from `raw.githubusercontent.com` on startup. Ensure outbound HTTPS is allowed. It is skipped automatically if >200 TTPs already exist.

**SSO redirect mismatch**
Ensure `SSO_REDIRECT_BASE_URL` exactly matches the base URL registered in your IdP, without a trailing slash.

**Enrichment shows "skipped"**
No API keys are configured for the entity's organization. Add them in Org Settings → API Keys.
