import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { WalletsModule } from '../wallets/wallets.module';
import { RewardsModule } from '../rewards/rewards.module';
import { UserManagementModule } from '../user-management/user-management.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WalletsModule, RewardsModule, UserManagementModule, AuthModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
