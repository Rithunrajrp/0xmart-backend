import {
  Controller,
  Get,
  Put,
  Body,
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
import { OxlienSettingsService } from './oxlien-settings.service';

@ApiTags('Oxlien Settings')
@Controller('oxlien')
@ApiBearerAuth()
export class OxlienSettingsController {
  constructor(private readonly settingsService: OxlienSettingsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get current user Oxlien settings' })
  @ApiResponse({ status: 200, description: 'OxlienSettings record' })
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getOrCreate(user.id);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update Oxlien settings' })
  @ApiResponse({ status: 200, description: 'Updated OxlienSettings record' })
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    if (!user?.id) {
      throw new HttpException(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.settingsService.update(user.id, body);
  }
}
