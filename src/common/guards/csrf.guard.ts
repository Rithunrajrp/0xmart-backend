import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

/**
 * CSRF Guard for JWT-based API
 *
 * Implements double-submit cookie pattern for CSRF protection.
 * Suitable for stateless JWT authentication where session cookies aren't used.
 *
 * How it works:
 * 1. Server sets a random CSRF token in a cookie
 * 2. Client reads cookie and sends same token in X-CSRF-Token header
 * 3. Server validates cookie matches header before processing request
 *
 * Protection mechanism:
 * - Attacker can't read cookies cross-origin (Same-Origin Policy)
 * - Attacker can't set custom headers cross-origin (CORS)
 * - Therefore, attacker can't forge valid CSRF requests
 *
 * Applied to: POST, PUT, PATCH, DELETE requests
 * Exempt: GET, HEAD, OPTIONS, @Public() endpoints, webhook endpoints
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly CSRF_COOKIE_NAME = 'XSRF-TOKEN';
  private readonly CSRF_HEADER_NAME = 'x-csrf-token';
  private readonly CSRF_TOKEN_LENGTH = 32;

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method.toUpperCase();

    // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      // Ensure CSRF token cookie exists for future requests
      this.ensureCsrfCookie(request, response);
      return true;
    }

    // Check if endpoint is marked as @Public() (webhooks, public APIs)
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.debug(`CSRF check skipped for public endpoint: ${request.url}`);
      return true;
    }

    // Check if endpoint is webhook (additional safety)
    if (this.isWebhookEndpoint(request.url)) {
      this.logger.debug(`CSRF check skipped for webhook: ${request.url}`);
      return true;
    }

    // Validate CSRF token for state-changing operations
    const csrfCookie = request.cookies?.[this.CSRF_COOKIE_NAME];
    const csrfHeader =
      request.headers[this.CSRF_HEADER_NAME] ||
      request.headers[this.CSRF_HEADER_NAME.toLowerCase()];

    if (!csrfCookie) {
      this.logger.warn(`CSRF cookie missing for ${method} ${request.url}`);
      throw new ForbiddenException('CSRF token missing in cookie');
    }

    if (!csrfHeader) {
      this.logger.warn(`CSRF header missing for ${method} ${request.url}`);
      throw new ForbiddenException('CSRF token missing in header');
    }

    // Use timing-safe comparison to prevent timing attacks
    if (!this.timingSafeEqual(csrfCookie, csrfHeader as string)) {
      this.logger.warn(
        `CSRF token mismatch for ${method} ${request.url} - Possible CSRF attack`,
      );
      throw new ForbiddenException('CSRF token validation failed');
    }

    this.logger.debug(`CSRF validation passed for ${method} ${request.url}`);
    return true;
  }

  /**
   * Ensures CSRF cookie exists, creates one if missing
   */
  private ensureCsrfCookie(request: Request, response: Response): void {
    if (!request.cookies?.[this.CSRF_COOKIE_NAME]) {
      const token = this.generateCsrfToken();
      response.cookie(this.CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict', // Prevent cross-site sending
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      });
      this.logger.debug('Created new CSRF token cookie');
    }
  }

  /**
   * Generates a cryptographically secure random CSRF token
   */
  private generateCsrfToken(): string {
    return crypto.randomBytes(this.CSRF_TOKEN_LENGTH).toString('hex');
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    return crypto.timingSafeEqual(bufferA, bufferB);
  }

  /**
   * Checks if URL is a webhook endpoint that should skip CSRF
   */
  private isWebhookEndpoint(url: string): boolean {
    const webhookPatterns = [
      '/webhook',
      '/stripe/webhook',
      '/razorpay/webhook',
      '/sumsub/webhook',
    ];

    return webhookPatterns.some((pattern) => url.includes(pattern));
  }
}
