import {
  Controller,
  Get,
  Post,
  Patch,
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
import { MerchantManagementService } from './merchant-management.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { ApproveDocumentDto } from './dto/approve-document.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Merchant Management')
@ApiBearerAuth()
@Controller('merchants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MerchantManagementController {
  constructor(
    private readonly merchantManagementService: MerchantManagementService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary:
      'Create a new merchant and generate onboarding link (Super Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Merchant created successfully with onboarding link',
  })
  @ApiResponse({
    status: 409,
    description: 'User with email or phone already exists',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires Super Admin role',
  })
  async createMerchant(
    @Body() createMerchantDto: CreateMerchantDto,
    @CurrentUser() user: any,
  ) {
    return this.merchantManagementService.createMerchant(
      createMerchantDto,
      user.id,
    );
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all merchants with pagination and filters' })
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
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by company name or email',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of merchants',
  })
  async getAllMerchants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.merchantManagementService.getAllMerchants(
      pageNum,
      limitNum,
      status,
      search,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get merchant details by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns merchant details with documents',
  })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  async getMerchantById(@Param('id') id: string) {
    return this.merchantManagementService.getMerchantById(id);
  }

  @Get(':id/documents')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all documents for a merchant' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of merchant documents',
  })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  async getMerchantDocuments(@Param('id') id: string) {
    return this.merchantManagementService.getMerchantDocuments(id);
  }

  @Patch('documents/:docId/approve')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve a merchant document' })
  @ApiResponse({ status: 200, description: 'Document approved successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 400, description: 'Document already approved' })
  async approveDocument(
    @Param('docId') docId: string,
    @Body() approveDto: ApproveDocumentDto,
    @CurrentUser() user: any,
  ) {
    return this.merchantManagementService.approveDocument(
      docId,
      approveDto,
      user.id,
    );
  }

  @Patch('documents/:docId/reject')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject a merchant document with reason' })
  @ApiResponse({ status: 200, description: 'Document rejected successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async rejectDocument(
    @Param('docId') docId: string,
    @Body() rejectDto: RejectDocumentDto,
    @CurrentUser() user: any,
  ) {
    return this.merchantManagementService.rejectDocument(
      docId,
      rejectDto,
      user.id,
    );
  }

  @Patch(':id/activate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Activate merchant account (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Merchant activated successfully' })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  @ApiResponse({ status: 400, description: 'Merchant not in APPROVED status' })
  async activateMerchant(@Param('id') id: string, @CurrentUser() user: any) {
    return this.merchantManagementService.activateMerchant(id, user.id);
  }

  @Patch(':id/suspend')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Suspend merchant account' })
  @ApiResponse({ status: 200, description: 'Merchant suspended successfully' })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  async suspendMerchant(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.merchantManagementService.suspendMerchant(id, reason);
  }
}
