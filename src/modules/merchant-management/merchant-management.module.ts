import { Module } from '@nestjs/common';
import { MerchantManagementService } from './merchant-management.service';
import { MerchantManagementController } from './merchant-management.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MerchantManagementService],
  controllers: [MerchantManagementController],
  exports: [MerchantManagementService],
})
export class MerchantManagementModule {}
