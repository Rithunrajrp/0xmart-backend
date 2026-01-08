import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get system settings (public)' })
  @ApiResponse({
    status: 200,
    description: 'System settings retrieved successfully',
  })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @UseGuards(SuperAdminGuard)
  @Patch()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update system settings (super admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin role required',
  })
  async updateSettings(
    @Body() updateDto: UpdateSettingsDto,
    @Request() req: any,
  ) {
    const updatedBy = req.user?.id || req.user?.sub;
    return this.settingsService.updateSettings(updateDto, updatedBy);
  }
}
