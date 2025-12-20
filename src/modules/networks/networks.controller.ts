import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NetworksService } from './networks.service';
import {
  UpdateNetworkConfigDto,
  NetworkConfigResponseDto,
  UpdateContractDeploymentDto,
} from './dto/network-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Networks')
@Controller('networks')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NetworksController {
  constructor(private readonly networksService: NetworksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all network configurations' })
  @ApiResponse({
    status: 200,
    description: 'Returns all network configurations',
    type: [NetworkConfigResponseDto],
  })
  async getAllNetworks() {
    return this.networksService.getAllNetworks();
  }

  @Get('enabled')
  @ApiOperation({ summary: 'Get only enabled networks' })
  @ApiResponse({
    status: 200,
    description: 'Returns enabled network configurations',
    type: [NetworkConfigResponseDto],
  })
  async getEnabledNetworks() {
    return this.networksService.getEnabledNetworks();
  }

  @Get(':network')
  @ApiOperation({ summary: 'Get network configuration by network type' })
  @ApiResponse({
    status: 200,
    description: 'Returns network configuration',
    type: NetworkConfigResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Network not found' })
  async getNetworkByType(@Param('network') network: string) {
    return this.networksService.getNetworkByType(network);
  }

  @Put(':network')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Update network configuration (SUPER_ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Network configuration updated successfully',
    type: NetworkConfigResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - SUPER_ADMIN only' })
  @ApiResponse({ status: 404, description: 'Network not found' })
  async updateNetwork(
    @Param('network') network: string,
    @Body() updateDto: UpdateNetworkConfigDto,
    @CurrentUser() user: any,
  ) {
    return this.networksService.updateNetwork(network, updateDto, user.userId);
  }

  @Patch(':network/toggle')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Toggle network enabled status (SUPER_ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Network status toggled successfully',
    type: NetworkConfigResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - SUPER_ADMIN only' })
  @ApiResponse({ status: 404, description: 'Network not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot disable all networks',
  })
  async toggleNetwork(
    @Param('network') network: string,
    @Body() body: { isEnabled: boolean },
    @CurrentUser() user: any,
  ) {
    return this.networksService.toggleNetwork(
      network,
      body.isEnabled,
      user.userId,
    );
  }

  @Patch(':network/contract')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Update contract deployment status (SUPER_ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Contract deployment status updated successfully',
    type: NetworkConfigResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - SUPER_ADMIN only' })
  @ApiResponse({ status: 404, description: 'Network not found' })
  async updateContractDeployment(
    @Param('network') network: string,
    @Body() updateDto: UpdateContractDeploymentDto,
    @CurrentUser() user: any,
  ) {
    return this.networksService.updateContractDeployment(
      network,
      updateDto,
      user.userId,
    );
  }
}
