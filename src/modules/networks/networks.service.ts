import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  UpdateNetworkConfigDto,
  UpdateContractDeploymentDto,
} from './dto/network-config.dto';

@Injectable()
export class NetworksService {
  private readonly logger = new Logger(NetworksService.name);

  // Network metadata
  private readonly networkMetadata = {
    ETHEREUM: {
      displayName: 'Ethereum',
      description: 'Ethereum Mainnet - The most widely adopted smart contract platform',
      sortOrder: 1,
    },
    POLYGON: {
      displayName: 'Polygon',
      description: 'Polygon (Matic) - Fast and low-cost Ethereum sidechain',
      sortOrder: 2,
    },
    BSC: {
      displayName: 'BNB Smart Chain',
      description: 'BNB Smart Chain - High-performance blockchain by Binance',
      sortOrder: 3,
    },
    ARBITRUM: {
      displayName: 'Arbitrum',
      description: 'Arbitrum One - Layer 2 scaling solution for Ethereum',
      sortOrder: 4,
    },
    OPTIMISM: {
      displayName: 'Optimism',
      description: 'Optimism - Ethereum Layer 2 with optimistic rollups',
      sortOrder: 5,
    },
    AVALANCHE: {
      displayName: 'Avalanche',
      description: 'Avalanche C-Chain - Fast, low-cost, and eco-friendly blockchain',
      sortOrder: 6,
    },
    BASE: {
      displayName: 'Base',
      description: 'Base - Layer 2 network built by Coinbase',
      sortOrder: 7,
    },
    SUI: {
      displayName: 'Sui',
      description: 'Sui Network - Next-generation smart contract platform',
      sortOrder: 8,
    },
    TON: {
      displayName: 'TON',
      description: 'The Open Network - High-performance blockchain by Telegram',
      sortOrder: 9,
    },
    SOLANA: {
      displayName: 'Solana',
      description: 'Solana - Ultra-fast blockchain with low transaction costs',
      sortOrder: 10,
    },
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Initialize network configurations if they don't exist
   */
  async initializeNetworks(): Promise<void> {
    const networks = Object.keys(this.networkMetadata);

    for (const network of networks) {
      const existing = await this.prisma.networkConfig.findUnique({
        where: { network: network as any },
      });

      if (!existing) {
        const metadata = this.networkMetadata[network];
        await this.prisma.networkConfig.create({
          data: {
            network: network as any,
            isEnabled: true,
            displayName: metadata.displayName,
            description: metadata.description,
            sortOrder: metadata.sortOrder,
          },
        });
        this.logger.log(`Initialized network config for ${network}`);
      }
    }
  }

  /**
   * Get all network configurations
   */
  async getAllNetworks() {
    return this.prisma.networkConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get only enabled networks
   */
  async getEnabledNetworks() {
    return this.prisma.networkConfig.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get network configuration by network type
   */
  async getNetworkByType(network: string) {
    const networkConfig = await this.prisma.networkConfig.findUnique({
      where: { network: network as any },
    });

    if (!networkConfig) {
      throw new NotFoundException(`Network ${network} not found`);
    }

    return networkConfig;
  }

  /**
   * Update network configuration (SUPER_ADMIN only)
   */
  async updateNetwork(
    network: string,
    updateDto: UpdateNetworkConfigDto,
    updatedBy: string,
  ) {
    const existing = await this.prisma.networkConfig.findUnique({
      where: { network: network as any },
    });

    if (!existing) {
      throw new NotFoundException(`Network ${network} not found`);
    }

    const updated = await this.prisma.networkConfig.update({
      where: { network: network as any },
      data: {
        ...updateDto,
        updatedBy,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: updatedBy,
        action: 'SETTINGS_CHANGED',
        entityType: 'network_config',
        entityId: updated.id,
        metadata: {
          network,
          changes: updateDto as any,
        } as any,
      },
    });

    this.logger.log(`Network ${network} updated by user ${updatedBy}`);

    return updated;
  }

  /**
   * Toggle network enabled status (SUPER_ADMIN only)
   */
  async toggleNetwork(network: string, isEnabled: boolean, updatedBy: string) {
    const existing = await this.prisma.networkConfig.findUnique({
      where: { network: network as any },
    });

    if (!existing) {
      throw new NotFoundException(`Network ${network} not found`);
    }

    // Check if at least one network will remain enabled
    if (!isEnabled) {
      const enabledCount = await this.prisma.networkConfig.count({
        where: { isEnabled: true },
      });

      if (enabledCount <= 1) {
        throw new BadRequestException(
          'Cannot disable all networks. At least one network must remain enabled.',
        );
      }
    }

    const updated = await this.prisma.networkConfig.update({
      where: { network: network as any },
      data: {
        isEnabled,
        updatedBy,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: updatedBy,
        action: 'SETTINGS_CHANGED',
        entityType: 'network_config',
        entityId: updated.id,
        metadata: {
          network,
          action: isEnabled ? 'enabled' : 'disabled',
        },
      },
    });

    this.logger.log(
      `Network ${network} ${isEnabled ? 'enabled' : 'disabled'} by user ${updatedBy}`,
    );

    return updated;
  }

  /**
   * Check if a network is enabled
   */
  async isNetworkEnabled(network: string): Promise<boolean> {
    const networkConfig = await this.prisma.networkConfig.findUnique({
      where: { network: network as any },
    });

    return networkConfig?.isEnabled ?? false;
  }

  /**
   * Validate that all provided networks are enabled
   */
  async validateNetworks(networks: string[]): Promise<{
    valid: boolean;
    disabledNetworks: string[];
  }> {
    const disabledNetworks: string[] = [];

    for (const network of networks) {
      const isEnabled = await this.isNetworkEnabled(network);
      if (!isEnabled) {
        disabledNetworks.push(network);
      }
    }

    return {
      valid: disabledNetworks.length === 0,
      disabledNetworks,
    };
  }

  /**
   * Update contract deployment status (SUPER_ADMIN only)
   */
  async updateContractDeployment(
    network: string,
    updateDto: UpdateContractDeploymentDto,
    updatedBy: string,
  ) {
    const existing = await this.prisma.networkConfig.findUnique({
      where: { network: network as any },
    });

    if (!existing) {
      throw new NotFoundException(`Network ${network} not found`);
    }

    const updated = await this.prisma.networkConfig.update({
      where: { network: network as any },
      data: {
        contractDeployed: updateDto.contractDeployed,
        contractAddress: updateDto.contractAddress,
        lastContractCheck: new Date(),
        updatedBy,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: updatedBy,
        action: 'SETTINGS_CHANGED',
        entityType: 'network_config',
        entityId: updated.id,
        metadata: {
          network,
          action: 'contract_deployment_updated',
          contractDeployed: updateDto.contractDeployed,
          contractAddress: updateDto.contractAddress,
        },
      },
    });

    this.logger.log(
      `Network ${network} contract deployment updated by user ${updatedBy}: ${updateDto.contractDeployed ? 'deployed' : 'pending'}`,
    );

    return updated;
  }
}
