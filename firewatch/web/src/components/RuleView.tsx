import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLATFORM_BY_ID } from '../../../shared/platforms.ts';
import type { AttackFile, Rule } from '../../../shared/types.ts';
import { fmtDate } from '../lib/format.ts';
import { Badge, CopyButton, Ext } from './ui.tsx';

export function TechniqueChips({ ids, attack }: { ids: string[]; attack: AttackFile | null }) {
  if (!ids.length) return null;
  return (
    <span className="chips">
      {ids.map((t) => (
        <Link key={t} to={`/library?technique=${t}`} className="chip mono" title={attack?.techniques[t]?.name ?? 'Not in the current ATT&CK release'}>
          {t}
          {attack?.techniques[t] ? ` ${attack.techniques[t].name}` : ' (retired)'}
        </Link>
      ))}
    </span>
  );
}

export function RuleMetaLine({ rule }: { rule: Pick<Rule, 'kind' | 'severity' | 'status' | 'product' | 'updated'> }) {
  return (
    <span className="rule-meta">
      <span>{rule.kind}</span>
      {rule.severity && <Badge tone={/critical|high/.test(rule.severity) ? 'bad' : /medium/.test(rule.severity) ? 'warn' : 'neutral'}>{rule.severity}</Badge>}
      {rule.status && <span className="muted">{rule.status}</span>}
      {rule.product && <span className="muted">{rule.product}</span>}
      {rule.updated && <span className="muted">updated {fmtDate(rule.updated)}</span>}
    </span>
  );
}

/** A published rule, shown verbatim with its source and licence. */
export function RuleView({ rule, attack, collapsed = false }: { rule: Rule; attack: AttackFile | null; collapsed?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  const p = PLATFORM_BY_ID[rule.platform];
  return (
    <article className="rule">
      <header>
        <h4>
          {p.inLibrary ? <Link to={`/rule/${rule.platform}/${encodeURIComponent(rule.id)}`}>{rule.title}</Link> : rule.title}
        </h4>
        <RuleMetaLine rule={rule} />
      </header>
      {rule.description && <p className="rule-desc">{rule.description}</p>}
      <TechniqueChips ids={rule.techniques} attack={attack} />
      <div className="rule-actions">
        <button type="button" className="btn btn-small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide' : 'Show'} {p.language}
        </button>
        <CopyButton text={rule.query} label="Copy query" />
        <Ext href={rule.url}>Source: {rule.path || p.name}</Ext>
      </div>
      {open && (
        <pre className="code" tabIndex={0} aria-label={`${rule.title} (${rule.language})`}>
          <code>{rule.query || '(no query text published)'}</code>
        </pre>
      )}
      {rule.references.length > 0 && open && (
        <details className="refs">
          <summary>References ({rule.references.length})</summary>
          <ul>
            {rule.references.map((r) => (
              <li key={r}>
                {/^https?:/.test(r) ? <Ext href={r}>{r}</Ext> : r}
              </li>
            ))}
          </ul>
        </details>
      )}
      {rule.author && <p className="muted small">Author: {rule.author}</p>}
    </article>
  );
}
