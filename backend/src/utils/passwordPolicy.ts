import { z } from 'zod';

// NIST SP 800-63B aligned password policy
// - No complexity requirements for standard users (length is the primary control)
// - Platform admins require length + character variety given their elevated privileges

const STANDARD_MIN = 15;
const PLATFORM_ADMIN_MIN = 32;

// Standard: 15-char minimum, no other restrictions (NIST 800-63B §5.1.1)
export const standardPasswordSchema = z
  .string()
  .min(STANDARD_MIN, `Password must be at least ${STANDARD_MIN} characters`);

// Platform admin: 32-char minimum with letters, numbers, and symbols
export const platformAdminPasswordSchema = z
  .string()
  .min(PLATFORM_ADMIN_MIN, `Platform admin password must be at least ${PLATFORM_ADMIN_MIN} characters`)
  .refine((p) => /[a-zA-Z]/.test(p), { message: 'Password must contain at least one letter' })
  .refine((p) => /[0-9]/.test(p), { message: 'Password must contain at least one number' })
  .refine((p) => /[^a-zA-Z0-9]/.test(p), { message: 'Password must contain at least one symbol' });

export function passwordSchemaForRole(role?: string) {
  return role === 'platform_admin' ? platformAdminPasswordSchema : standardPasswordSchema;
}

export const PASSWORD_POLICY_MESSAGE = `Minimum ${STANDARD_MIN} characters.`;
export const PLATFORM_ADMIN_POLICY_MESSAGE = `Minimum ${PLATFORM_ADMIN_MIN} characters with letters, numbers, and symbols.`;
