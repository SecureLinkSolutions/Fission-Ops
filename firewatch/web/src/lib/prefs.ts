import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PLATFORM, PLATFORM_BY_ID } from '../../../shared/platforms.ts';
import type { PlatformId } from '../../../shared/types.ts';

// Everything here lives only in this browser. Storage can be unavailable
// (private windows, blocked site data), so every access is guarded and the
// app works with defaults when nothing can be saved.

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('fw-pref', { detail: key }));
  } catch {
    /* storage unavailable: keep the in-memory value */
  }
}

export function usePref<T>(key: string, fallback: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  useEffect(() => {
    const sync = (e: Event) => {
      const k = e instanceof StorageEvent ? e.key : (e as CustomEvent<string>).detail;
      if (k === key) setValue(read(key, fallback));
    };
    window.addEventListener('storage', sync);
    window.addEventListener('fw-pref', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('fw-pref', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        write(key, next);
        return next;
      });
    },
    [key],
  );
  return [value, set];
}

export function usePlatform(): [PlatformId, (p: PlatformId) => void] {
  const [p, set] = usePref<PlatformId>('fw.platform', DEFAULT_PLATFORM);
  return [PLATFORM_BY_ID[p] ? p : DEFAULT_PLATFORM, set];
}

export interface Watchlist {
  vendors: string[];
  /** "vendor|product" */
  products: string[];
  cves: string[];
}

export const EMPTY_WATCHLIST: Watchlist = { vendors: [], products: [], cves: [] };

export function useWatchlist() {
  return usePref<Watchlist>('fw.watchlist', EMPTY_WATCHLIST);
}

export function watchMatches(w: Watchlist, e: { cve: string; vendor: string; product: string }): boolean {
  const v = e.vendor.toLowerCase();
  return (
    w.cves.includes(e.cve) ||
    w.vendors.some((x) => x.toLowerCase() === v) ||
    w.products.some((x) => x.toLowerCase() === `${v}|${e.product.toLowerCase()}`)
  );
}

export function isWatchEmpty(w: Watchlist): boolean {
  return !w.vendors.length && !w.products.length && !w.cves.length;
}

export interface SeenState {
  enabled: boolean;
  markedAt: string | null;
  kev: string[];
  news: string[];
}

export function useSeen() {
  return usePref<SeenState>('fw.seen', { enabled: false, markedAt: null, kev: [], news: [] });
}

export type Theme = 'system' | 'light' | 'dark';

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = usePref<Theme>('fw.theme', 'system');
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return [theme, setTheme];
}
