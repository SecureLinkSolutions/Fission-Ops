import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findCves, findTechniques } from '../shared/platforms.ts';
import type { NewsItem } from '../shared/types.ts';
import { clusterStories, parseFeed } from '../ingest/news.ts';
import { productOf } from '../ingest/products.ts';
import { parseCsv } from '../ingest/vuln.ts';
import { techniqueGaps } from '../web/src/lib/format.ts';

test('findCves normalises the spellings rule authors use', () => {
  assert.deepEqual(findCves('cve.2021-44228 and CVE_2023_27350, also CVE-2024-21887').sort(), ['CVE-2021-44228', 'CVE-2023-27350', 'CVE-2024-21887']);
  assert.deepEqual(findCves('no ids here'), []);
});

test('findTechniques keeps sub-techniques and ignores lookalikes', () => {
  assert.deepEqual(findTechniques('attack.t1059.001 attack.t1190 T1037/001 ST12345').sort(), ['T1037.001', 'T1059.001', 'T1190']);
});

test('parseCsv handles quoted commas, quotes, and newlines', () => {
  const rows = parseCsv('id,description,codes\n1,"Foo, ""bar"" - RCE",CVE-2021-44228;OSVDB-1\n2,"multi\nline",\n');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], ['1', 'Foo, "bar" - RCE', 'CVE-2021-44228;OSVDB-1']);
  assert.equal(rows[2][1], 'multi\nline');
});

test('parseFeed reads RSS 2.0', () => {
  const items = parseFeed(`<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
    <item><title>Ivanti &amp; friends patch CVE-2024-21887</title><link>https://example.com/a</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Exploited <b>now</b></p>]]></description></item>
  </channel></rss>`);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Ivanti & friends patch CVE-2024-21887');
  assert.equal(items[0].url, 'https://example.com/a');
  assert.equal(items[0].date, '2026-10-19T10:00:00.000Z');
  assert.match(items[0].body, /Exploited now/);
});

test('parseFeed reads Atom with alternate links', () => {
  const items = parseFeed(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry><title>Research post</title><link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/post"/><updated>2026-10-18T08:30:00Z</updated></entry>
  </feed>`);
  assert.equal(items[0].url, 'https://example.com/post');
  assert.equal(items[0].date, '2026-10-18T08:30:00.000Z');
});

test('parseFeed rejects non-feeds', () => {
  assert.throws(() => parseFeed('<html><body>nope</body></html>'));
});

const item = (id: string, feed: string, title: string, date: string, cves: string[] = []): NewsItem => ({
  id,
  feed,
  source: feed,
  type: 'news',
  title,
  url: `https://${feed}.example/${id}`,
  date,
  cves,
  story: null,
});

test('clusterStories groups the same event across publishers only', () => {
  const items = [
    item('a', 'bleeping', 'Ahold Delhaize cyberattack affects services across US and Europe', '2026-10-20T11:18:00Z'),
    item('b', 'record', 'Ahold Delhaize confirms cyberattack behind outages affecting services', '2026-10-19T16:45:00Z'),
    item('c', 'bleeping', 'Ahold Delhaize cyberattack update', '2026-10-20T12:00:00Z'),
    item('d', 'week', 'Hackers steal 1.8 million records from Nikkei', '2026-10-20T09:00:00Z'),
    item('e', 'thn', 'Patch now', '2026-10-20T09:00:00Z', ['CVE-2026-0322']),
    item('f', 'week', 'Unrelated headline', '2026-10-19T09:00:00Z', ['CVE-2026-0322']),
  ];
  const stories = clusterStories(items);
  assert.equal(stories.length, 2);
  const ahold = stories.find((s) => s.items.includes('a'))!;
  assert.ok(ahold.items.includes('b'));
  assert.ok(!ahold.items.includes('d'));
  assert.ok(stories.some((s) => s.items.includes('e') && s.items.includes('f')), 'shared CVE links stories');
});

test('productOf maps log sources to product families', () => {
  assert.equal(productOf('windows', null, 'process_creation'), 'Windows');
  assert.equal(productOf('aws', 'cloudtrail'), 'AWS');
  assert.equal(productOf('AzureActiveDirectory SigninLogs'), 'Microsoft Entra ID');
  assert.equal(productOf(''), null);
});

test('techniqueGaps rolls sub-techniques up to their parent', () => {
  const coverage = {
    'T1037.001': { sigma: 2, splunk: 5 },
    T1037: { elastic: 3 },
    T1530: { splunk: 4, sentinel: 7 },
    T1190: { sigma: 1 },
  };
  const gaps = techniqueGaps(coverage, 'sigma');
  assert.deepEqual(gaps.map((g) => g.id), ['T1530']);
  assert.equal(gaps[0].elsewhere, 11);
  assert.deepEqual(techniqueGaps(coverage, 'suricata'), [], 'non-SIEM platforms have no technique gaps');
});
