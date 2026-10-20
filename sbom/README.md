# Software Bill of Materials — Review

Last reviewed: 2026-10-20

This directory contains CycloneDX SBOMs for all three deployable services in
this repo, generated directly from each service's installed dependency tree:

- `backend.cdx.json` — Express/TypeScript API (328 components)
- `frontend.cdx.json` — React/TypeScript SPA (237 components)
- `license-server.cdx.json` — license microservice (131 components)

Regenerate after any dependency change:

```bash
cd backend && npx @cyclonedx/cyclonedx-npm --output-format JSON --output-file ../sbom/backend.cdx.json
cd frontend && npx @cyclonedx/cyclonedx-npm --output-format JSON --output-file ../sbom/frontend.cdx.json
cd fission-license-server && npx @cyclonedx/cyclonedx-npm --output-format JSON --output-file ../sbom/license-server.cdx.json
```

## Findings as of this review

### Docker base images

| Service | Before | After | Reason |
|---|---|---|---|
| backend | `node:24-alpine` | unchanged | Current Active LTS (supported to Apr 2028) |
| frontend | `node:24-alpine` / `nginx:1-alpine-slim` | unchanged | Current |
| **license-server** | `node:20-alpine` | **`node:24-alpine`** | Node 20 reached end-of-life **2026-04-30** — no further security patches from upstream Node.js |

The license-server Dockerfile was also missing `apk upgrade --no-cache` in
both build stages — present on backend/frontend since an earlier CVE pass but
never applied here. Added to match.

### npm audit — before / after

| Service | Before | After |
|---|---|---|
| backend | 18 (1 critical, 14 high, 3 moderate) | 3 high (1 advisory, dev-only, see below) |
| frontend | 15 (12 high, 3 moderate) | 2 moderate (see below) |
| license-server | 5 (1 critical, 4 moderate) | **0** |

**Critical fixed:** `proxy-addr` IP-spoofing (GHSA-jqcg-44mw-7w3h) in both
backend and license-server — this one matters more than most here, since
`req.ip` feeds the audit log and chain-of-custody `actor_ip` fields; a
spoofable IP undermines the integrity of those records.

**Explicit major-version bumps** (not covered by plain `npm audit fix`,
applied and verified — typecheck, build, and a runtime smoke test for each):
- `nodemailer` 8.x → 10.1.7 (backend) — fixes 8 advisories including an
  SSRF bypass and a cross-tenant SMTP credential disclosure. API surface used
  here (`createTransport`/`sendMail`) is unchanged.
- `uuid` 9.x → **11.1.1** (license-server) — fixes a buffer-bounds issue.
  Pinned to the 11.x line rather than latest (14.x) because uuid's own
  deprecation notice says 12+ drops CommonJS support, and this project is
  `"module": "commonjs"`. Verified with a direct `require()` smoke test.
- `@types/node` 20.x → 24.x (backend, license-server) — was tracking Node 20
  types while the Docker image already ran Node 24.

**Everything else** (axios, brace-expansion, browserslist, follow-redirects,
form-data, js-yaml, body-parser, qs, express, socket.io-parser, ws, engine.io,
ip-address, postcss, nanoid, react-router moderate CVEs' transitive siblings)
fixed via plain `npm audit fix` — no breaking changes, same major versions.

### Left unfixed, deliberately

- **backend — `braces` (high, via `chokidar` ← `ts-node-dev`)**: no upstream
  fix exists. `ts-node-dev` is a devDependency used only by `npm run dev`
  (`npm ci --omit=dev` in the production Docker stage never installs it) —
  this is a local-dev-only exposure, not a production one.
- **frontend — `react-router` / `react-router-dom` (2 moderate)**: fix
  requires jumping v6 → v7, which touches routing in every page in the app.
  Of the two CVEs, the SSR hydration one doesn't apply (this is a pure
  client-side SPA, no SSR) and the open-redirect one needs a crafted
  backslash in an internal `<Link>`/`useNavigate` call, which this app does
  not do with user-controlled input. Recommended for a dedicated upgrade pass
  with route-by-route testing, not bundled into a dependency-patch commit.

All three services were rebuilt (`tsc`/`vite build`) and linted after every
change — no new type errors, no new lint findings beyond what already existed
on the branch before this review.
