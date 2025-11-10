import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WithdrawalProcessorService } from './withdrawal-processor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('withdrawal-processor')
@ApiBearerAuth()
@Controller('withdrawal-processor')
export class WithdrawalProcessorController {
  constructor(
    private readonly withdrawalProcessorService: WithdrawalProcessorService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('pending')
  @ApiOperation({ summary: 'Get pending withdrawals (Admin only)' })
  @ApiResponse({ status: 200 })
  async getPendingWithdrawals() {
    return this.withdrawalProcessorService.getPendingWithdrawals();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('process')
  @ApiOperation({
    summary: 'Manually trigger withdrawal processing (Admin only)',
  })
  @ApiResponse({ status: 200 })
  async manualProcess() {
    return this.withdrawalProcessorService.manualProcess();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve withdrawal (Admin only)' })
  @ApiResponse({ status: 200 })
  async approveWithdrawal(@Param('id') id: string, @CurrentUser() admin: any) {
    return this.withdrawalProcessorService.approveWithdrawal(
      id,
      admin.id as string,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject withdrawal (Admin only)' })
  @ApiResponse({ status: 200 })
  async rejectWithdrawal(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() admin: any,
  ) {
    return this.withdrawalProcessorService.rejectWithdrawal(
      id,
      admin.id as string,
      body.reason,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/:txHash')
  @ApiOperation({ summary: 'Get withdrawal status by transaction hash' })
  @ApiResponse({ status: 200 })
  async getWithdrawalStatus(@Param('txHash') txHash: string) {
    return this.withdrawalProcessorService.getWithdrawalStatus(txHash);
  }
}
