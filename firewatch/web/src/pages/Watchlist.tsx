import { useMemo, useState } from 'react';
import { KevTable } from '../components/KevTable.tsx';
import { Empty, LoadError, Loading, Page, Section } from '../components/ui.tsx';
import { useKev } from '../lib/data.ts';
import { download, fmtNum } from '../lib/format.ts';
import { EMPTY_WATCHLIST, isWatchEmpty, usePlatform, useWatchlist, watchMatches, type Watchlist as WL } from '../lib/prefs.ts';

export function Watchlist() {
  const { data: kev, error } = useKev();
  const [watch, setWatch] = useWatchlist();
  const [platform] = usePlatform();
  const [vendor, setVendor] = useState('');
  const [product, setProduct] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const vendors = useMemo(() => [...new Set(kev?.map((e) => e.vendor) ?? [])].sort((a, b) => a.localeCompare(b)), [kev]);
  const products = useMemo(
    () => [...new Set(kev?.filter((e) => !vendor || e.vendor === vendor).map((e) => `${e.vendor}|${e.product}`) ?? [])].sort((a, b) => a.localeCompare(b)),
    [kev, vendor],
  );

  if (error) return <Page title="Watchlist"><LoadError error={error} /></Page>;
  if (!kev) return <Page title="Watchlist"><Loading /></Page>;

  const matches = kev.filter((e) => watchMatches(watch, e));
  const remove = (key: keyof WL, value: string) => setWatch((w) => ({ ...w, [key]: w[key].filter((x) => x !== value) }));

  return (
    <Page title="Watchlist" intro="Track the vendors, products, and CVEs you care about. Saved only in this browser; nothing is sent anywhere.">
      <Section title="Add to your watchlist" id="add">
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            if (product) setWatch((w) => ({ ...w, products: [...new Set([...w.products, product])] }));
            else if (vendor) setWatch((w) => ({ ...w, vendors: [...new Set([...w.vendors, vendor])] }));
            setProduct('');
          }}
        >
          <label>
            <span>Vendor</span>
            <input list="wl-vendors" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Ivanti" />
            <datalist id="wl-vendors">
              {vendors.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Product (optional)</span>
            <select value={product} onChange={(e) => setProduct(e.target.value)}>
              <option value="">Every product from this vendor</option>
              {products.map((p) => (
                <option key={p} value={p}>
                  {p.replace('|', ' · ')}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn" disabled={!vendor && !product}>
            Watch
          </button>
        </form>
        {isWatchEmpty(watch) ? (
          <Empty>Your watchlist is empty. Add a vendor or product above, or use “Watch this CVE” on any CVE page.</Empty>
        ) : (
          <div className="watch-groups">
            {(['vendors', 'products', 'cves'] as const).map((key) =>
              watch[key].length ? (
                <div key={key}>
                  <h3>{key === 'vendors' ? 'Vendors' : key === 'products' ? 'Products' : 'CVEs'}</h3>
                  <ul className="chips">
                    {watch[key].map((v) => (
                      <li key={v} className="chip">
                        {v.replace('|', ' · ')}{' '}
                        <button type="button" className="chip-remove" aria-label={`Stop watching ${v.replace('|', ' ')}`} onClick={() => remove(key, v)}>
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        )}
        <div className="row-actions">
          <button type="button" className="btn btn-small" onClick={() => download('firewatch-watchlist.json', JSON.stringify(watch, null, 2), 'application/json')}>
            Export
          </button>
          <label className="btn btn-small file-btn">
            Import
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const parsed = JSON.parse(await file.text()) as Partial<WL>;
                  const clean = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 500) : []);
                  setWatch({ vendors: clean(parsed.vendors), products: clean(parsed.products), cves: clean(parsed.cves) });
                  setImportError(null);
                } catch {
                  setImportError('That file is not a Firewatch watchlist export.');
                }
              }}
            />
          </label>
          {!isWatchEmpty(watch) && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setWatch(EMPTY_WATCHLIST)}>
              Clear watchlist
            </button>
          )}
        </div>
        {importError && <p className="notice notice-bad">{importError}</p>}
      </Section>
      <Section title="Matching KEV entries" id="matches" aside={<span className="count">{fmtNum(matches.length)}</span>}>
        {matches.length ? <KevTable entries={matches} platform={platform} caption="KEV entries matching your watchlist" showAdded showDue /> : <Empty>No KEV entries match your watchlist.</Empty>}
      </Section>
    </Page>
  );
}
