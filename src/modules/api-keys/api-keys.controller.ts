import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import {
  CreateApiKeyDto,
  UpdateWebhookDto,
  UpdateTierDto,
} from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SmartContractService } from '../smart-contract/services/smart-contract.service';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly smartContractService: SmartContractService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new API key',
    description:
      'Creates a new API key for the authenticated user. The key and secret are only shown once - save them securely!',
  })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
    schema: {
      example: {
        id: 'uuid',
        name: 'My Production API Key',
        apiKey: 'xmart_abc123...',
        apiSecret: 'xms_xyz789...',
        prefix: 'xmart_ab',
        tier: 'free',
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-04-01T00:00:00Z',
      },
    },
  })
  async createApiKey(
    @CurrentUser() user: { id: string },
    @Body() createApiKeyDto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.createApiKey(user.id, createApiKeyDto.name, {
      supportedNetworks: createApiKeyDto.supportedNetworks,
      expiresInDays: createApiKeyDto.expiresInDays,
      subscriptionTier: createApiKeyDto.subscriptionTier,
      webhookUrl: createApiKeyDto.webhookUrl,
    });
  }

  @Get('networks')
  @ApiOperation({
    summary: 'Get available blockchain networks',
    description:
      'Get list of all supported blockchain networks with contract details',
  })
  @ApiResponse({
    status: 200,
    description: 'Available networks',
    schema: {
      example: {
        networks: [
          {
            value: 'ETHEREUM',
            name: 'Ethereum',
            icon: '/icons/networks/ethereum.svg',
            contractAddress: '0x...',
          },
          {
            value: 'SUI',
            name: 'Sui',
            icon: '/icons/networks/sui.svg',
            packageId: '0x...',
          },
        ],
      },
    },
  })
  async getAvailableNetworks() {
    const networks = this.smartContractService.getAvailableNetworks();
    return {
      networks: networks.map((network) => ({
        value: network,
        name: this.smartContractService.getNetworkDisplayName(network),
        icon: this.smartContractService.getNetworkIcon(network),
        contractAddress: this.smartContractService.getContractAddress(network),
      })),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'List all API keys',
    description: 'Get all API keys for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'List of API keys' })
  async getApiKeys(@CurrentUser() user: { id: string }) {
    return this.apiKeysService.getUserApiKeys(user.id);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get API key statistics',
    description: 'Get statistics about API keys for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'API key statistics' })
  async getApiKeyStats(@CurrentUser() user: { id: string }) {
    return this.apiKeysService.getApiKeyStats(user.id);
  }

  @Get(':id/analytics')
  @ApiOperation({
    summary: 'Get usage analytics',
    description: 'Get usage analytics for a specific API key',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to analyze (default: 30)',
  })
  @ApiResponse({ status: 200, description: 'Usage analytics' })
  async getUsageAnalytics(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.apiKeysService.getUsageAnalytics(
      user.id,
      id,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Post(':id/rotate')
  @ApiOperation({
    summary: 'Rotate API key',
    description:
      'Generate new credentials for an existing API key. Old credentials will be invalidated.',
  })
  @ApiResponse({
    status: 200,
    description: 'API key rotated successfully',
    schema: {
      example: {
        apiKey: 'xmart_new123...',
        apiSecret: 'xms_new789...',
        prefix: 'xmart_ne',
      },
    },
  })
  async rotateApiKey(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.apiKeysService.rotateApiKey(user.id, id);
  }

  @Patch(':id/webhook')
  @ApiOperation({
    summary: 'Update webhook configuration',
    description: 'Update or remove webhook URL for an API key',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook updated',
    schema: {
      example: {
        webhookUrl: 'https://example.com/webhook',
        webhookSecret: 'abc123...', // Only shown when setting new webhook
      },
    },
  })
  async updateWebhook(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateWebhookDto: UpdateWebhookDto,
  ) {
    return this.apiKeysService.updateWebhook(
      user.id,
      id,
      updateWebhookDto.webhookUrl ?? null,
    );
  }

  @Patch(':id/tier')
  @ApiOperation({
    summary: 'Update subscription tier',
    description: 'Upgrade or downgrade the subscription tier for an API key',
  })
  @ApiResponse({ status: 200, description: 'Tier updated' })
  async updateTier(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateTierDto: UpdateTierDto,
  ) {
    return this.apiKeysService.updateTier(user.id, id, updateTierDto.tier);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Revoke an API key',
    description: 'Revoke an API key (can be restored later)',
  })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  async revokeApiKey(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.apiKeysService.revokeApiKey(user.id, id);
  }

  @Delete(':id/permanent')
  @ApiOperation({
    summary: 'Delete an API key permanently',
    description: 'Permanently delete an API key (cannot be restored)',
  })
  @ApiResponse({ status: 200, description: 'API key deleted' })
  async deleteApiKey(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.apiKeysService.deleteApiKey(user.id, id);
  }
}
