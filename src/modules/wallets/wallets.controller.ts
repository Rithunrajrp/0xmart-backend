import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { TransferOutDto } from './dto/transfer-out.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WalletEntity } from './entities/wallet.entity';

@ApiTags('wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new wallet for stablecoin' })
  @ApiResponse({ status: 201, type: WalletEntity })
  async createWallet(
    @CurrentUser() user: any,
    @Body() createWalletDto: CreateWalletDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.walletsService.createWallet(user.id, createWalletDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user wallets' })
  @ApiResponse({ status: 200, type: [WalletEntity] })
  async getUserWallets(@CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.walletsService.getUserWallets(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get wallet by ID' })
  @ApiResponse({ status: 200, type: WalletEntity })
  async getWallet(@Param('id') id: string, @CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.walletsService.getWallet(id, user.id);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get wallet transactions history' })
  @ApiResponse({ status: 200 })
  async getWalletTransactions(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.walletsService.getWalletTransactions(id, user.id);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw stablecoin to external address' })
  @ApiResponse({ status: 201 })
  async withdraw(
    @CurrentUser() user: any,
    @Body() transferOutDto: TransferOutDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.walletsService.initiateWithdrawal(user.id, transferOutDto);
  }
}
