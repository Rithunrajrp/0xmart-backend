import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterService } from '../../modules/redis/rate-limiter.service';

/**
 * SEC-BE-005 FIX: Rate Limiting Guard
 *
 * Protects endpoints from abuse by limiting requests per identifier (IP, user, etc.)
 * Uses Redis-based distributed rate limiting for production safety.
 */

export interface RateLimitOptions {
  /**
   * Maximum number of requests
   */
  limit: number;

  /**
   * Time window in seconds
   */
  ttl: number;

  /**
   * What to use as identifier
   * - 'ip': Client IP address
   * - 'user': Authenticated user ID
   * - 'custom': Use custom key from request body field
   */
  keyType?: 'ip' | 'user' | 'custom';

  /**
   * If keyType is 'custom', which field to use from request body
   */
  customKeyField?: string;

  /**
   * Error message when rate limit exceeded
   */
  message?: string;
}

export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Decorator to set rate limit options on a route
 *
 * @example
 * ```typescript
 * @RateLimit({ limit: 3, ttl: 3600, keyType: 'custom', customKeyField: 'identifier' })
 * @Post('send-otp')
 * async sendOtp(@Body() dto: SendOtpDto) {
 *   // ...
 * }
 * ```
 */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private reflector: Reflector,
    private rateLimiterService: RateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) {
      // No rate limit configured for this endpoint
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const key = this.getIdentifier(request, options);

    if (!key) {
      this.logger.warn('Could not determine rate limit identifier');
      return true; // Allow if we can't identify
    }

    const result = await this.rateLimiterService.checkRateLimit(
      key,
      options.limit,
      options.ttl,
    );

    if (!result.allowed) {
      const message =
        options.message ||
        `Too many requests. Please try again in ${Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)} seconds.`;

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message,
          error: 'Too Many Requests',
          limit: result.limit,
          remaining: result.remaining,
          resetAt: result.resetAt,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add rate limit headers to response
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', result.resetAt.getTime());

    return true;
  }

  private getIdentifier(request: any, options: RateLimitOptions): string {
    switch (options.keyType) {
      case 'ip':
        return `ip:${this.getClientIp(request)}`;

      case 'user':
        if (request.user?.id) {
          return `user:${request.user.id}`;
        }
        // Fallback to IP if not authenticated
        return `ip:${this.getClientIp(request)}`;

      case 'custom':
        if (options.customKeyField && request.body?.[options.customKeyField]) {
          const value = request.body[options.customKeyField];
          return `${options.customKeyField}:${value}`;
        }
        // Fallback to IP if custom field not found
        return `ip:${this.getClientIp(request)}`;

      default:
        return `ip:${this.getClientIp(request)}`;
    }
  }

  private getClientIp(request: any): string {
    // Check various headers for real IP (in case behind proxy)
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
}
