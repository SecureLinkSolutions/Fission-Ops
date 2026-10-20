# Firewatch

Exploited vulnerability watch: which vulnerabilities are being exploited now, which published SIEM detections cover them, and where your platform has gaps. Built from free sources: CISA KEV, FIRST EPSS, MITRE ATT&CK, NVD, and vendor rule repositories.

Firewatch indexes and links published rules. It does not write, convert, or test them.

## Pages

| Route | Page | What it shows |
|---|---|---|
| `#/` | Overview | Your platform's technique gaps and CVE-specific coverage, new KEV entries with how to find them, rules you could adapt, techniques to borrow rules for, new since your last visit, latest headlines, catalog at a glance, trends, federal deadlines, watchlist matches |
| `#/catalog` | Catalog | The full KEV catalog with filters (vendor, how to find, rules, ransomware, forensic triage, public exploit, added, due), sorting, CSV export; filters live in the URL so "Copy address" shares a view |
| `#/cve/:id` | CVE | KEV entry, EPSS with 30-day history, CVSS, open-source packages (GitHub/Debian), Nuclei checks, Metasploit and Exploit-DB, every CVE-specific rule verbatim, NVD record, headlines naming it |
| `#/watchlist` | Watchlist | Vendors, products, and CVEs you watch, with matching KEV entries; import/export |
| `#/news` | Security News | Headlines from news publishers, clustered into stories when several cover the same event |
| `#/intel` | Threat Intel | Vendor research and government advisories, with the KEV entries they name |
| `#/coverage` | Coverage | All platforms compared, ATT&CK coverage by tactic, technique gaps, CVE rules to adapt, platform overlap, CSV report |
| `#/library` | Library | Every rule from the SIEM platforms (about 13,000), filterable by platform, tactic, technique, product, and CVE |
| `#/rule/:platform/:id` | Rule | One rule, verbatim, with source link and licence |
| `#/updates` | Content Updates | Rules each publisher added, changed, or removed in the last 30 days |
| `#/health` | Data Health | Every source's version, publish and retrieval time, freshness, ingest warnings, news feed status, attribution |
| `#/feedback`, `#/licences`, `#/privacy` | | Feedback form, licences and attribution, privacy notes |

Your platform choice, watchlist, theme, and "seen" list are stored only in the browser.

## Sources

| Source | Used for |
|---|---|
| CISA KEV (cisa.gov, falling back to the `cisagov/kev-data` mirror) | The catalog itself; ransomware use, forensic triage, due dates |
| FIRST EPSS daily CSV and EPSS API | Scores, percentiles, 30-day history |
| MITRE ATT&CK Enterprise (STIX) | Technique names and tactics |
| NVD CVE API 2.0 (`fkie-cad/nvd-json-data-feeds` mirror, or the API when `NVD_API_KEY` is set) | CVSS, CWE, CPE (how to find), references |
| Metasploit module metadata, Exploit-DB | Public exploits |
| Nuclei templates | Public network checks |
| GitHub Advisory Database, Debian via OSV.dev | Open-source packages |
| Azure/Azure-Sentinel, splunk/security_content, elastic/detection-rules, SigmaHQ/sigma, demisto/content (XSIAM, XSOAR), Emerging Threats Open | Detection rules |
| 31 RSS/Atom feeds (government, vendor research, news) | Headlines only: title, date, link |

## How the ingest works

`npm run ingest` fetches every source, joins them on CVE ID, and writes a snapshot of static JSON files to `var/data` (or `$FIREWATCH_VAR/data`):

- **KEV and ATT&CK are required.** If either is missing or malformed, nothing is published and the previous snapshot stays live.
- **Every other source falls back.** A source that fails keeps its last good result, marked on Data Health. With no earlier result, it is empty and listed as a warning.
- **News needs at least 60% of feeds.** Below that, the previous headlines are kept.
- **Publishing is atomic.** The snapshot is built in a separate directory and swapped in with a rename.

Rule repositories are shallow-cloned with 35 days of history into `var/cache`, so the commit log provides Content Updates. Sentinel and demisto/content use sparse, blobless clones. Emerging Threats has no public history, so its changes are compared between snapshots.

`npm run ingest:news` refreshes only the headlines.

Matching rules to CVEs: a rule names a CVE when the CVE ID appears in its title, tags, CVE field, file name, or description, in any of the spellings `CVE-2021-44228`, `cve.2021-44228`, or `CVE_2021_44228`. For Suricata, the CVE must appear in `reference:cve`, `msg`, or `metadata`. Technique gaps roll sub-techniques up to their parent: a rule for T1037.001 covers T1037.

## Running

```bash
cd firewatch
npm install
npm run build      # typecheck, then build the web app into web/dist
npm test
npm run ingest     # first snapshot; takes a few minutes and about 1 GB of git clones
npm start          # http://localhost:8787
```

`npm start` also schedules refreshes: a full ingest every `FIREWATCH_FULL_INTERVAL_HOURS` (default 24), and headlines every `FIREWATCH_NEWS_INTERVAL_MINUTES` (default 60). Set `FIREWATCH_SCHEDULER=off` to serve only. If no snapshot exists yet, the server starts an ingest immediately.

For development, run `npm start` and `npm run dev` together. Vite on port 5173 proxies `/data` and `/api` to the server.

With Docker Compose from the repository root, the `firewatch` service serves on port 3004 and keeps its data in the `firewatch_data` volume. `docker-compose.prod.yml` routes `FIREWATCH_DOMAIN` to it through Traefik.

Requires Node.js 22.18 or later, which runs the TypeScript sources directly, and `git`.

Feedback submissions are appended to `var/state/feedback.jsonl`.

## Hosting on GitHub Pages

Firewatch also runs as a static site. `.github/workflows/firewatch-pages.yml` does the ingest in GitHub Actions and publishes the result to Pages. It runs a full ingest daily, refreshes headlines hourly, and also runs on pushes to `main` under `firewatch/`.

One-time setup:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.** On a private repository this needs a paid plan. The published site is public.
2. Merge the workflow to the default branch. Scheduled runs only fire from there.
3. **Actions → Firewatch Pages → Run workflow** (mode `full`) to publish the first snapshot. It takes about 5 to 10 minutes while the rule repositories clone.
4. Optional: add an `NVD_API_KEY` repository secret to read NVD records from the API instead of the mirror.
5. Optional: set a `FIREWATCH_FEEDBACK_URL` repository variable. Pages has no server, so the feedback page links out; by default it opens an issue in this repository, which only people with access to the repository can do. A `mailto:` address or a public repository's issue form works for everyone.

On Pages, state that must last between runs is kept in the Actions cache: trends history, Emerging Threats diffs, each source's last good copy, and the clones. If the cache is evicted, trends history is recovered from the live site. A failed ingest fails the job, so the published site stays as it was.
