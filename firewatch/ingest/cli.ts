import { resolvePaths, runFull, runNewsOnly } from './build.ts';
import { errMsg, log } from './util.ts';

const paths = resolvePaths();
const newsOnly = process.argv.includes('--news-only');

try {
  if (newsOnly) await runNewsOnly(paths);
  else await runFull(paths);
} catch (err) {
  // Nothing is published on failure: the previous snapshot stays live.
  log(`ingest failed: ${errMsg(err)}`);
  process.exitCode = 1;
}
