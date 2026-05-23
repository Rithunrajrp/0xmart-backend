import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatAgentService } from './chat-agent.service';
import { SessionService } from './session.service';
import { ToolRegistryService } from './tool-registry.service';
import { VoiceService } from './voice.service';
import { VoiceController } from './voice.controller';
import { ChatAnalyticsService } from './analytics.service';
import { ChatAnalyticsController } from './analytics.controller';
import { SessionController } from './session.controller';
import { SessionExpiryService } from './session-expiry.service';
import { AIInfrastructureModule } from '../ai-infrastructure/ai-infrastructure.module';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { OxlienModule } from '../oxlien/oxlien.module';

@Module({
  imports: [
    AIInfrastructureModule,
    ProductsModule,
    OrdersModule,
    UsersModule,
    WalletsModule,
    PrismaModule,
    OxlienModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string | number>('jwt.expiresIn') as any,
        },
      }),
    }),
  ],
  controllers: [ChatController, VoiceController, ChatAnalyticsController, SessionController],
  providers: [
    ChatGateway,
    ChatAgentService,
    SessionService,
    ToolRegistryService,
    VoiceService,
    ChatAnalyticsService,
    SessionExpiryService,
  ],
  exports: [
    ChatAgentService,
    SessionService,
    ChatGateway,
    ChatAnalyticsService,
  ],
})
export class AIChatModule {}
