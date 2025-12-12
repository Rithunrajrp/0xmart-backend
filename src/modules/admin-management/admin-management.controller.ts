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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminManagementService } from './admin-management.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Admin Management')
@ApiBearerAuth()
@Controller('admin-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminManagementController {
  constructor(
    private readonly adminManagementService: AdminManagementService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new admin (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Admin created successfully' })
  @ApiResponse({
    status: 409,
    description: 'User with email or phone already exists',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires Super Admin role',
  })
  async createAdmin(
    @Body() createAdminDto: CreateAdminDto,
    @CurrentUser() user: any,
  ) {
    return this.adminManagementService.createAdmin(createAdminDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all admins with pagination and filters' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status (ACTIVE, SUSPENDED)',
  })
  @ApiResponse({ status: 200, description: 'Returns paginated list of admins' })
  async getAllAdmins(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adminManagementService.getAllAdmins(pageNum, limitNum, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admin details by ID' })
  @ApiResponse({ status: 200, description: 'Returns admin details' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async getAdminById(@Param('id') id: string) {
    return this.adminManagementService.getAdminById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin status (activate/deactivate)' })
  @ApiResponse({ status: 200, description: 'Admin updated successfully' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async updateAdmin(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
  ) {
    return this.adminManagementService.updateAdmin(id, updateAdminDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an admin' })
  @ApiResponse({ status: 200, description: 'Admin deleted successfully' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async deleteAdmin(@Param('id') id: string) {
    return this.adminManagementService.deleteAdmin(id);
  }
}
