import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { ApproveDocumentDto } from './dto/approve-document.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class MerchantManagementService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new merchant with onboarding link (Super Admin only)
   */
  async createMerchant(
    createMerchantDto: CreateMerchantDto,
    createdById: string,
  ) {
    const { email, countryCode, phoneNumber, companyName } = createMerchantDto;

    // Check if user already exists with this email
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUserByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    // Check if user exists with this phone number
    const existingUserByPhone = await this.prisma.user.findFirst({
      where: {
        phoneNumber,
        countryCode,
      },
    });

    if (existingUserByPhone) {
      throw new ConflictException('User with this phone number already exists');
    }

    // Generate unique onboarding token
    const onboardingToken = randomBytes(32).toString('hex');
    const onboardingTokenExpiry = new Date();
    onboardingTokenExpiry.setDate(onboardingTokenExpiry.getDate() + 7); // 7 days expiry

    // Create user and seller in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user with MERCHANT role but SUSPENDED status (cannot login yet)
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          phoneNumber,
          countryCode,
          role: 'USER', // Merchants are users with seller profile
          status: 'SUSPENDED', // Cannot login until ACTIVE
          kycStatus: 'NOT_STARTED',
        },
      });

      // Create seller profile with PENDING_ONBOARDING status
      const seller = await tx.seller.create({
        data: {
          userId: user.id,
          email: email.toLowerCase(), // REQUIRED field
          companyName,
          sellerType: 'INDIVIDUAL', // REQUIRED field - default to INDIVIDUAL
          country: 'Unknown', // REQUIRED field - will be updated during onboarding
          phone: `${countryCode}${phoneNumber}`, // Store full phone with country code
          status: 'PENDING_ONBOARDING',
          onboardingToken,
          onboardingTokenExpiry,
          isInhouse: false, // External merchant
        },
      });

      return { user, seller, onboardingToken };
    });

    return {
      id: result.seller.id,
      userId: result.user.id,
      email: result.user.email,
      phoneNumber: result.user.phoneNumber,
      countryCode: result.user.countryCode,
      companyName: result.seller.companyName,
      status: result.seller.status,
      onboardingToken: result.onboardingToken,
      onboardingTokenExpiry: result.seller.onboardingTokenExpiry,
      onboardingLink: `${process.env.FRONTEND_URL}/merchant/onboarding/${result.onboardingToken}`,
    };
  }

  /**
   * Get all merchants with pagination and filtering
   */
  async getAllMerchants(
    page: number = 1,
    limit: number = 20,
    status?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [merchants, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
              countryCode: true,
              status: true,
            },
          },
          _count: {
            select: {
              products: true,
              sellerDocuments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.seller.count({ where }),
    ]);

    return {
      merchants: merchants.map((seller) => ({
        id: seller.id,
        userId: seller.userId,
        email: seller.email,
        phoneNumber: seller.phone,
        companyName: seller.companyName,
        status: seller.status,
        isInhouse: seller.isInhouse,
        onboardingCompletedAt: seller.onboardingCompletedAt,
        documentsSubmittedAt: seller.documentsSubmittedAt,
        approvedAt: seller.approvedAt,
        activatedAt: seller.activatedAt,
        productsCount: seller._count.products,
        documentsCount: seller._count.sellerDocuments,
        createdAt: seller.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get merchant details by ID
   */
  async getMerchantById(id: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            countryCode: true,
            status: true,
            createdAt: true,
          },
        },
        sellerDocuments: {
          orderBy: { uploadedAt: 'desc' },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Merchant not found');
    }

    return {
      id: seller.id,
      userId: seller.userId,
      email: seller.email,
      phoneNumber: seller.phone,
      companyName: seller.companyName,
      addressLine1: seller.addressLine1,
      addressLine2: seller.addressLine2,
      city: seller.city,
      state: seller.state,
      postalCode: seller.postalCode,
      country: seller.country,
      taxId: seller.taxId, // This is GST number
      registrationNumber: seller.registrationNumber, // This is CIN
      status: seller.status,
      isInhouse: seller.isInhouse,
      onboardingCompletedAt: seller.onboardingCompletedAt,
      documentsSubmittedAt: seller.documentsSubmittedAt,
      approvedAt: seller.approvedAt,
      approvedBy: seller.approvedBy,
      activatedAt: seller.activatedAt,
      activatedBy: seller.activatedBy,
      rejectionReason: seller.rejectionReason,
      verifiedAt: seller.verifiedAt,
      verifiedBy: seller.verifiedBy,
      sellerDocuments: seller.sellerDocuments,
      productsCount: seller._count.products,
      createdAt: seller.createdAt,
      updatedAt: seller.updatedAt,
    };
  }

  /**
   * Get all documents for a merchant
   */
  async getMerchantDocuments(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Merchant not found');
    }

    const documents = await this.prisma.sellerDocument.findMany({
      where: { sellerId },
      orderBy: { uploadedAt: 'desc' },
    });

    return documents;
  }

  /**
   * Approve a merchant document (Admin or Super Admin)
   */
  async approveDocument(
    documentId: string,
    approveDto: ApproveDocumentDto,
    reviewedById: string,
  ) {
    const document = await this.prisma.sellerDocument.findUnique({
      where: { id: documentId },
      include: { seller: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status === 'APPROVED') {
      throw new BadRequestException('Document is already approved');
    }

    // Update document status
    const updatedDocument = await this.prisma.sellerDocument.update({
      where: { id: documentId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: reviewedById,
        rejectionNote: null, // Clear any previous rejection notes
      },
    });

    // Check if all documents are approved
    const allDocuments = await this.prisma.sellerDocument.findMany({
      where: { sellerId: document.sellerId },
    });

    const allApproved = allDocuments.every((doc) => doc.status === 'APPROVED');

    // If all documents approved, update seller status to APPROVED
    if (allApproved && document.seller.status === 'UNDER_REVIEW') {
      await this.prisma.seller.update({
        where: { id: document.sellerId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: reviewedById,
        },
      });
    }

    return updatedDocument;
  }

  /**
   * Reject a merchant document (Admin or Super Admin)
   */
  async rejectDocument(
    documentId: string,
    rejectDto: RejectDocumentDto,
    reviewedById: string,
  ) {
    const document = await this.prisma.sellerDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Update document status
    const updatedDocument = await this.prisma.sellerDocument.update({
      where: { id: documentId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: reviewedById,
        rejectionNote: rejectDto.rejectionNote,
      },
    });

    // Update seller status back to DOCUMENTS_PENDING if currently UNDER_REVIEW
    const seller = await this.prisma.seller.findUnique({
      where: { id: document.sellerId },
    });

    if (seller && seller.status === 'UNDER_REVIEW') {
      await this.prisma.seller.update({
        where: { id: document.sellerId },
        data: {
          status: 'DOCUMENTS_PENDING',
        },
      });
    }

    return updatedDocument;
  }

  /**
   * Activate merchant account (Super Admin only)
   */
  async activateMerchant(sellerId: string, activatedById: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: { user: true },
    });

    if (!seller) {
      throw new NotFoundException('Merchant not found');
    }

    if (seller.status !== 'APPROVED') {
      throw new BadRequestException(
        'Can only activate merchants with APPROVED status. Current status: ' +
          seller.status,
      );
    }

    // Update seller and user in transaction
    await this.prisma.$transaction(async (tx) => {
      // Update seller status to ACTIVE
      await tx.seller.update({
        where: { id: sellerId },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          activatedBy: activatedById,
        },
      });

      // Update user status to ACTIVE (allow login)
      await tx.user.update({
        where: { id: seller.userId! }, // Non-null assertion since we know it exists
        data: {
          status: 'ACTIVE',
        },
      });
    });

    return { message: 'Merchant activated successfully' };
  }

  /**
   * Suspend merchant account (Admin or Super Admin)
   */
  async suspendMerchant(sellerId: string, reason?: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: { user: true },
    });

    if (!seller) {
      throw new NotFoundException('Merchant not found');
    }

    // Update seller and user in transaction
    await this.prisma.$transaction(async (tx) => {
      // Update seller status to SUSPENDED
      await tx.seller.update({
        where: { id: sellerId },
        data: {
          status: 'SUSPENDED',
          rejectionReason: reason,
        },
      });

      // Update user status to SUSPENDED (block login)
      await tx.user.update({
        where: { id: seller.userId! }, // Non-null assertion since we know it exists
        data: {
          status: 'SUSPENDED',
        },
      });
    });

    return { message: 'Merchant suspended successfully' };
  }
}
