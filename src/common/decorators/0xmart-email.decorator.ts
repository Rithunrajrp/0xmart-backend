import { SetMetadata } from '@nestjs/common';

export const REQUIRE_0XMART_EMAIL_KEY = 'require0xmartEmail';

/**
 * Decorator to enforce @0xmart.com email domain for admin/superadmin routes
 */
export const Require0xMartEmail = () =>
  SetMetadata(REQUIRE_0XMART_EMAIL_KEY, true);

/**
 * Utility function to validate if email is from 0xmart.com domain
 */
export function is0xMartEmail(email: string): boolean {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  return normalizedEmail.endsWith('@0xmart.com');
}
