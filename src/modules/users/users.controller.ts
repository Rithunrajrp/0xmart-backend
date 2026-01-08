import {
  Controller,
  Get,
  Post,
  Put,
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
import { UsersService } from './users.service';
import { UserAddressesService } from './user-addresses.service';
import { UserManagementService } from '../user-management/user-management.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { InitiateProfileUpdateDto } from './dto/initiate-profile-update.dto';
import { VerifyCurrentCredentialsDto } from './dto/verify-current-credentials.dto';
import { UpdateEmailDto, VerifyEmailUpdateDto } from './dto/update-email.dto';
import { UpdatePhoneDto, VerifyPhoneUpdateDto } from './dto/update-phone.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, UserStatus, KYCStatus, AddressType } from '@prisma/client';
import { UserWithWalletsEntity } from './entities/user.entity';
import { UserAddressEntity } from './entities/user-address.entity';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userAddressesService: UserAddressesService,
    private readonly userManagementService: UserManagementService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserWithWalletsEntity })
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.usersService.findOne(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, type: UserWithWalletsEntity })
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(user.id, updateUserDto);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200 })
  async getStats(@CurrentUser() user: { id: string }) {
    return this.usersService.getUserStats(user.id);
  }

  @Get('me/upgrade-status')
  @ApiOperation({ summary: 'Get current user upgrade status and tier progress' })
  @ApiResponse({ status: 200 })
  async getMyUpgradeStatus(@CurrentUser() user: { id: string }) {
    return this.userManagementService.getUserUpgradeStatus(user.id);
  }

  @Get('me/referral-stats')
  @ApiOperation({ summary: 'Get current user referral statistics' })
  @ApiResponse({ status: 200 })
  async getReferralStats(@CurrentUser() user: { id: string }) {
    return this.usersService.getReferralStats(user.id);
  }

  @Put('me/deactivate')
  @ApiOperation({ summary: 'Deactivate current user account' })
  @ApiResponse({ status: 200 })
  async deactivateAccount(@CurrentUser() user: { id: string }) {
    return this.usersService.deactivateUser(user.id);
  }

  // Profile Update Routes
  @Post('me/profile-update/initiate')
  @ApiOperation({ summary: 'Initiate profile update (sends OTP to current credentials)' })
  @ApiResponse({ status: 200 })
  async initiateProfileUpdate(
    @CurrentUser() user: { id: string },
    @Body() dto: InitiateProfileUpdateDto,
  ) {
    const updateType = dto.updateType === 'EMAIL' ? 'email' : 'phone';
    return this.usersService.initiateProfileUpdate(user.id, updateType);
  }

  @Post('me/profile-update/verify-current')
  @ApiOperation({ summary: 'Verify current credentials with OTP' })
  @ApiResponse({ status: 200 })
  async verifyCurrentCredentials(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyCurrentCredentialsDto,
  ) {
    return this.usersService.verifyCurrentCredentials(
      user.id,
      dto.emailOtp,
      dto.phoneOtp,
    );
  }

  @Post('me/profile-update/email/initiate')
  @ApiOperation({ summary: 'Initiate email update (sends OTP to new email)' })
  @ApiResponse({ status: 200 })
  async initiateEmailUpdate(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateEmailDto,
  ) {
    return this.usersService.initiateEmailUpdate(user.id, dto.newEmail);
  }

  @Post('me/profile-update/email/verify')
  @ApiOperation({ summary: 'Verify new email with OTP and complete update' })
  @ApiResponse({ status: 200 })
  async verifyEmailUpdate(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyEmailUpdateDto,
  ) {
    return this.usersService.verifyEmailUpdate(user.id, dto.emailOtp);
  }

  @Post('me/profile-update/phone/initiate')
  @ApiOperation({ summary: 'Initiate phone update (sends OTP to new phone)' })
  @ApiResponse({ status: 200 })
  async initiatePhoneUpdate(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePhoneDto,
  ) {
    return this.usersService.initiatePhoneUpdate(
      user.id,
      dto.countryCode,
      dto.newPhoneNumber,
    );
  }

  @Post('me/profile-update/phone/verify')
  @ApiOperation({ summary: 'Verify new phone with OTP and complete update' })
  @ApiResponse({ status: 200 })
  async verifyPhoneUpdate(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyPhoneUpdateDto,
  ) {
    return this.usersService.verifyPhoneUpdate(user.id, dto.phoneOtp);
  }

  @Delete('me/delete-account')
  @ApiOperation({ summary: 'Permanently delete user account and all data' })
  @ApiResponse({ status: 200 })
  async deleteAccount(
    @CurrentUser() user: { id: string },
    @Body() dto: DeleteAccountDto,
  ) {
    return this.usersService.deleteAccount(user.id, dto.confirmationText);
  }

  // Admin routes
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiResponse({ status: 200 })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: UserStatus,
    @Query('kycStatus') kycStatus?: KYCStatus,
  ) {
    return this.usersService.findAll(page, limit, { status, kycStatus });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({ status: 200, type: UserWithWalletsEntity })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id/reactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reactivate user (Admin only)' })
  @ApiResponse({ status: 200 })
  async reactivateUser(@Param('id') id: string) {
    return this.usersService.reactivateUser(id);
  }

  // Address management routes
  @Get('me/addresses')
  @ApiOperation({ summary: 'Get user addresses' })
  @ApiQuery({ name: 'type', required: false, enum: AddressType })
  @ApiResponse({ status: 200, type: [UserAddressEntity] })
  async getAddresses(
    @CurrentUser() user: { id: string },
    @Query('type') type?: AddressType,
  ) {
    return this.userAddressesService.findAll(user.id, type);
  }

  @Get('me/addresses/:id')
  @ApiOperation({ summary: 'Get address by ID' })
  @ApiResponse({ status: 200, type: UserAddressEntity })
  async getAddress(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.userAddressesService.findOne(user.id, id);
  }

  @Post('me/addresses')
  @ApiOperation({ summary: 'Create new address' })
  @ApiResponse({ status: 201, type: UserAddressEntity })
  async createAddress(
    @CurrentUser() user: { id: string },
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.userAddressesService.create(user.id, createAddressDto);
  }

  @Put('me/addresses/:id')
  @ApiOperation({ summary: 'Update address' })
  @ApiResponse({ status: 200, type: UserAddressEntity })
  async updateAddress(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.userAddressesService.update(user.id, id, updateAddressDto);
  }

  @Delete('me/addresses/:id')
  @ApiOperation({ summary: 'Delete address' })
  @ApiResponse({ status: 200 })
  async deleteAddress(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.userAddressesService.remove(user.id, id);
  }

  @Put('me/addresses/:id/default')
  @ApiOperation({ summary: 'Set address as default' })
  @ApiResponse({ status: 200, type: UserAddressEntity })
  async setDefaultAddress(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.userAddressesService.setDefault(user.id, id);
  }
}
