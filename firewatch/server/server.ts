import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createGzip } from 'node:zlib';
import { resolvePaths } from '../ingest/build.ts';

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = path.resolve(import.meta.dirname, '..');
const WEB = path.join(ROOT, 'web', 'dist');
const paths = resolvePaths();
const FULL_HOURS = Number(process.env.FIREWATCH_FULL_INTERVAL_HOURS ?? 24);
const NEWS_MINUTES = Number(process.env.FIREWATCH_NEWS_INTERVAL_MINUTES ?? 60);
const SCHEDULER = process.env.FIREWATCH_SCHEDULER !== 'off';
const FEEDBACK_FILE = path.join(paths.state, 'feedback.jsonl');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

function log(...args: unknown[]) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

/** Resolve a URL path under `base`, refusing anything that escapes it. */
function safeJoin(base: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath);
  const full = path.resolve(base, `.${path.posix.normalize(`/${decoded}`)}`);
  return full === base || full.startsWith(`${base}${path.sep}`) ? full : null;
}

function sendFile(req: http.IncomingMessage, res: http.ServerResponse, file: string, cache: string) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain', ...SECURITY_HEADERS }).end('Not found');
      return;
    }
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { etag, ...SECURITY_HEADERS }).end();
      return;
    }
    const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? '')) && /json|javascript|css|html|svg/.test(type) && stat.size > 1024;
    res.writeHead(200, {
      'content-type': type,
      'cache-control': cache,
      etag,
      vary: 'accept-encoding',
      ...(gzip ? { 'content-encoding': 'gzip' } : { 'content-length': stat.size }),
      ...SECURITY_HEADERS,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(file);
    (gzip ? stream.pipe(createGzip({ level: 6 })) : stream).pipe(res);
  });
}

// ------------------------------------------------ feedback

const recent = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 10;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', ...SECURITY_HEADERS }).end(JSON.stringify(body));
}

function handleFeedback(req: http.IncomingMessage, res: http.ServerResponse) {
  const ip = req.socket.remoteAddress ?? 'unknown';
  if (rateLimited(ip)) return json(res, 429, { error: 'Too many messages; try again later' });
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return json(res, 415, { error: 'Expected JSON' });
  let size = 0;
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => {
    size += c.length;
    if (size > 16_384) {
      json(res, 413, { error: 'Message too large' });
      req.destroy();
    } else chunks.push(c);
  });
  req.on('end', () => {
    if (res.headersSent) return;
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { message?: unknown; contact?: unknown; page?: unknown };
      const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
      if (message.length < 5) return json(res, 400, { error: 'Message is too short' });
      const entry = {
        at: new Date().toISOString(),
        message,
        contact: typeof body.contact === 'string' ? body.contact.trim().slice(0, 200) : '',
        page: typeof body.page === 'string' ? body.page.slice(0, 500) : '',
      };
      fs.mkdirSync(path.dirname(FEEDBACK_FILE), { recursive: true });
      fs.appendFileSync(FEEDBACK_FILE, `${JSON.stringify(entry)}\n`);
      json(res, 201, { ok: true });
    } catch {
      json(res, 400, { error: 'Invalid JSON' });
    }
  });
}

// ------------------------------------------------ ingest scheduler

let running: string | null = null;

function runIngest(mode: 'full' | 'news'): Promise<void> {
  if (running) {
    log(`skip ${mode} ingest: ${running} ingest still running`);
    return Promise.resolve();
  }
  running = mode;
  log(`start ${mode} ingest`);
  return new Promise((resolve) => {
    // A child process keeps the ingest's memory and failures away from the web server.
    const child = spawn(process.execPath, [path.join(ROOT, 'ingest', 'cli.ts'), ...(mode === 'news' ? ['--news-only'] : [])], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      log(`${mode} ingest exited with ${code}`);
      running = null;
      resolve();
    });
  });
}

function startScheduler() {
  const hasSnapshot = fs.existsSync(path.join(paths.data, 'snapshot.json'));
  if (!hasSnapshot) void runIngest('full');
  setInterval(() => void runIngest('full'), FULL_HOURS * 3_600_000).unref();
  setInterval(() => void runIngest('news'), NEWS_MINUTES * 60_000).unref();
  log(`scheduler: full ingest every ${FULL_HOURS}h, news every ${NEWS_MINUTES}m${hasSnapshot ? '' : '; first full ingest started'}`);
}

// ------------------------------------------------ http

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const p = url.pathname;

  if (p === '/api/feedback' && req.method === 'POST') return handleFeedback(req, res);
  if (p === '/api/health') {
    const ready = fs.existsSync(path.join(paths.data, 'snapshot.json'));
    return json(res, ready ? 200 : 503, { ok: ready, ingest: running });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });

  if (p.startsWith('/data/')) {
    const file = safeJoin(paths.data, p.slice('/data/'.length));
    if (!file) return json(res, 400, { error: 'Bad path' });
    // Snapshot files change in place when the ingest republishes; let browsers revalidate.
    return sendFile(req, res, file, 'no-cache');
  }

  const file = safeJoin(WEB, p === '/' ? 'index.html' : p.slice(1));
  if (!file) return json(res, 400, { error: 'Bad path' });
  const immutable = p.startsWith('/assets/');
  // Unknown paths get the app shell; the app routes with the URL hash.
  const target = fs.existsSync(file) ? file : path.join(WEB, 'index.html');
  return sendFile(req, res, target, immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
});

server.listen(PORT, () => {
  log(`Firewatch listening on http://localhost:${PORT} (data: ${paths.data})`);
  if (SCHEDULER) startScheduler();
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.close(() => process.exit(0)));
