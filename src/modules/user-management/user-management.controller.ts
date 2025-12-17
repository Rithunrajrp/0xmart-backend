import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
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
import { UserManagementService } from './user-management.service';
import { UpdateUserTypeDto } from './dto/update-user-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, UserType } from '@prisma/client';

@ApiTags('user-management')
@Controller('user-management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserManagementController {
  constructor(
    private readonly userManagementService: UserManagementService,
  ) {}

  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all users with filters (Admin only)' })
  @ApiQuery({ name: 'userType', enum: UserType, required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  getUsers(
    @Query('userType') userType?: UserType,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userManagementService.getUsers({ userType, page, limit });
  }

  @Patch('users/:userId/type')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user type (Admin only)' })
  @ApiResponse({ status: 200 })
  updateUserType(
    @Param('userId') userId: string,
    @Body() updateUserTypeDto: UpdateUserTypeDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.userManagementService.updateUserType(
      userId,
      updateUserTypeDto.userType,
      currentUser.id,
      updateUserTypeDto.reason,
    );
  }

  @Get('users/:userId/upgrade-status')
  @ApiOperation({ summary: 'Get user upgrade status and requirements' })
  @ApiResponse({ status: 200 })
  getUserUpgradeStatus(@Param('userId') userId: string) {
    return this.userManagementService.getUserUpgradeStatus(userId);
  }

  @Get('me/upgrade-status')
  @ApiOperation({ summary: 'Get current user upgrade status' })
  @ApiResponse({ status: 200 })
  getMyUpgradeStatus(@CurrentUser() user: any) {
    return this.userManagementService.getUserUpgradeStatus(user.id);
  }

  @Patch('users/:userId/check-upgrade')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manually trigger upgrade check (Admin only)' })
  @ApiResponse({ status: 200 })
  checkUpgrade(@Param('userId') userId: string) {
    return this.userManagementService.checkAndUpgradeUserType(userId);
  }
}
