import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OIDC_AZURE_CLIENT_ID: z.string().optional(),
  OIDC_AZURE_CLIENT_SECRET: z.string().optional(),
  OIDC_AZURE_TENANT_ID: z.string().optional(),
  OIDC_OKTA_CLIENT_ID: z.string().optional(),
  OIDC_OKTA_CLIENT_SECRET: z.string().optional(),
  OIDC_OKTA_DOMAIN: z.string().optional(),
  SSO_REDIRECT_BASE_URL: z.string().default('http://localhost:3001'),
  DOMAIN: z.string().optional(),
  SSL_EMAIL: z.string().email().optional(),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().default(100),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
