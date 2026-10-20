import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PLATFORM_BY_ID } from '../../../shared/platforms.ts';
import type { PlatformId, Rule, RuleBody } from '../../../shared/types.ts';
import { RuleView } from '../components/RuleView.tsx';
import { Empty, LoadError, Loading, Page, Section } from '../components/ui.tsx';
import { loadRuleBody, useAttack, useLibrary, useSnapshot } from '../lib/data.ts';

export function RuleDetail() {
  const { platform = '', id = '' } = useParams();
  const ruleId = decodeURIComponent(id);
  const p = PLATFORM_BY_ID[platform as PlatformId];
  const { data: lib, error } = useLibrary(p ? (platform as PlatformId) : null);
  const { data: attack } = useAttack();
  const { data: snap } = useSnapshot();
  const [body, setBody] = useState<RuleBody | null | undefined>(undefined);

  useEffect(() => {
    if (!p) return;
    let live = true;
    loadRuleBody(platform as PlatformId, ruleId).then(
      (b) => live && setBody(b),
      () => live && setBody(null),
    );
    return () => {
      live = false;
    };
  }, [p, platform, ruleId]);

  if (!p) return <Page title="Rule not found"><Empty>Unknown platform.</Empty></Page>;
  if (error) return <Page title="Rule"><LoadError error={error} /></Page>;
  if (!lib || body === undefined) return <Page title="Rule"><Loading what="the rule" /></Page>;
  const meta = lib.find((r) => r.id === ruleId);
  if (!meta || !body) {
    return (
      <Page title="Rule not found">
        <Empty>
          This rule is not in the current snapshot; its publisher may have removed or renamed it. <Link to={`/library?platform=${platform}`}>Browse the {p.name} Library</Link>.
        </Empty>
      </Page>
    );
  }
  const rule: Rule = { ...meta, ...body };
  const source = snap?.sources.find((s) => s.id === platform);
  return (
    <Page title={rule.title} intro={`${p.name} · ${rule.kind}`}>
      <Section eyebrow="Published rule, shown verbatim" title="Rule" id="rule">
        <RuleView rule={rule} attack={attack} />
      </Section>
      {rule.cves.length > 0 && (
        <Section title="CVEs this rule names" id="cves">
          <ul className="chips">
            {rule.cves.map((c) => (
              <li key={c}>
                <Link to={`/cve/${c}`} className="chip mono">
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {source && (
        <p className="source-line">
          From {source.name}, {source.licence}. {source.attribution}. Firewatch does not modify, convert, or test published queries.
        </p>
      )}
    </Page>
  );
}
