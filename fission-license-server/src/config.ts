import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3002),
  ADMIN_API_KEY: z.string().min(16),
  LICENSE_PRIVATE_KEY_PATH: z.string().default('./keys/private.pem'),
  LICENSE_PUBLIC_KEY_PATH: z.string().default('./keys/public.pem'),
  NODE_ENV: z.string().default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
