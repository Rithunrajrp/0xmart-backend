import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../common/services/s3.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { DocumentStatus, DocumentType, KYCStatus, AuditAction } from '@prisma/client';
import { EmailService } from '../auth/services/email.service';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private emailService: EmailService,
  ) {
    this.logger.log('✅ Using custom KYC service with S3 storage');
  }

  /**
   * Initiate KYC process - User submits basic information
   */
  async initiateKyc(userId: string, submitKycDto: SubmitKycDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KYCStatus.PENDING) {
      throw new BadRequestException('KYC verification already in progress');
    }

    if (user.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    // Update user with KYC submission
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KYCStatus.PENDING,
        kycSubmittedAt: new Date(),
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.KYC_INITIATED,
        entityType: 'user',
        entityId: userId,
        metadata: submitKycDto as unknown as Record<string, any>,
      },
    });

    this.logger.log(`KYC initiated for user ${userId}`);

    return {
      status: KYCStatus.PENDING,
      message: 'KYC process initiated. Please upload required documents.',
      requiredDocuments: [
        DocumentType.ID_CARD,
        DocumentType.SELFIE,
        DocumentType.ADDRESS_PROOF,
      ],
    };
  }

  /**
   * Upload KYC document (ID, Passport, Selfie, etc.)
   */
  async uploadDocument(
    userId: string,
    documentType: DocumentType,
    frontImage: Express.Multer.File,
    backImage?: Express.Multer.File,
    metadata?: Record<string, any>,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    // Upload front image to S3
    const frontImageUrl = await this.s3Service.uploadFile(
      frontImage,
      'kyc-documents',
    );

    // Upload back image if provided (for two-sided documents)
    let backImageUrl: string | null = null;
    if (backImage) {
      backImageUrl = await this.s3Service.uploadFile(
        backImage,
        'kyc-documents',
      );
    }

    // Create KYC document record
    const kycDocument = await this.prisma.kYCDocument.create({
      data: {
        userId,
        documentType,
        documentUrl: frontImageUrl,
        backImageUrl,
        status: DocumentStatus.PENDING,
        metadata: metadata || {},
      },
    });

    // Update user KYC status if this is first document
    if (user.kycStatus === KYCStatus.NOT_STARTED) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          kycStatus: KYCStatus.PENDING,
          kycSubmittedAt: new Date(),
        },
      });
    }

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.KYC_DOCUMENT_UPLOADED,
        entityType: 'kyc_document',
        entityId: kycDocument.id,
        metadata: { documentType },
      },
    });

    this.logger.log(
      `KYC document uploaded for user ${userId}: ${documentType}`,
    );

    return {
      documentId: kycDocument.id,
      documentType: kycDocument.documentType,
      status: kycDocument.status,
      submittedAt: kycDocument.submittedAt,
      message: 'Document uploaded successfully and pending review',
    };
  }

  /**
   * Get KYC status and all uploaded documents for a user
   */
  async getKycStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycDocuments: {
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Group documents by status
    const documentsByStatus = {
      pending: user.kycDocuments.filter(
        (doc) => doc.status === DocumentStatus.PENDING,
      ).length,
      approved: user.kycDocuments.filter(
        (doc) => doc.status === DocumentStatus.APPROVED,
      ).length,
      rejected: user.kycDocuments.filter(
        (doc) => doc.status === DocumentStatus.REJECTED,
      ).length,
    };

    return {
      userId: user.id,
      kycStatus: user.kycStatus,
      kycSubmittedAt: user.kycSubmittedAt,
      kycApprovedAt: user.kycApprovedAt,
      kycRejectedAt: user.kycRejectedAt,
      kycRejectionReason: user.kycRejectionReason,
      documents: user.kycDocuments.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        status: doc.status,
        submittedAt: doc.submittedAt,
        reviewedAt: doc.reviewedAt,
        rejectionReason: doc.rejectionReason,
      })),
      documentsByStatus,
      canRetry:
        user.kycStatus === KYCStatus.REJECTED ||
        user.kycStatus === KYCStatus.EXPIRED,
    };
  }

  /**
   * Admin: Get all KYC applications with filters
   */
  async getAllKycApplications(filters?: {
    status?: KYCStatus;
    documentStatus?: DocumentStatus;
    page?: number;
    limit?: number;
  }) {
    const { status, documentStatus, page = 1, limit = 20 } = filters ?? {};
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (status) whereClause.kycStatus = status;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          kycStatus: true,
          kycSubmittedAt: true,
          kycApprovedAt: true,
          kycRejectedAt: true,
          kycRejectionReason: true,
          createdAt: true,
          kycDocuments: {
            where: documentStatus ? { status: documentStatus } : undefined,
            orderBy: { submittedAt: 'desc' },
          },
        },
        orderBy: { kycSubmittedAt: 'desc' },
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    return {
      applications: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Get detailed KYC application for a specific user
   */
  async getKycApplication(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycDocuments: {
          include: {
            reviewer: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      kycStatus: user.kycStatus,
      kycSubmittedAt: user.kycSubmittedAt,
      kycApprovedAt: user.kycApprovedAt,
      kycRejectedAt: user.kycRejectedAt,
      kycRejectionReason: user.kycRejectionReason,
      documents: user.kycDocuments,
    };
  }

  /**
   * Admin: Review a single KYC document
   */
  async reviewDocument(
    documentId: string,
    reviewDto: ReviewDocumentDto,
    reviewerId: string,
  ) {
    const document = await this.prisma.kYCDocument.findUnique({
      where: { id: documentId },
      include: { user: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status !== DocumentStatus.PENDING) {
      throw new BadRequestException('Document already reviewed');
    }

    const newStatus = reviewDto.approve
      ? DocumentStatus.APPROVED
      : DocumentStatus.REJECTED;

    // Update document status
    await this.prisma.kYCDocument.update({
      where: { id: documentId },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
        rejectionReason: reviewDto.approve ? null : reviewDto.rejectionReason,
      },
    });

    // Check if all documents are now approved
    const allDocuments = await this.prisma.kYCDocument.findMany({
      where: { userId: document.userId },
    });

    const allApproved = allDocuments.every(
      (doc) => doc.status === DocumentStatus.APPROVED,
    );
    const anyRejected = allDocuments.some(
      (doc) => doc.status === DocumentStatus.REJECTED,
    );

    // Update user KYC status
    let userKycStatus: KYCStatus = KYCStatus.PENDING;
    if (allApproved && allDocuments.length >= 3) {
      // Require at least 3 documents
      userKycStatus = KYCStatus.APPROVED;
      await this.prisma.user.update({
        where: { id: document.userId },
        data: {
          kycStatus: KYCStatus.APPROVED,
          kycApprovedAt: new Date(),
        },
      });

      // Send approval email
      const firstName = document.user.email!.split('@')[0];
      await this.emailService.sendKycApprovedEmail(
        document.user.email!,
        firstName,
      );
    } else if (anyRejected) {
      userKycStatus = KYCStatus.REJECTED;
      await this.prisma.user.update({
        where: { id: document.userId },
        data: {
          kycStatus: KYCStatus.REJECTED,
          kycRejectedAt: new Date(),
          kycRejectionReason: reviewDto.rejectionReason || 'Document rejected',
        },
      });

      // Send rejection email
      const firstName = document.user.email!.split('@')[0];
      await this.emailService.sendKycRejectedEmail(
        document.user.email!,
        firstName,
      );
    }

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: document.userId,
        action: reviewDto.approve ? AuditAction.KYC_DOCUMENT_APPROVED : AuditAction.KYC_DOCUMENT_REJECTED,
        entityType: 'kyc_document',
        entityId: documentId,
        metadata: {
          reviewerId,
          documentType: document.documentType,
          rejectionReason: reviewDto.rejectionReason,
        },
      },
    });

    this.logger.log(
      `Document ${documentId} ${reviewDto.approve ? 'approved' : 'rejected'} by ${reviewerId}`,
    );

    return {
      documentId,
      status: newStatus,
      userKycStatus,
      message: `Document ${reviewDto.approve ? 'approved' : 'rejected'} successfully`,
    };
  }

  /**
   * Admin: Manually approve entire KYC application
   */
  async manualApprove(userId: string, reviewedBy: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kycDocuments: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    // Update all pending documents to approved
    await this.prisma.kYCDocument.updateMany({
      where: { userId, status: DocumentStatus.PENDING },
      data: {
        status: DocumentStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedBy,
      },
    });

    // Update user status
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KYCStatus.APPROVED,
        kycApprovedAt: new Date(),
      },
    });

    // Send email
    const firstName = user.email!.split('@')[0];
    await this.emailService.sendKycApprovedEmail(user.email!, firstName);

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.KYC_APPROVED,
        entityType: 'user',
        entityId: userId,
        metadata: { manualApproval: true, reviewedBy },
      },
    });

    this.logger.log(`KYC manually approved for user ${userId} by ${reviewedBy}`);

    return { success: true, message: 'KYC approved successfully' };
  }

  /**
   * Admin: Manually reject entire KYC application
   */
  async manualReject(userId: string, reason: string, reviewedBy: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kycDocuments: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update all pending documents to rejected
    await this.prisma.kYCDocument.updateMany({
      where: { userId, status: DocumentStatus.PENDING },
      data: {
        status: DocumentStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedBy,
        rejectionReason: reason,
      },
    });

    // Update user status
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KYCStatus.REJECTED,
        kycRejectedAt: new Date(),
        kycRejectionReason: reason,
      },
    });

    // Send email
    const firstName = user.email!.split('@')[0];
    await this.emailService.sendKycRejectedEmail(user.email!, firstName);

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.KYC_REJECTED,
        entityType: 'user',
        entityId: userId,
        metadata: { manualRejection: true, reviewedBy, reason },
      },
    });

    this.logger.log(`KYC manually rejected for user ${userId} by ${reviewedBy}`);

    return { success: true, message: 'KYC rejected' };
  }

  /**
   * User: Retry KYC after rejection
   */
  async retryKyc(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved. Cannot retry.');
    }

    if (
      user.kycStatus !== KYCStatus.REJECTED &&
      user.kycStatus !== KYCStatus.EXPIRED
    ) {
      throw new BadRequestException('KYC can only be retried after rejection or expiry');
    }

    // Reset user KYC status
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KYCStatus.NOT_STARTED,
        kycSubmittedAt: null,
        kycRejectedAt: null,
        kycRejectionReason: null,
      },
    });

    // Delete old rejected documents from database and S3
    const oldDocuments = await this.prisma.kYCDocument.findMany({
      where: { userId },
    });

    for (const doc of oldDocuments) {
      try {
        await this.s3Service.deleteFile(doc.documentUrl);
        if (doc.backImageUrl) {
          await this.s3Service.deleteFile(doc.backImageUrl);
        }
      } catch (error) {
        this.logger.warn(`Failed to delete document from S3: ${doc.id}`);
      }
    }

    await this.prisma.kYCDocument.deleteMany({ where: { userId } });

    this.logger.log(`KYC retry initiated for user ${userId}`);

    return {
      status: KYCStatus.NOT_STARTED,
      message: 'KYC reset successfully. You can now submit new documents.',
    };
  }
}
