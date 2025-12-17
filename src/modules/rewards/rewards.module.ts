import { Module } from '@nestjs/common';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Module({
  controllers: [RewardsController],
  providers: [RewardsService, PrismaService],
  exports: [RewardsService],
})
export class RewardsModule {}
