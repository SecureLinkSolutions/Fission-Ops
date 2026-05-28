import { config } from './config';
import { checkSchema } from './db/checkSchema';
import app from './app';

async function main() {
  await checkSchema();
  app.listen(config.PORT, () => {
    console.log(`🚀 Fission Ops backend running on port ${config.PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
