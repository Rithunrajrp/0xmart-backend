import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    this.logger.log(
      `API Key Guard - Headers: ${JSON.stringify(Object.keys(request.headers))}`,
    );
    this.logger.log(
      `API Key Guard - x-api-key: ${apiKey ? apiKey.substring(0, 12) + '...' : 'MISSING'}`,
    );

    if (!apiKey) {
      throw new UnauthorizedException({
        error: 'Unauthorized',
        message: 'API key is required. Please provide X-API-Key header.',
      });
    }

    try {
      // Validate API key and get associated user/key info
      const keyData = await this.apiKeysService.validateApiKey(apiKey);

      if (!keyData) {
        this.logger.error(
          `API key validation failed for prefix: ${apiKey.substring(0, 10)}`,
        );
        throw new UnauthorizedException({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      }

      this.logger.log(
        `API key validated successfully for user: ${keyData.userId}`,
      );

      // Check rate limit
      const rateLimit = await this.apiKeysService.checkRateLimit(
        keyData.apiKeyId,
      );
      if (!rateLimit.allowed) {
        throw new UnauthorizedException({
          error: 'Rate Limit Exceeded',
          message: `Rate limit exceeded. Try again after ${rateLimit.resetAt.toISOString()}`,
          retryAfter: Math.ceil(
            (rateLimit.resetAt.getTime() - Date.now()) / 1000,
          ),
        });
      }

      // Add rate limit headers to response
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-RateLimit-Limit', rateLimit.limit);
      response.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
      response.setHeader('X-RateLimit-Reset', rateLimit.resetAt.toISOString());

      // Attach user and API key info to request
      request.user = {
        id: keyData.userId,
        apiKeyId: keyData.apiKeyId,
      };

      // Log usage asynchronously (fire and forget)
      this.apiKeysService
        .logUsage({
          apiKeyId: keyData.apiKeyId,
          endpoint: request.path,
          method: request.method,
          statusCode: 200,
          responseTimeMs: 0,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        })
        .catch((err) => {
          this.logger.error(`Failed to log API usage: ${err.message}`);
        });

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`API key validation error: ${error.message}`);
      throw new UnauthorizedException({
        error: 'Unauthorized',
        message: 'API key validation failed',
      });
    }
  }
}
