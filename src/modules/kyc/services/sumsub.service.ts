import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class SumsubService {
  private readonly logger = new Logger(SumsubService.name);
  private readonly client: AxiosInstance;
  private readonly appToken: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly levelName = 'basic-kyc-level'; // Configure your level in Sumsub

  constructor(private configService: ConfigService) {
    this.appToken = this.configService.get<string>('kyc.appToken') ?? '';
    this.secretKey = this.configService.get<string>('kyc.secretKey') ?? '';
    this.baseUrl = this.configService.get<string>('kyc.baseUrl') ?? '';

    if (!this.appToken || !this.secretKey) {
      this.logger.warn(
        '⚠️ Sumsub credentials not configured. KYC will not work.',
      );
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private generateSignature(
    method: string,
    url: string,
    timestamp: number,
    body?: any,
  ): string {
    const bodyString = body ? JSON.stringify(body) : '';
    const message = `${timestamp}${method}${url}${bodyString}`;
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex');
  }

  private getHeaders(method: string, url: string, body?: any) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(method, url, timestamp, body);

    return {
      'X-App-Token': this.appToken,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': timestamp.toString(),
    };
  }

  async createApplicant(
    userId: string,
    email: string,
    firstName?: string,
    lastName?: string,
  ) {
    if (!this.appToken || !this.secretKey) {
      throw new BadRequestException('KYC service not configured');
    }

    try {
      const url = '/resources/applicants';
      const body = {
        externalUserId: userId,
        email: email,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
      };

      const response = await this.client.post(url, body, {
        headers: this.getHeaders('POST', url, body),
      });

      this.logger.log(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Sumsub applicant created: ${response.data.id} for user ${userId}`,
      );

      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        applicantId: response.data.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        status: response.data.review?.reviewStatus || 'init',
      };
    } catch (error) {
      this.logger.error(`Failed to create Sumsub applicant: ${error}`);
      if (error) {
        this.logger.error(`Sumsub error details: ${JSON.stringify(error)}`);
      }
      throw new BadRequestException('Failed to create KYC session');
    }
  }

  async generateAccessToken(applicantId: string, levelName?: string) {
    if (!this.appToken || !this.secretKey) {
      throw new BadRequestException('KYC service not configured');
    }

    try {
      const level = levelName || this.levelName;
      const url = `/resources/accessTokens?userId=${applicantId}&levelName=${level}`;

      const response = await this.client.post(
        url,
        {},
        {
          headers: this.getHeaders('POST', url),
        },
      );

      this.logger.log(`Access token generated for applicant: ${applicantId}`);

      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        token: response.data.token,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        userId: response.data.userId,
      };
    } catch (error) {
      this.logger.error(`Failed to generate access token: ${error}`);
      throw new BadRequestException('Failed to generate KYC access token');
    }
  }

  async getApplicantStatus(applicantId: string) {
    if (!this.appToken || !this.secretKey) {
      throw new BadRequestException('KYC service not configured');
    }

    try {
      const url = `/resources/applicants/${applicantId}/status`;

      interface SumsubStatusResponse {
        reviewStatus: string;
        reviewResult: string;
        moderationComment: string;
      }

      const response = await this.client.get<SumsubStatusResponse>(url, {
        headers: this.getHeaders('GET', url),
      });

      return {
        reviewStatus: response.data.reviewStatus,
        reviewResult: response.data.reviewResult,
        moderationComment: response.data.moderationComment,
      };
    } catch (error) {
      this.logger.error(`Failed to get applicant status: ${error}`);
      throw new BadRequestException('Failed to get KYC status');
    }
  }

  async resetApplicant(applicantId: string) {
    if (!this.appToken || !this.secretKey) {
      throw new BadRequestException('KYC service not configured');
    }

    try {
      const url = `/resources/applicants/${applicantId}/reset`;

      await this.client.post(
        url,
        {},
        {
          headers: this.getHeaders('POST', url),
        },
      );

      this.logger.log(`Applicant reset: ${applicantId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to reset applicant: ${error}`);
      throw new BadRequestException('Failed to reset KYC');
    }
  }

  mapSumsubStatusToKycStatus(sumsubStatus: string): string {
    const statusMap: Record<string, string> = {
      init: 'PENDING',
      pending: 'PENDING',
      prechecked: 'PENDING',
      queued: 'PENDING',
      completed: 'APPROVED',
      onHold: 'PENDING',
      actionRequired: 'PENDING',
      approved: 'APPROVED',
      rejected: 'REJECTED',
    };

    return statusMap[sumsubStatus] || 'PENDING';
  }
}
