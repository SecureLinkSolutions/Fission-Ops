import { useEffect, useState } from 'react';
import type {
  AttackFile,
  CveDetail,
  HistoryPoint,
  KevEntry,
  NewsFile,
  PlatformId,
  RuleBody,
  RuleMeta,
  Snapshot,
  TechniqueCoverage,
  UpdatesFile,
} from '../../../shared/types.ts';

const RULE_BUCKETS = 32;

// Requests are shared across components and kept for the life of the page;
// a snapshot only changes when the ingest republishes, and a reload picks that up.
const cache = new Map<string, Promise<unknown>>();

export function load<T>(file: string): Promise<T> {
  let p = cache.get(file) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`data/${file}`).then((r) => {
      if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p;
}

export interface Loaded<T> {
  data: T | null;
  error: string | null;
}

export function useData<T>(file: string | null): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ data: null, error: null });
  useEffect(() => {
    if (!file) return;
    let live = true;
    setState({ data: null, error: null });
    load<T>(file).then(
      (data) => live && setState({ data, error: null }),
      (err: Error) => live && setState({ data: null, error: err.message }),
    );
    return () => {
      live = false;
    };
  }, [file]);
  return state;
}

export const useSnapshot = () => useData<Snapshot>('snapshot.json');
export const useKev = () => useData<KevEntry[]>('kev.json');
export const useAttack = () => useData<AttackFile>('attack.json');
export const useNews = () => useData<NewsFile>('news.json');
export const useHistory = () => useData<HistoryPoint[]>('history.json');
export const useUpdates = () => useData<UpdatesFile>('updates.json');
export const useCoverage = () => useData<TechniqueCoverage>('coverage.json');
export const useCve = (id: string) => useData<CveDetail>(`cve/${id.toUpperCase()}.json`);
export const useLibrary = (platform: PlatformId | null) => useData<RuleMeta[]>(platform ? `library/${platform}.json` : null);

function bucketOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % RULE_BUCKETS;
}

export async function loadRuleBody(platform: PlatformId, id: string): Promise<RuleBody | null> {
  const bucket = await load<Record<string, RuleBody>>(`rules/${platform}/${bucketOf(id)}.json`);
  return bucket[id] ?? null;
}

export function useMany<T>(files: string[]): Loaded<T[]> {
  const key = files.join('|');
  const [state, setState] = useState<Loaded<T[]>>({ data: null, error: null });
  useEffect(() => {
    let live = true;
    setState({ data: null, error: null });
    Promise.all(files.map((f) => load<T>(f))).then(
      (data) => live && setState({ data, error: null }),
      (err: Error) => live && setState({ data: null, error: err.message }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
