import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MockKycService {
  private readonly logger = new Logger(MockKycService.name);
  private mockApplicants = new Map<string, any>();

  createApplicant(
    userId: string,
    email: string,
    firstName?: string,
    lastName?: string,
  ) {
    const applicantId = `mock_${userId}_${Date.now()}`;

    this.mockApplicants.set(applicantId, {
      id: applicantId,
      userId,
      email,
      firstName,
      lastName,
      status: 'PENDING',
      createdAt: new Date(),
    });

    this.logger.log(
      `Mock KYC applicant created: ${applicantId} for user ${userId}`,
    );

    return {
      applicantId,
      status: 'PENDING',
    };
  }

  generateAccessToken(applicantId: string) {
    const token = `mock_token_${applicantId}_${Date.now()}`;

    this.logger.log(`Mock access token generated for: ${applicantId}`);

    return {
      token,
      userId: applicantId,
    };
  }

  getApplicantStatus(applicantId: string) {
    const applicant = this.mockApplicants.get(applicantId);

    if (!applicant) {
      return {
        reviewStatus: 'NOT_FOUND',
        reviewResult: null,
        moderationComment: null,
      };
    }

    return {
      reviewStatus: applicant.status,
      reviewResult:
        applicant.status === 'APPROVED' ? { reviewAnswer: 'GREEN' } : null,

      moderationComment: applicant.comment || null,
    };
  }

  approveApplicant(applicantId: string) {
    const applicant = this.mockApplicants.get(applicantId);
    if (applicant) {
      applicant.status = 'APPROVED';
      this.mockApplicants.set(applicantId, applicant);
      this.logger.log(`Mock applicant approved: ${applicantId}`);
    }
  }

  rejectApplicant(applicantId: string, reason: string) {
    const applicant = this.mockApplicants.get(applicantId);
    if (applicant) {
      applicant.status = 'REJECTED';

      applicant.comment = reason;
      this.mockApplicants.set(applicantId, applicant);
      this.logger.log(`Mock applicant rejected: ${applicantId}`);
    }
  }

  resetApplicant(applicantId: string) {
    const applicant = this.mockApplicants.get(applicantId);
    if (applicant) {
      applicant.status = 'PENDING';

      applicant.comment = null;
      this.mockApplicants.set(applicantId, applicant);
      this.logger.log(`Mock applicant reset: ${applicantId}`);
    }
    return { success: true };
  }
}
