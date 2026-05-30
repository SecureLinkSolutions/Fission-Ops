import { checkSchema } from './db/checkSchema';
import './server';

async function main() {
  await checkSchema();
  console.log('🚀 Fission Ops backend started');
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
