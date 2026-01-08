import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RecaptchaService } from '../services/recaptcha.service';
import { RECAPTCHA_ACTION_KEY } from '../decorators/recaptcha.decorator';

/**
 * Guard to validate reCAPTCHA tokens
 *
 * Expects the frontend to send the reCAPTCHA token in the request body as:
 * {
 *   recaptchaToken: "token_from_grecaptcha.execute()"
 * }
 */
@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private recaptchaService: RecaptchaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<string>(
      RECAPTCHA_ACTION_KEY,
      context.getHandler(),
    );

    // If no @Recaptcha decorator, skip validation
    if (!action) {
      return true;
    }

    // If reCAPTCHA is disabled in config, skip validation
    if (!this.recaptchaService.isEnabled()) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const recaptchaToken = request.body?.recaptchaToken;

    if (!recaptchaToken) {
      throw new BadRequestException(
        'reCAPTCHA token is required for this action',
      );
    }

    // Validate the token
    const result = await this.recaptchaService.verifyToken(
      recaptchaToken,
      action as any,
      action,
    );

    if (!result.success) {
      throw new BadRequestException(
        result.message ||
          'reCAPTCHA validation failed. Please try again or contact support.',
      );
    }

    // Attach score to request for potential logging
    request.recaptchaScore = result.score;

    return true;
  }
}
