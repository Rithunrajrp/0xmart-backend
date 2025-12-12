import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Injectable()
export class MerchantOnboardingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verify onboarding token validity (Public endpoint)
   */
  async verifyToken(token: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { onboardingToken: token },
      include: {
        user: {
          select: {
            email: true,
            phoneNumber: true,
            countryCode: true,
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Invalid onboarding token');
    }

    // Check if token expired
    if (
      seller.onboardingTokenExpiry &&
      seller.onboardingTokenExpiry < new Date()
    ) {
      throw new BadRequestException('Onboarding token has expired');
    }

    // Check if onboarding already completed
    if (
      seller.status !== 'PENDING_ONBOARDING' &&
      seller.status !== 'DOCUMENTS_PENDING'
    ) {
      throw new BadRequestException(
        'Onboarding already completed or in different status',
      );
    }

    return {
      valid: true,
      companyName: seller.companyName,
      email: seller.email,
      phoneNumber: seller.phone,
      status: seller.status,
      country: seller.country,
    };
  }

  /**
   * Complete onboarding form (Public endpoint with token)
   */
  async completeOnboarding(completeOnboardingDto: CompleteOnboardingDto) {
    const { onboardingToken, ...onboardingData } = completeOnboardingDto;

    const seller = await this.prisma.seller.findUnique({
      where: { onboardingToken },
    });

    if (!seller) {
      throw new NotFoundException('Invalid onboarding token');
    }

    // Check if token expired
    if (
      seller.onboardingTokenExpiry &&
      seller.onboardingTokenExpiry < new Date()
    ) {
      throw new BadRequestException('Onboarding token has expired');
    }

    // Check if already completed
    if (
      seller.status !== 'PENDING_ONBOARDING' &&
      seller.status !== 'DOCUMENTS_PENDING'
    ) {
      throw new BadRequestException('Onboarding form already completed');
    }

    // Update seller with onboarding data
    const updatedSeller = await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        // Parse businessAddress into components (storing full address in addressLine1 for simplicity)
        addressLine1: onboardingData.businessAddress,
        country: onboardingData.country,
        taxId: onboardingData.gstNumber, // GST → taxId
        registrationNumber: onboardingData.cinNumber, // CIN → registrationNumber
        metadata: {
          panNumber: onboardingData.panNumber,
          contactPersonName: onboardingData.contactPersonName,
          contactPersonEmail: onboardingData.contactPersonEmail,
        },
        onboardingCompletedAt: new Date(),
        status: 'DOCUMENTS_PENDING',
      },
    });

    return {
      message: 'Onboarding form completed successfully',
      sellerId: updatedSeller.id,
      status: updatedSeller.status,
      nextStep: 'Upload required documents',
    };
  }

  /**
   * Upload document (Public endpoint with token)
   */
  async uploadDocument(uploadDocumentDto: UploadDocumentDto) {
    const { onboardingToken, ...documentData } = uploadDocumentDto;

    const seller = await this.prisma.seller.findUnique({
      where: { onboardingToken },
    });

    if (!seller) {
      throw new NotFoundException('Invalid onboarding token');
    }

    // Check if token expired
    if (
      seller.onboardingTokenExpiry &&
      seller.onboardingTokenExpiry < new Date()
    ) {
      throw new BadRequestException('Onboarding token has expired');
    }

    // Check if onboarding form completed
    if (seller.status === 'PENDING_ONBOARDING') {
      throw new BadRequestException(
        'Please complete the onboarding form first',
      );
    }

    // Create document record
    const document = await this.prisma.sellerDocument.create({
      data: {
        sellerId: seller.id,
        documentType: documentData.documentType,
        fileName: documentData.fileName,
        documentUrl: documentData.documentUrl,
        mimeType: documentData.mimeType,
        fileSize: documentData.fileSize,
        status: 'PENDING',
      },
    });

    return {
      message: 'Document uploaded successfully',
      documentId: document.id,
      documentType: document.documentType,
      status: document.status,
    };
  }

  /**
   * Submit all documents for review (Public endpoint with token)
   */
  async submitForReview(onboardingToken: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { onboardingToken },
      include: {
        sellerDocuments: true,
      },
    });

    if (!seller) {
      throw new NotFoundException('Invalid onboarding token');
    }

    // Check if token expired
    if (
      seller.onboardingTokenExpiry &&
      seller.onboardingTokenExpiry < new Date()
    ) {
      throw new BadRequestException('Onboarding token has expired');
    }

    // Check if onboarding form completed
    if (seller.status === 'PENDING_ONBOARDING') {
      throw new BadRequestException(
        'Please complete the onboarding form first',
      );
    }

    // Check if documents uploaded
    if (seller.sellerDocuments.length === 0) {
      throw new BadRequestException('Please upload at least one document');
    }

    // For India, check required documents
    if (seller.country?.toLowerCase() === 'india') {
      const documentTypes = seller.sellerDocuments.map(
        (doc) => doc.documentType,
      );
      const requiredDocs = ['gst_certificate', 'pan_card', 'cin_certificate'];
      const missingDocs = requiredDocs.filter(
        (type) => !documentTypes.includes(type),
      );

      if (missingDocs.length > 0) {
        throw new BadRequestException(
          `Missing required documents for India: ${missingDocs.join(', ')}`,
        );
      }
    }

    // Update seller status to UNDER_REVIEW
    const updatedSeller = await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        status: 'UNDER_REVIEW',
        documentsSubmittedAt: new Date(),
      },
    });

    return {
      message: 'Documents submitted for review successfully',
      status: updatedSeller.status,
      documentsCount: seller.sellerDocuments.length,
    };
  }

  /**
   * Get onboarding status (Public endpoint with token)
   */
  async getOnboardingStatus(token: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { onboardingToken: token },
      include: {
        user: {
          select: {
            email: true,
            phoneNumber: true,
          },
        },
        sellerDocuments: {
          select: {
            id: true,
            documentType: true,
            fileName: true,
            status: true,
            rejectionNote: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Invalid onboarding token');
    }

    // Check if token expired
    if (
      seller.onboardingTokenExpiry &&
      seller.onboardingTokenExpiry < new Date()
    ) {
      throw new BadRequestException('Onboarding token has expired');
    }

    return {
      companyName: seller.companyName,
      email: seller.email,
      phoneNumber: seller.phone,
      status: seller.status,
      onboardingCompletedAt: seller.onboardingCompletedAt,
      documentsSubmittedAt: seller.documentsSubmittedAt,
      approvedAt: seller.approvedAt,
      activatedAt: seller.activatedAt,
      rejectionReason: seller.rejectionReason,
      documents: seller.sellerDocuments,
      progress: {
        formCompleted: !!seller.onboardingCompletedAt,
        documentsUploaded: seller.sellerDocuments.length > 0,
        documentsSubmitted: !!seller.documentsSubmittedAt,
        approved: !!seller.approvedAt,
        activated: !!seller.activatedAt,
      },
    };
  }
}
