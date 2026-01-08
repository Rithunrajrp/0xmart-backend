import { SetMetadata } from '@nestjs/common';

export const RECAPTCHA_ACTION_KEY = 'recaptcha_action';

/**
 * Decorator to mark endpoints that require reCAPTCHA validation
 * @param action - The action name to validate (e.g., 'LOGIN', 'SIGNUP')
 *
 * Usage:
 * @Recaptcha('LOGIN')
 * @Post('login')
 * async login(@Body() dto: LoginDto) { ... }
 */
export const Recaptcha = (action: string) =>
  SetMetadata(RECAPTCHA_ACTION_KEY, action);
