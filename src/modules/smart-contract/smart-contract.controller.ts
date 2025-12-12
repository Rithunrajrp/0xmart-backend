import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { EvmListenerService } from './services/evm-listener.service';
import { SolanaListenerService } from './services/solana-listener.service';
import { ContractPaymentService } from './services/contract-payment.service';
import { NetworkType } from './constants/contract-addresses';
import {
  InitiateContractPaymentDto,
  InitiateBatchContractPaymentDto,
  CheckPaymentStatusDto,
  ContractPaymentResponseDto,
  PaymentStatusResponseDto,
} from './dto/initiate-contract-payment.dto';

@ApiTags('Smart Contract')
@Controller('smart-contract')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SmartContractController {
  constructor(
    private readonly evmListenerService: EvmListenerService,
    private readonly solanaListenerService: SolanaListenerService,
    private readonly contractPaymentService: ContractPaymentService,
  ) {}

  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get blockchain listener status' })
  @ApiResponse({
    status: 200,
    description: 'Listener status for all networks',
  })
  async getListenerStatus() {
    const [evmStatuses, solanaStatus] = await Promise.all([
      this.evmListenerService.getAllContractStatuses(),
      this.solanaListenerService.getConnectionStatus(),
    ]);

    return {
      evm: evmStatuses,
      solana: solanaStatus,
    };
  }

  @Get('status/evm')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get EVM contract status for specific network' })
  @ApiResponse({
    status: 200,
    description: 'Contract status for the specified network',
  })
  async getEvmContractStatus(@Query('network') network: NetworkType) {
    const status = await this.evmListenerService.getContractStatus(network);
    return {
      network,
      ...status,
    };
  }

  @Get('status/solana')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get Solana program connection status' })
  @ApiResponse({
    status: 200,
    description: 'Solana connection status',
  })
  async getSolanaStatus() {
    return this.solanaListenerService.getConnectionStatus();
  }

  @Get('solana/fetch-recent')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Manually fetch recent Solana transactions',
    description: 'Useful for catching up on missed events or testing',
  })
  @ApiResponse({
    status: 200,
    description: 'Number of transactions processed',
  })
  async fetchRecentSolanaTransactions(
    @Query('network') network: 'mainnet' | 'devnet' = 'devnet',
    @Query('limit') limit: number = 10,
  ) {
    const count = await this.solanaListenerService.fetchRecentTransactions(
      network,
      limit,
    );

    return {
      network,
      transactionsProcessed: count,
    };
  }

  // ========== Payment Endpoints ==========

  @Post('payment/initiate')
  @ApiOperation({
    summary: 'Initiate smart contract payment for single product',
    description:
      'Creates an order and returns contract interaction details for frontend',
  })
  @ApiResponse({
    status: 200,
    type: ContractPaymentResponseDto,
    description: 'Payment initiation successful, returns contract details',
  })
  async initiatePayment(
    @Body() dto: InitiateContractPaymentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.contractPaymentService.initiatePayment(user.id, dto);
  }

  @Post('payment/initiate-batch')
  @ApiOperation({
    summary: 'Initiate smart contract payment for multiple products (cart)',
    description:
      'Creates an order for shopping cart and returns contract interaction details',
  })
  @ApiResponse({
    status: 200,
    type: ContractPaymentResponseDto,
    description: 'Batch payment initiation successful',
  })
  async initiateBatchPayment(
    @Body() dto: InitiateBatchContractPaymentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.contractPaymentService.initiateBatchPayment(user.id, dto);
  }

  @Post('payment/status')
  @ApiOperation({
    summary: 'Check payment status',
    description:
      'Check if payment has been detected and confirmed on blockchain',
  })
  @ApiResponse({
    status: 200,
    type: PaymentStatusResponseDto,
    description: 'Payment status',
  })
  async checkPaymentStatus(@Body() dto: CheckPaymentStatusDto) {
    return this.contractPaymentService.checkPaymentStatus(dto.orderId);
  }

  @Get('payment/orders')
  @ApiOperation({
    summary: 'Get user contract payment orders',
    description:
      'Retrieve all smart contract orders for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of user orders',
  })
  async getUserOrders(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.contractPaymentService.getUserOrders(
      user.id,
      limit || 20,
      offset || 0,
    );
  }
}
