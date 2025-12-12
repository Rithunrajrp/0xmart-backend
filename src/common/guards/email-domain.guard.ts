import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_0XMART_EMAIL_KEY,
  is0xMartEmail,
} from '../decorators/0xmart-email.decorator';

@Injectable()
export class EmailDomainGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const require0xMartEmail = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_0XMART_EMAIL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!require0xMartEmail) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.email) {
      throw new ForbiddenException('User email is required');
    }

    if (!is0xMartEmail(user.email)) {
      throw new ForbiddenException(
        'Access denied. Only @0xmart.com email addresses are allowed.',
      );
    }

    return true;
  }
}
