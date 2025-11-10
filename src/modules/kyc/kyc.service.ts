import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SumsubService } from './services/sumsub.service';
import { MockKycService } from './services/mock-kyc.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KYCStatus } from '@prisma/client';
import { EmailService } from '../auth/services/email.service';

type ApplicantCreateResult = { applicantId: string };
type AccessTokenResult = { token: string };

/**
 * Minimal interface representing the methods the KYC provider services must expose.
 * Both SumsubService and MockKycService should implement these signatures.
 */
interface IKycProvider {
  createApplicant(
    userId: string,
    email?: string | null,
    firstName?: string | null,
    lastName?: string | null,
  ): Promise<ApplicantCreateResult>;
  generateAccessToken(applicantId: string): Promise<AccessTokenResult>;
  getApplicantStatus(
    applicantId: string,
  ): Promise<Record<string, unknown> | null>;
  resetApplicant(applicantId: string): Promise<void>;
}

interface KycWebhookPayload {
  applicantId: string;
  reviewStatus: string; // e.g. 'approved', 'rejected', 'pending', 'completed'
  reviewRejectType?: string | null;
  clientComment?: string | null;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly useMockKyc: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private sumsubService: SumsubService,
    private mockKycService: MockKycService,
    private emailService: EmailService,
  ) {
    const appToken = this.configService.get<string>('kyc.appToken') ?? '';
    this.useMockKyc = appToken.trim() === '';
    if (this.useMockKyc) {
      this.logger.warn('🧪 Using MOCK KYC service (no real verification)');
    } else {
      this.logger.log('✅ Using Sumsub KYC service');
    }
  }

  private getKycService(): IKycProvider {
    return this.useMockKyc
      ? (this.mockKycService as unknown as IKycProvider)
      : (this.sumsubService as unknown as IKycProvider);
  }

  async initiateKyc(userId: string, submitKycDto?: SubmitKycDto) {
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

    const kycService = this.getKycService();

    try {
      const applicantResult = await kycService.createApplicant(
        userId,
        user.email ?? null,
        submitKycDto?.firstName ?? null,
        submitKycDto?.lastName ?? null,
      );

      const applicantId = applicantResult.applicantId;

      const tokenResult = await kycService.generateAccessToken(applicantId);
      const token = tokenResult.token;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          kycProviderId: applicantId,
          kycStatus: KYCStatus.PENDING,
          kycData: submitKycDto
            ? (submitKycDto as unknown as Record<string, any>)
            : {},
        },
      });

      await this.prisma.kYCDocument.create({
        data: {
          userId,
          documentType: submitKycDto?.documentType ?? 'general',
          status: KYCStatus.PENDING,
          documentUrl: '',
        },
      });

      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'KYC_SUBMITTED',
          entityType: 'user',
          entityId: userId,
          metadata: { applicantId },
        },
      });

      this.logger.log(
        `KYC initiated for user ${userId}, applicant: ${applicantId}`,
      );

      const sdkUrl = this.useMockKyc
        ? `mock://kyc-verification/${applicantId}`
        : `https://api.sumsub.com/idensic/websdk?token=${encodeURIComponent(token)}`;

      return {
        applicantId,
        accessToken: token,
        sdkUrl,
        status: KYCStatus.PENDING,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      };
    } catch (error) {
      this.logger.error(
        `Failed to initiate KYC for user ${userId}: ${String(error)}`,
      );
      // Re-throw a BadRequest with safer message for API consumers
      throw new BadRequestException('Failed to initiate KYC verification');
    }
  }

  async getKycStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycDocuments: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let providerStatus: Record<string, unknown> | null = null;

    if (user.kycProviderId) {
      try {
        const kycService = this.getKycService();
        providerStatus = await kycService.getApplicantStatus(
          user.kycProviderId,
        );
      } catch (error) {
        this.logger.error(
          `Failed to fetch KYC status from provider: ${String(error)}`,
        );
        providerStatus = null;
      }
    }

    return {
      userId: user.id,
      kycStatus: user.kycStatus,
      applicantId: user.kycProviderId ?? null,
      providerStatus,
      documents: user.kycDocuments ?? [],
      canRetry:
        user.kycStatus === KYCStatus.REJECTED ||
        user.kycStatus === KYCStatus.EXPIRED,
    };
  }

  async handleWebhook(webhookData: KycWebhookPayload) {
    const { applicantId, reviewStatus, reviewRejectType, clientComment } =
      webhookData;

    this.logger.log(
      `KYC webhook received for applicant: ${applicantId}, status: ${reviewStatus}`,
    );

    const user = await this.prisma.user.findFirst({
      where: { kycProviderId: applicantId },
    });

    if (!user) {
      this.logger.warn(`User not found for applicant: ${applicantId}`);
      return { success: false, message: 'User not found' };
    }

    let kycStatus: KYCStatus;
    if (reviewStatus === 'completed' || reviewStatus === 'approved') {
      kycStatus = KYCStatus.APPROVED;
      const firstName = user.email!.split('@')[0];
      await this.emailService.sendKycApprovedEmail(user.email!, firstName);
    } else if (reviewStatus === 'rejected') {
      kycStatus = KYCStatus.REJECTED;
      const firstName = user.email!.split('@')[0];
      await this.emailService.sendKycRejectedEmail(user.email!, firstName);
    } else {
      kycStatus = KYCStatus.PENDING;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { kycStatus },
    });

    await this.prisma.kYCDocument.updateMany({
      where: {
        userId: user.id,
        status: KYCStatus.PENDING,
      },
      data: {
        status: kycStatus,
        reviewedAt: new Date(),
        rejectionReason: reviewRejectType ?? clientComment ?? null,
      },
    });

    const action =
      kycStatus === KYCStatus.APPROVED
        ? 'KYC_APPROVED'
        : kycStatus === KYCStatus.REJECTED
          ? 'KYC_REJECTED'
          : 'KYC_UPDATED';

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action,
        entityType: 'user',
        entityId: user.id,
        metadata: {
          applicantId,
          reviewStatus,
          reviewRejectType,
        },
      },
    });

    this.logger.log(`KYC status updated for user ${user.id}: ${kycStatus}`);

    // TODO: Send notification to user (e.g., email)
    return { success: true, userId: user.id, status: kycStatus };
  }

  async retryKyc(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved. Cannot retry.');
    }

    if (!user.kycProviderId) {
      throw new BadRequestException('No previous KYC attempt found');
    }

    const kycService = this.getKycService();

    try {
      await kycService.resetApplicant(user.kycProviderId);

      const tokenResult = await kycService.generateAccessToken(
        user.kycProviderId,
      );
      const token = tokenResult.token;

      await this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: KYCStatus.PENDING },
      });

      this.logger.log(`KYC retry initiated for user ${userId}`);

      const sdkUrl = this.useMockKyc
        ? `mock://kyc-verification/${user.kycProviderId}`
        : `https://api.sumsub.com/idensic/websdk?token=${encodeURIComponent(token)}`;

      return {
        applicantId: user.kycProviderId,
        accessToken: token,
        sdkUrl,
        status: KYCStatus.PENDING,
      };
    } catch (error) {
      this.logger.error(
        `Failed to retry KYC for user ${userId}: ${String(error)}`,
      );
      throw new BadRequestException('Failed to retry KYC verification');
    }
  }

  // Admin functions
  async getAllKycApplications(filters?: {
    status?: KYCStatus;
    page?: number;
    limit?: number;
  }) {
    const { status, page = 1, limit = 20 } = filters ?? {};
    const skip = (page - 1) * limit;

    const whereClause: { kycStatus?: KYCStatus } = {};
    if (status) whereClause.kycStatus = status;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          kycStatus: true,
          kycProviderId: true,
          kycData: true,
          createdAt: true,
          kycDocuments: {
            orderBy: { submittedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
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

  async manualApprove(userId: string, reviewedBy: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus: KYCStatus.APPROVED },
    });

    await this.prisma.kYCDocument.updateMany({
      where: { userId, status: KYCStatus.PENDING },
      data: {
        status: KYCStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedBy,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'KYC_APPROVED',
        entityType: 'user',
        entityId: userId,
        metadata: { manualApproval: true, reviewedBy },
      },
    });

    this.logger.log(
      `KYC manually approved for user ${userId} by ${reviewedBy}`,
    );

    return { success: true, message: 'KYC approved successfully' };
  }

  async manualReject(userId: string, reason: string, reviewedBy: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus: KYCStatus.REJECTED },
    });

    await this.prisma.kYCDocument.updateMany({
      where: { userId, status: KYCStatus.PENDING },
      data: {
        status: KYCStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedBy,
        rejectionReason: reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'KYC_REJECTED',
        entityType: 'user',
        entityId: userId,
        metadata: { manualRejection: true, reviewedBy, reason },
      },
    });

    this.logger.log(
      `KYC manually rejected for user ${userId} by ${reviewedBy}`,
    );

    return { success: true, message: 'KYC rejected' };
  }

  // For testing with mock service
  async mockApprove(userId: string) {
    if (!this.useMockKyc) {
      throw new BadRequestException('Not using mock KYC service');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.kycProviderId) {
      throw new NotFoundException('User or KYC application not found');
    }

    this.mockKycService.approveApplicant(user.kycProviderId);

    await this.handleWebhook({
      applicantId: user.kycProviderId,
      reviewStatus: 'approved',
      reviewRejectType: null,
      clientComment: 'Mock approval',
    });

    return { success: true, message: 'Mock KYC approved' };
  }

  async mockReject(userId: string, reason: string) {
    if (!this.useMockKyc) {
      throw new BadRequestException('Not using mock KYC service');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.kycProviderId) {
      throw new NotFoundException('User or KYC application not found');
    }

    this.mockKycService.rejectApplicant(user.kycProviderId, reason);

    await this.handleWebhook({
      applicantId: user.kycProviderId,
      reviewStatus: 'rejected',
      reviewRejectType: 'FINAL',
      clientComment: reason,
    });

    return { success: true, message: 'Mock KYC rejected' };
  }
}
