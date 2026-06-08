export const STANDARD_MIN = 15;
export const PLATFORM_ADMIN_MIN = 32;

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string, role?: string): PasswordValidation {
  const errors: string[] = [];

  if (role === 'platform_admin') {
    if (password.length < PLATFORM_ADMIN_MIN)
      errors.push(`At least ${PLATFORM_ADMIN_MIN} characters`);
    if (!/[a-zA-Z]/.test(password))
      errors.push('At least one letter');
    if (!/[0-9]/.test(password))
      errors.push('At least one number');
    if (!/[^a-zA-Z0-9]/.test(password))
      errors.push('At least one symbol');
  } else {
    if (password.length < STANDARD_MIN)
      errors.push(`At least ${STANDARD_MIN} characters`);
  }

  return { valid: errors.length === 0, errors };
}

export function policyHint(role?: string): string {
  return role === 'platform_admin'
    ? `Min ${PLATFORM_ADMIN_MIN} chars with letters, numbers, and symbols`
    : `Min ${STANDARD_MIN} characters`;
}
