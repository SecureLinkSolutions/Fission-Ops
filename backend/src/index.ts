import { checkSchema } from './db/checkSchema';
import { runStartupValidation } from './services/licenseService';
import './server';

async function main() {
  await checkSchema();
  await runStartupValidation();
  console.log('🚀 Fission Ops backend started');
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
