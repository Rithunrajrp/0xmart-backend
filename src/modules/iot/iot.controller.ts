import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { IoTDeviceService } from './iot-device.service';
import { IoTGatewayService } from './iot-gateway.service';

@ApiTags('IoT Devices')
@Controller('iot')
@ApiBearerAuth()
export class IoTController {
  constructor(
    private readonly deviceService: IoTDeviceService,
    private readonly gatewayService: IoTGatewayService,
  ) {}

  @Get('devices')
  @ApiOperation({ summary: 'List IoT devices for current user' })
  @ApiResponse({ status: 200, description: 'Array of IoTDevice' })
  async listDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.deviceService.findAllByUser(user.id);
  }

  @Post('devices')
  @ApiOperation({ summary: 'Register a new IoT device' })
  @ApiResponse({ status: 201, description: 'Created IoTDevice' })
  async createDevice(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    if (!body.name || !body.mqttBrokerUrl || !body.mqttTopic) {
      throw new HttpException(
        'name, mqttBrokerUrl and mqttTopic are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const device = await this.deviceService.create(user.id, body);
    if (device.isEnabled) await this.gatewayService.subscribeDevice(device);
    return device;
  }

  @Put('devices/:id')
  @ApiOperation({ summary: 'Update an IoT device' })
  @ApiResponse({ status: 200, description: 'Updated IoTDevice' })
  async updateDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const device = await this.deviceService.update(id, user.id, body);
    if (!device)
      throw new HttpException('Device not found', HttpStatus.NOT_FOUND);

    if (body.isEnabled !== undefined) {
      if (body.isEnabled) await this.gatewayService.subscribeDevice(device);
      else this.gatewayService.unsubscribeDevice(id);
    }
    return device;
  }

  @Delete('devices/:id')
  @ApiOperation({ summary: 'Delete an IoT device' })
  @ApiResponse({ status: 200, description: 'Deleted confirmation' })
  async deleteDevice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.gatewayService.unsubscribeDevice(id);
    const result = await this.deviceService.delete(id, user.id);
    if (!result)
      throw new HttpException('Device not found', HttpStatus.NOT_FOUND);
    return { message: 'Device deleted' };
  }

  @Get('pending-events')
  @ApiOperation({ summary: 'Polling fallback — get pending IoT events' })
  @ApiResponse({ status: 200, description: 'Array of IoTEvent' })
  async getPendingEvents(@CurrentUser() user: AuthenticatedUser) {
    return this.deviceService.getPendingEvents(user.id);
  }
}
