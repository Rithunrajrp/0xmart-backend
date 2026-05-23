import { UserRole } from '@prisma/client';

/**
 * Authenticated user payload extracted from JWT token
 * Used in @CurrentUser() decorator across all authenticated endpoints
 */
export interface AuthenticatedUser {
  /** User's unique identifier */
  id: string;

  /** User's email address */
  email: string;

  /** User's role in the system */
  role: UserRole;

  /** KYC verification status (optional) */
  kycStatus?: string;

  /** User account status (optional) */
  status?: string;

  /** JWT token subject (typically same as id) */
  sub?: string;

  /** Token issued at timestamp */
  iat?: number;

  /** Token expiration timestamp */
  exp?: number;
}
