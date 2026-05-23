import { Module } from '@nestjs/common';
import { ShopifyController } from './shopify.controller';
import { ShopifyService } from './shopify.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShopifyController],
  providers: [ShopifyService],
  exports: [ShopifyService],
})
export class ShopifyModule {}
