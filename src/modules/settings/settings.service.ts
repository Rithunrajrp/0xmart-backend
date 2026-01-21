import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Ensure settings row exists on startup
    await this.ensureSettingsExist();
  }

  private async ensureSettingsExist() {
    const settings = await this.prisma.systemSettings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings) {
      this.logger.log('Creating default system settings...');
      await this.prisma.systemSettings.create({
        data: {
          id: 'singleton',
          kycEnabled: false,
          maintenanceMode: false,
          registrationEnabled: true,
          withdrawalsEnabled: true,
          depositsEnabled: true,
          fiatPurchaseEnabled: true,
          tokenSwapEnabled: false,
          apiAccessEnabled: true,
          showTestnetBanner: true,
        },
      });
      this.logger.log('✅ Default system settings created');
    }
  }

  async getSettings() {
    const settings = await this.prisma.systemSettings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings) {
      // If somehow deleted, recreate
      await this.ensureSettingsExist();
      return this.getSettings();
    }

    return settings;
  }

  async updateSettings(
    updateDto: UpdateSettingsDto,
    updatedBy?: string,
  ) {
    this.logger.log(
      `Updating system settings: ${JSON.stringify(updateDto)}`,
    );

    const settings = await this.prisma.systemSettings.update({
      where: { id: 'singleton' },
      data: {
        ...updateDto,
        updatedBy,
      },
    });

    this.logger.log('✅ System settings updated successfully');
    return settings;
  }

  async isKycEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.kycEnabled;
  }

  async isMaintenanceMode(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.maintenanceMode;
  }

  async areWithdrawalsEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.withdrawalsEnabled;
  }

  async areDepositsEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.depositsEnabled;
  }

  async isFiatPurchaseEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.fiatPurchaseEnabled;
  }

  async isTokenSwapEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.tokenSwapEnabled;
  }

  async isApiAccessEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.apiAccessEnabled;
  }
}
