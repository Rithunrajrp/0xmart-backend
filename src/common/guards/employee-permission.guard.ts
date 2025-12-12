import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Decorator to specify required employee permissions
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

@Injectable()
export class EmployeePermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Super admins have all permissions
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Check if user is an employee
    if (user.role !== UserRole.EMPLOYEE) {
      throw new ForbiddenException('Employee access required');
    }

    // Fetch employee record with permissions
    const employee = await this.prisma.employee.findUnique({
      where: { userId: user.id },
    });

    if (!employee || !employee.isActive) {
      throw new ForbiddenException('Employee account is inactive');
    }

    // Check if employee has required permissions
    const employeePermissions = employee.permissions as string[];
    const hasPermission = requiredPermissions.every((permission) =>
      employeePermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    // Attach employee info to request for later use
    request.employee = employee;

    return true;
  }
}
