import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface LogActivityParams {
  employeeId: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class EmployeeActivityService {
  private readonly logger = new Logger(EmployeeActivityService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Log an employee activity
   */
  async logActivity(params: LogActivityParams) {
    try {
      const activity = await this.prisma.employeeActivity.create({
        data: {
          employeeId: params.employeeId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          description: params.description,
          metadata: params.metadata || {},
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });

      this.logger.log(
        `Activity logged: ${params.action} on ${params.entityType}:${params.entityId} by employee ${params.employeeId}`,
      );

      return activity;
    } catch (error) {
      this.logger.error('Failed to log employee activity', error.stack);
      // Don't throw error - logging failure shouldn't break the main operation
    }
  }

  /**
   * Get activities for a specific employee
   */
  async getEmployeeActivities(
    employeeId: string,
    options?: {
      skip?: number;
      take?: number;
      action?: string;
      entityType?: string;
    },
  ) {
    const where: any = { employeeId };

    if (options?.action) {
      where.action = options.action;
    }

    if (options?.entityType) {
      where.entityType = options.entityType;
    }

    const [activities, total] = await Promise.all([
      this.prisma.employeeActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options?.skip || 0,
        take: options?.take || 50,
        include: {
          employee: {
            include: {
              user: {
                select: {
                  email: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.employeeActivity.count({ where }),
    ]);

    return {
      activities,
      total,
      hasMore: (options?.skip || 0) + activities.length < total,
    };
  }

  /**
   * Get all recent activities across all employees
   */
  async getRecentActivities(options?: { skip?: number; take?: number }) {
    return this.prisma.employeeActivity.findMany({
      orderBy: { createdAt: 'desc' },
      skip: options?.skip || 0,
      take: options?.take || 100,
      include: {
        employee: {
          include: {
            user: {
              select: {
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get activity statistics for an employee
   */
  async getEmployeeStats(employeeId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const activities = await this.prisma.employeeActivity.findMany({
      where: {
        employeeId,
        createdAt: { gte: since },
      },
      select: {
        action: true,
        entityType: true,
      },
    });

    // Count by action
    const actionCounts = activities.reduce(
      (acc, activity) => {
        acc[activity.action] = (acc[activity.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Count by entity type
    const entityCounts = activities.reduce(
      (acc, activity) => {
        acc[activity.entityType] = (acc[activity.entityType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalActivities: activities.length,
      actionCounts,
      entityCounts,
      period: `Last ${days} days`,
    };
  }

  /**
   * Search activities by description or metadata
   */
  async searchActivities(
    query: string,
    options?: { skip?: number; take?: number },
  ) {
    return this.prisma.employeeActivity.findMany({
      where: {
        OR: [
          { description: { contains: query, mode: 'insensitive' } },
          { action: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip: options?.skip || 0,
      take: options?.take || 50,
      include: {
        employee: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });
  }
}
