import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import {
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, KYCStatus, DocumentType, DocumentStatus } from '@prisma/client';
import { KycSessionEntity } from './entities/kyc.entity';

@ApiTags('kyc')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  @ApiOperation({ summary: 'Initiate KYC verification' })
  @ApiResponse({ status: 201, type: KycSessionEntity })
  async initiateKyc(
    @CurrentUser() user: any,
    @Body() submitKycDto: SubmitKycDto,
  ) {
    return this.kycService.initiateKyc(user.id as string, submitKycDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FilesInterceptor('documents', 2)) // Max 2 files (front and back)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload KYC document (ID, Passport, Selfie, etc.)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentType: {
          type: 'string',
          enum: Object.values(DocumentType),
          example: DocumentType.PASSPORT,
        },
        documents: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Front image (required) and back image (optional)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  async uploadDocument(
    @CurrentUser() user: any,
    @Body('documentType') documentType: DocumentType,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    if (!documentType) {
      throw new BadRequestException('Document type is required');
    }

    const frontImage = files[0];
    const backImage = files.length > 1 ? files[1] : undefined;

    return this.kycService.uploadDocument(
      user.id as string,
      documentType,
      frontImage,
      backImage,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('status')
  @ApiOperation({ summary: 'Get KYC verification status and uploaded documents' })
  @ApiResponse({ status: 200 })
  async getStatus(@CurrentUser() user: any) {
    return this.kycService.getKycStatus(user.id as string);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('retry')
  @ApiOperation({ summary: 'Retry KYC verification after rejection' })
  @ApiResponse({ status: 201 })
  async retryKyc(@CurrentUser() user: any) {
    return this.kycService.retryKyc(user.id as string);
  }

  // Admin routes
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('admin/applications')
  @ApiOperation({ summary: 'Get all KYC applications (Admin only)' })
  @ApiQuery({ name: 'status', required: false, enum: KYCStatus })
  @ApiQuery({ name: 'documentStatus', required: false, enum: DocumentStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  async getAllApplications(
    @Query('status') status?: KYCStatus,
    @Query('documentStatus') documentStatus?: DocumentStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.kycService.getAllKycApplications({
      status,
      documentStatus,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('admin/applications/:userId')
  @ApiOperation({ summary: 'Get detailed KYC application for a user (Admin only)' })
  @ApiResponse({ status: 200 })
  async getApplication(@Param('userId') userId: string) {
    return this.kycService.getKycApplication(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('admin/documents/:documentId/review')
  @ApiOperation({ summary: 'Review a single KYC document (Admin only)' })
  @ApiResponse({ status: 200 })
  async reviewDocument(
    @Param('documentId') documentId: string,
    @Body() reviewDto: ReviewDocumentDto,
    @CurrentUser() admin: any,
  ) {
    if (!reviewDto.approve && !reviewDto.rejectionReason) {
      throw new BadRequestException(
        'Rejection reason is required when rejecting a document',
      );
    }

    return this.kycService.reviewDocument(
      documentId,
      reviewDto,
      admin.id as string,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('admin/:userId/approve')
  @ApiOperation({ summary: 'Manually approve entire KYC application (Admin only)' })
  @ApiResponse({ status: 200 })
  async manualApprove(
    @Param('userId') userId: string,
    @CurrentUser() admin: any,
  ) {
    return this.kycService.manualApprove(userId, admin.id as string);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('admin/:userId/reject')
  @ApiOperation({ summary: 'Manually reject entire KYC application (Admin only)' })
  @ApiResponse({ status: 200 })
  async manualReject(
    @Param('userId') userId: string,
    @Body() body: { reason: string },
    @CurrentUser() admin: any,
  ) {
    if (!body.reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    return this.kycService.manualReject(
      userId,
      body.reason,
      admin.id as string,
    );
  }
}
