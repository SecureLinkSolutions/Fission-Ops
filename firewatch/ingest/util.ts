import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

export const USER_AGENT = 'Firewatch-ingest/1.0 (+https://github.com/securelinksolutions/fission-ops)';

export function log(...args: unknown[]): void {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

export class FatalIngestError extends Error {}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function fetchWithRetry(url: string, init: RequestInit & { timeoutMs?: number; retries?: number } = {}): Promise<Response> {
  const { timeoutMs = 60_000, retries = 2, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { 'user-agent': USER_AGENT, ...(rest.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      // 4xx other than rate limiting will not get better on retry.
      if (res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status} for ${url}`);
      lastErr = new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      lastErr = err;
      if (err instanceof Error && /HTTP 4\d\d/.test(err.message) && !/HTTP 429/.test(err.message)) throw err;
    }
    if (attempt < retries) await sleep(2000 * 2 ** attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchJson<T>(url: string, init?: Parameters<typeof fetchWithRetry>[1]): Promise<T> {
  return (await fetchWithRetry(url, init)).json() as Promise<T>;
}

export async function fetchText(url: string, init?: Parameters<typeof fetchWithRetry>[1]): Promise<string> {
  return (await fetchWithRetry(url, init)).text();
}

export async function fetchBuffer(url: string, init?: Parameters<typeof fetchWithRetry>[1]): Promise<Buffer> {
  return Buffer.from(await (await fetchWithRetry(url, init)).arrayBuffer());
}

/** Try each URL in turn; returns the first that works and which one it was. */
export async function fetchFirst<T>(urls: string[], get: (url: string) => Promise<T>): Promise<{ value: T; url: string }> {
  const errors: string[] = [];
  for (const url of urls) {
    try {
      return { value: await get(url), url };
    } catch (err) {
      errors.push(`${url}: ${errMsg(err)}`);
    }
  }
  throw new Error(errors.join('; '));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data));
}

/** Write via a temp file and rename, so readers never see a half-written file. */
export function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp-${process.pid}`;
  writeJson(tmp, data);
  fs.renameSync(tmp, file);
}

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function walk(dir: string, filter: (file: string) => boolean): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '.git') stack.push(full);
      } else if (filter(full)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

export function shortHash(text: string, len = 12): string {
  return createHash('sha256').update(text).digest('hex').slice(0, len);
}

export function bucketOf(id: string, buckets: number): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % buckets;
}

export function git(cwd: string, args: string[], allowFail = false): string {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (res.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} failed: ${(res.stderr || res.stdout || '').trim().slice(0, 500)}`);
  }
  return res.stdout ?? '';
}

export interface RepoSpec {
  url: string;
  dir: string;
  /** Non-cone sparse-checkout patterns; omit for a full checkout. */
  sparse?: string[];
  /** Fetch blobs on demand. Pair with `sparse` for very large repositories. */
  blobless?: boolean;
  /** Days of history to keep for the Content Updates feed. 0 means depth 1. */
  historyDays: number;
}

export interface RepoState {
  commit: string;
  committed: string;
}

/** Clone or fast-forward a repository to the remote default branch. */
export function syncRepo(spec: RepoSpec): RepoState {
  const since = new Date(Date.now() - (spec.historyDays + 5) * 86_400_000).toISOString().slice(0, 10);
  const depthArgs = spec.historyDays > 0 ? [`--shallow-since=${since}`] : ['--depth=1'];
  if (!fs.existsSync(path.join(spec.dir, '.git'))) {
    ensureDir(path.dirname(spec.dir));
    const args = ['clone', '-q', ...depthArgs, '--no-checkout'];
    if (spec.blobless) args.push('--filter=blob:none');
    args.push(spec.url, spec.dir);
    git(path.dirname(spec.dir), args);
  } else {
    // --shallow-since fails when the window holds no new commits on an existing shallow clone; fall back to depth 1.
    const fetched = spawnSync('git', ['fetch', '-q', ...depthArgs, 'origin', 'HEAD'], { cwd: spec.dir, encoding: 'utf8' });
    if (fetched.status !== 0) git(spec.dir, ['fetch', '-q', '--depth=1', 'origin', 'HEAD']);
  }
  if (spec.sparse) {
    git(spec.dir, ['sparse-checkout', 'set', '--no-cone', ...spec.sparse]);
  }
  const target = git(spec.dir, ['rev-parse', 'FETCH_HEAD'], true).trim() || git(spec.dir, ['rev-parse', 'origin/HEAD'], true).trim() || 'HEAD';
  git(spec.dir, ['checkout', '-q', '--force', '--detach', target]);
  const [commit, committed] = git(spec.dir, ['log', '-1', '--format=%H %cI']).trim().split(' ');
  return { commit, committed: new Date(committed).toISOString() };
}

export interface GitChange {
  commit: string;
  date: string;
  status: 'A' | 'M' | 'D';
  path: string;
}

/** File-level changes in the last `days` days under the given path prefixes. */
export function repoChanges(dir: string, days: number, match: (p: string) => boolean): GitChange[] {
  const out = git(dir, ['log', `--since=${days}.days`, '--no-renames', '--name-status', '--format=@@%H %cI'], true);
  const changes: GitChange[] = [];
  let commit = '';
  let date = '';
  for (const line of out.split('\n')) {
    if (line.startsWith('@@')) {
      [commit, date] = line.slice(2).split(' ');
      continue;
    }
    const m = /^([AMD])\t(.+)$/.exec(line);
    if (m && match(m[2])) changes.push({ commit, date: new Date(date).toISOString(), status: m[1] as 'A' | 'M' | 'D', path: m[2] });
  }
  return changes;
}

/** Minimal ustar reader for .tar.gz rule bundles. */
export function untarGz(buf: Buffer): Map<string, Buffer> {
  const tar = gunzipSync(buf);
  const files = new Map<string, Buffer>();
  let off = 0;
  while (off + 512 <= tar.length) {
    const header = tar.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/s, '').trim() || '0', 8);
    const type = String.fromCharCode(header[156]);
    off += 512;
    if (type === '0' || type === '\0') files.set(prefix ? `${prefix}/${name}` : name, tar.subarray(off, off + size));
    off += Math.ceil(size / 512) * 512;
  }
  return files;
}

export function isoDay(d: Date | string = new Date()): string {
  return (typeof d === 'string' ? new Date(d) : d).toISOString().slice(0, 10);
}

export function toIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
