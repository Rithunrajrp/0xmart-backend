import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DepositMonitorService } from './deposit-monitor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TransactionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('deposit-monitor')
@Controller('deposit-monitor')
export class DepositMonitorController {
  constructor(
    private readonly depositMonitorService: DepositMonitorService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('scan')
  @ApiOperation({ summary: 'Manually trigger deposit scan (Admin only)' })
  @ApiResponse({ status: 200 })
  async manualScan() {
    return this.depositMonitorService.manualScan();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('status/:txHash')
  @ApiOperation({ summary: 'Get deposit status by transaction hash' })
  @ApiResponse({ status: 200 })
  async getDepositStatus(@Param('txHash') txHash: string) {
    return this.depositMonitorService.getDepositStatus(txHash);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('pending')
  @ApiOperation({ summary: 'Get all pending deposits (Admin only)' })
  @ApiResponse({ status: 200 })
  async getPendingDeposits() {
    const deposits = await this.prisma.deposit.findMany({
      where: { status: TransactionStatus.PENDING },
      include: {
        wallet: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return deposits.map((d) => ({
      id: d.id,
      txHash: d.txHash,
      amount: d.amount.toString(),
      stablecoinType: d.wallet.stablecoinType,
      network: d.network,
      confirmations: d.confirmations,
      requiredConfirmations: d.requiredConfirms,
      userEmail: d.wallet.user.email,
      createdAt: d.createdAt,
    }));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('user/deposits')
  @ApiOperation({ summary: 'Get user deposit history' })
  @ApiResponse({ status: 200 })
  async getUserDeposits(@CurrentUser() user: any) {
    const deposits = await this.prisma.deposit.findMany({
      where: {
        wallet: {
          userId: user.id,
        },
      },
      include: {
        wallet: {
          select: {
            stablecoinType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return deposits.map((d) => ({
      id: d.id,
      txHash: d.txHash,
      amount: d.amount.toString(),
      stablecoinType: d.wallet.stablecoinType,
      network: d.network,
      confirmations: d.confirmations,
      requiredConfirmations: d.requiredConfirms,
      status: d.status,
      createdAt: d.createdAt,
      confirmedAt: d.confirmedAt,
    }));
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check for deposit monitor' })
  async healthCheck() {
    const lastScan = await this.prisma.deposit.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    return {
      status: 'healthy',
      lastScanAt: lastScan?.createdAt,
      isMonitoring: true,
    };
  }
}
