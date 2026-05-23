import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AIChatModule } from '../ai-chat/ai-chat.module';
import { IoTDeviceService } from './iot-device.service';
import { IoTGatewayService } from './iot-gateway.service';
import { IoTController } from './iot.controller';

@Module({
  imports: [PrismaModule, AIChatModule],
  controllers: [IoTController],
  providers: [IoTDeviceService, IoTGatewayService],
  exports: [IoTDeviceService, IoTGatewayService],
})
export class IoTModule {}
