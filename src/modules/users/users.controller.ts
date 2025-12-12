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
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
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

  @Put('me/deactivate')
  @ApiOperation({ summary: 'Deactivate current user account' })
  @ApiResponse({ status: 200 })
  async deactivateAccount(@CurrentUser() user: { id: string }) {
    return this.usersService.deactivateUser(user.id);
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
