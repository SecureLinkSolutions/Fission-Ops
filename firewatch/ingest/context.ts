import path from 'node:path';
import type { SourceHealth } from '../shared/types.ts';
import { errMsg, log, readJson, writeJson } from './util.ts';

export interface Ctx {
  cacheDir: string;
  stateDir: string;
  now: Date;
  warnings: string[];
}

export interface SourceResult<T> {
  data: T;
  health: SourceHealth;
}

/**
 * Run a source and remember its result. If it fails, publish the last good
 * result marked as a fallback so one flaky upstream does not blank the site.
 * With no previous result, `empty` is used and the failure is a warning.
 */
export async function withFallback<T>(
  ctx: Ctx,
  base: Omit<SourceHealth, 'status' | 'note' | 'retrieved' | 'version' | 'published' | 'count'>,
  run: () => Promise<{ data: T; version: string | null; published: string | null; count: number }>,
  empty: T,
): Promise<SourceResult<T>> {
  const file = path.join(ctx.stateDir, 'lastgood', `${base.id}.json`);
  try {
    const r = await run();
    const health: SourceHealth = {
      ...base,
      version: r.version,
      published: r.published,
      retrieved: ctx.now.toISOString(),
      count: r.count,
      status: 'ok',
      note: null,
    };
    writeJson(file, { data: r.data, health });
    log(`ok   ${base.id}: ${r.count} ${base.countLabel}`);
    return { data: r.data, health };
  } catch (err) {
    const prev = readJson<SourceResult<T>>(file);
    const reason = errMsg(err).slice(0, 300);
    log(`FAIL ${base.id}: ${reason}`);
    if (prev) {
      ctx.warnings.push(`${base.name}: retrieval failed, kept the result from ${prev.health.retrieved}`);
      return { data: prev.data, health: { ...prev.health, ...base, status: 'fallback', note: reason } };
    }
    ctx.warnings.push(`${base.name}: retrieval failed and no earlier result exists`);
    return {
      data: empty,
      health: { ...base, version: null, published: null, retrieved: null, count: 0, status: 'failed', note: reason },
    };
  }
}
