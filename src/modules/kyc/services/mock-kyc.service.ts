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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const applicant = this.mockApplicants.get(applicantId);

    if (!applicant) {
      return {
        reviewStatus: 'NOT_FOUND',
        reviewResult: null,
        moderationComment: null,
      };
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      reviewStatus: applicant.status,
      reviewResult:
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        applicant.status === 'APPROVED' ? { reviewAnswer: 'GREEN' } : null,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      moderationComment: applicant.comment || null,
    };
  }

  approveApplicant(applicantId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const applicant = this.mockApplicants.get(applicantId);
    if (applicant) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      applicant.status = 'APPROVED';
      this.mockApplicants.set(applicantId, applicant);
      this.logger.log(`Mock applicant approved: ${applicantId}`);
    }
  }

  rejectApplicant(applicantId: string, reason: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const applicant = this.mockApplicants.get(applicantId);
    if (applicant) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      applicant.status = 'REJECTED';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      applicant.comment = reason;
      this.mockApplicants.set(applicantId, applicant);
      this.logger.log(`Mock applicant rejected: ${applicantId}`);
    }
  }

  resetApplicant(applicantId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const applicant = this.mockApplicants.get(applicantId);
    if (applicant) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      applicant.status = 'PENDING';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      applicant.comment = null;
      this.mockApplicants.set(applicantId, applicant);
      this.logger.log(`Mock applicant reset: ${applicantId}`);
    }
    return { success: true };
  }
}
