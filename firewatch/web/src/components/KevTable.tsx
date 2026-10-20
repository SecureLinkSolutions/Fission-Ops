import { PLATFORM_BY_ID } from '../../../shared/platforms.ts';
import type { KevEntry, PlatformId } from '../../../shared/types.ts';
import { fmtDate } from '../lib/format.ts';
import { Badge, CveLink, Epss, FindTags, RuleChips } from './ui.tsx';

interface Props {
  entries: KevEntry[];
  platform: PlatformId;
  caption: string;
  showAdded?: boolean;
  showDue?: boolean;
  isNew?: (cve: string) => boolean;
}

export function KevTable({ entries, platform, caption, showAdded, showDue, isNew }: Props) {
  const p = PLATFORM_BY_ID[platform];
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">CVE</th>
            <th scope="col">Vendor and product</th>
            {showAdded && <th scope="col">Added</th>}
            {showDue && <th scope="col">Federal due</th>}
            <th scope="col">EPSS</th>
            <th scope="col">How to find</th>
            <th scope="col">{p.name} rules</th>
            <th scope="col">Other platforms</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.cve}>
              <th scope="row">
                <CveLink id={e.cve} />
                {isNew?.(e.cve) && (
                  <>
                    {' '}
                    <Badge tone="info">New</Badge>
                  </>
                )}
              </th>
              <td>
                <span className="vendor">{e.vendor}</span>
                <span className="product">{e.product}</span>
                <span className="row-badges">
                  {e.ransomware && <Badge tone="bad" title="CISA lists known use in ransomware campaigns">Known ransomware use</Badge>}
                  {e.triage && <Badge tone="warn" title="CISA requires forensic triage for affected federal systems">Forensic triage</Badge>}
                </span>
              </td>
              {showAdded && <td className="nowrap">{fmtDate(e.added)}</td>}
              {showDue && <td className="nowrap">{fmtDate(e.due)}</td>}
              <td>
                <Epss e={e.epss} p={e.pct} />
              </td>
              <td>
                <FindTags tags={e.find} />
              </td>
              <td className="num">{e.rules[platform] ? <span className="chip chip-mine">{e.rules[platform]}</span> : <span className="muted">—</span>}</td>
              <td>
                <RuleChips entry={e} exclude={platform} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
