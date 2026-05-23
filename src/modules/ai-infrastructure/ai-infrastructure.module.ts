import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLMGatewayService } from './llm-gateway.service';
import { VectorDBService } from './vector-db.service';
import { AICacheService } from './cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    LLMGatewayService,
    VectorDBService,
    AICacheService,
  ],
  exports: [
    LLMGatewayService,
    VectorDBService,
    AICacheService,
  ],
})
export class AIInfrastructureModule {}
