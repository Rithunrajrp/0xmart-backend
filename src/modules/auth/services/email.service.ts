import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('✅ SendGrid initialized');
    } else {
      this.logger.warn(
        '⚠️ SendGrid API key not found. Emails will not be sent.',
      );
    }
  }

  async sendOtpEmail(
    email: string,
    otp: string,
    firstName?: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');
    if (!apiKey) {
      this.logger.warn(
        `SendGrid not configured. Would send OTP ${otp} to ${email}`,
      );
      return;
    }

    try {
      const templateId = this.configService.get<string>(
        'sendgrid.otpTemplateId',
      );
      const fromEmail = this.configService.get<string>('sendgrid.fromEmail');
      const fromName =
        this.configService.get<string>('sendgrid.fromName') || '0xMart';

      if (!fromEmail || !templateId) {
        this.logger.error(
          '❌ Missing SendGrid configuration: fromEmail or templateId.',
        );
        return;
      }

      const msg = {
        to: email,
        from: { email: fromEmail, name: fromName },
        templateId,
        dynamicTemplateData: {
          first_name: firstName || email.split('@')[0],
          otp,
          support_link:
            this.configService.get<string>('sendgrid.supportLink') ||
            'https://support.0xmart.com/help',
        },
      };

      await sgMail.send(msg);
      this.logger.log(`✅ OTP email sent to ${email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send OTP email: ${error}`);
      if (error) {
        this.logger.error(`SendGrid Error: ${JSON.stringify(error)}`);
      }
      throw new Error('Failed to send OTP email');
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');
    if (!apiKey) return;

    try {
      const templateId = this.configService.get<string>(
        'sendgrid.welcomeTemplateId',
      );
      const fromEmail = this.configService.get<string>('sendgrid.fromEmail');
      const fromName =
        this.configService.get<string>('sendgrid.fromName') || '0xMart';

      if (!templateId || !fromEmail) return;

      await sgMail.send({
        to: email,
        from: { email: fromEmail, name: fromName },
        templateId,
        dynamicTemplateData: { first_name: firstName },
      });

      this.logger.log(`✅ Welcome email sent to ${email}`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to send welcome email: ${error}`);
    }
  }

  async sendTransactionEmail(
    email: string,
    transactionData: {
      firstName: string;
      transactionType: string;
      amount: string;
      currency: string;
      transactionId: string;
    },
  ): Promise<void> {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');
    if (!apiKey) return;

    try {
      const templateId = this.configService.get<string>(
        'sendgrid.transactionTemplateId',
      );
      const fromEmail = this.configService.get<string>('sendgrid.fromEmail');
      const fromName =
        this.configService.get<string>('sendgrid.fromName') || '0xMart';

      if (!templateId || !fromEmail) return;

      await sgMail.send({
        to: email,
        from: { email: fromEmail, name: fromName },
        templateId,
        dynamicTemplateData: transactionData,
      });

      this.logger.log(`✅ Transaction email sent to ${email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send transaction email: ${error}`);
    }
  }

  async sendDepositConfirmedEmail(
    email: string,
    userId: string,
    amount: string,
    stablecoin: string,
    txHash: string,
    network: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');

    if (!apiKey) {
      this.logger.warn(
        `Would send deposit email to ${email}: ${amount} ${stablecoin}`,
      );
      return;
    }

    try {
      const depositTemplateId = this.configService.get<string>(
        'sendgrid.depositTemplateId',
      );
      const fromEmail = this.configService.get<string>('sendgrid.fromEmail');
      const fromName =
        this.configService.get<string>('sendgrid.fromName') || '0xMart';

      // Block explorer URLs
      const explorerUrls: Record<string, string> = {
        ETHEREUM: `https://etherscan.io/tx/${txHash}`,
        POLYGON: `https://polygonscan.com/tx/${txHash}`,
        BSC: `https://bscscan.com/tx/${txHash}`,
        ARBITRUM: `https://arbiscan.io/tx/${txHash}`,
        OPTIMISM: `https://optimistic.etherscan.io/tx/${txHash}`,
      };

      if (!depositTemplateId || !fromEmail) {
        this.logger.error(
          '❌ Missing SendGrid configuration: fromEmail or depositTemplateId.',
        );
        return;
      }

      const msg = {
        to: email,
        from: {
          email: fromEmail,
          name: fromName,
        },
        templateId: depositTemplateId,
        dynamicTemplateData: {
          amount: amount,
          stablecoin: stablecoin,
          tx_hash: txHash,
          network: network,
          explorer_url: explorerUrls[network] || '#',
          dashboard_url: `https://yourdomain.com/dashboard`,
        },
      };

      await sgMail.send(msg);
      this.logger.log(`✅ Deposit confirmation email sent to ${email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send deposit email: ${error.message}`);
    }
  }

  async sendWithdrawalCompletedEmail(
    email: string,
    userId: string,
    amount: string,
    stablecoin: string,
    toAddress: string,
    txHash: string,
    network: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');

    if (!apiKey) {
      this.logger.warn(
        `Would send withdrawal email to ${email}: ${amount} ${stablecoin}`,
      );
      return;
    }

    try {
      const withdrawalTemplateId = this.configService.get<string>(
        'sendgrid.withdrawalTemplateId',
      );
      const fromEmail = this.configService.get<string>('sendgrid.fromEmail');
      const fromName =
        this.configService.get<string>('sendgrid.fromName') || '0xMart';

      if (!fromEmail || !withdrawalTemplateId) {
        this.logger.error('Missing SendGrid configuration values.');
        return;
      }

      const explorerUrls: Record<string, string> = {
        ETHEREUM: `https://etherscan.io/tx/${txHash}`,
        POLYGON: `https://polygonscan.com/tx/${txHash}`,
        BSC: `https://bscscan.com/tx/${txHash}`,
        ARBITRUM: `https://arbiscan.io/tx/${txHash}`,
        OPTIMISM: `https://optimistic.etherscan.io/tx/${txHash}`,
      };

      const msg = {
        to: email,
        from: { email: fromEmail, name: fromName },
        templateId: withdrawalTemplateId,
        dynamicTemplateData: {
          amount: amount,
          stablecoin: stablecoin,
          to_address: toAddress,
          tx_hash: txHash,
          network: network,
          explorer_url: explorerUrls[network] || '#',
        },
      };

      await sgMail.send(msg);
      this.logger.log(`✅ Withdrawal completion email sent to ${email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send withdrawal email: ${error.message}`);
    }
  }

  async sendWithdrawalFailedEmail(
    email: string,
    userId: string,
    amount: string,
    stablecoin: string,
    reason: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');

    if (!apiKey) {
      this.logger.warn(
        `Would send withdrawal failed email to ${email} with userId ${userId}`,
      );
      return;
    }

    try {
      const failedTemplateId = this.configService.get<string>(
        'sendgrid.withdrawalFailedTemplateId',
      );
      const fromEmail = this.configService.get<string>('sendgrid.fromEmail');

      if (!failedTemplateId || !fromEmail) {
        this.logger.error(
          '❌ Missing SendGrid configuration: fromEmail or withdrawalFailedTemplateId.',
        );
        return;
      }

      const fromName =
        this.configService.get<string>('sendgrid.fromName') || '0xMart';

      const msg = {
        to: email,
        from: { email: fromEmail, name: fromName },
        templateId: failedTemplateId,
        dynamicTemplateData: {
          amount: amount,
          stablecoin: stablecoin,
          reason: reason,
          support_link: 'https://support.0xmart.com',
        },
      };

      await sgMail.send(msg);
      this.logger.log(`✅ Withdrawal failed email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send withdrawal failed email: ${error.message}`,
      );
    }
  }

  async sendKycApprovedEmail(email: string, firstName?: string): Promise<void> {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');
    const templateId = this.configService.get<string>(
      'sendgrid.kycApprovedTemplateId',
    );
    const fromEmail = this.configService.get<string>('sendgrid.fromEmail');
    const fromName =
      this.configService.get<string>('sendgrid.fromName') || '0xMart';

    if (!apiKey || !fromEmail || !templateId) {
      this.logger.error(
        '❌ Missing SendGrid configuration for KYC Approved Email',
      );
      return;
    }

    try {
      const msg = {
        to: email,
        from: { email: fromEmail, name: fromName },
        templateId,
        dynamicTemplateData: {
          first_name: firstName || email.split('@')[0],
          support_link:
            this.configService.get<string>('sendgrid.supportLink') ||
            'https://support.0xmart.com/help',
        },
      };

      await sgMail.send(msg);
      this.logger.log(`✅ KYC Approved email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send KYC Approved email: ${error.message}`,
      );
    }
  }

  async sendKycRejectedEmail(
    email: string,
    reason?: string,
    firstName?: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');
    const templateId = this.configService.get<string>(
      'sendgrid.kycRejectedTemplateId',
    );
    const fromEmail = this.configService.get<string>('sendgrid.fromEmail');
    const fromName =
      this.configService.get<string>('sendgrid.fromName') || '0xMart';

    if (!apiKey || !fromEmail || !templateId) {
      this.logger.error(
        '❌ Missing SendGrid configuration for KYC Rejected Email',
      );
      return;
    }

    try {
      const msg = {
        to: email,
        from: { email: fromEmail, name: fromName },
        templateId,
        dynamicTemplateData: {
          first_name: firstName || email.split('@')[0],
          reason:
            reason ||
            'Your KYC application did not meet our verification requirements.',
          support_link:
            this.configService.get<string>('sendgrid.supportLink') ||
            'https://support.0xmart.com/help',
        },
      };

      await sgMail.send(msg);
      this.logger.log(`✅ KYC Rejected email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send KYC Rejected email: ${error.message}`,
      );
    }
  }

  async sendMerchantOnboardingEmail(
    email: string,
    companyName: string,
    onboardingLink: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');

    if (!apiKey) {
      this.logger.warn(
        `Would send merchant onboarding email to ${email} for ${companyName}`,
      );
      this.logger.warn(`Onboarding link: ${onboardingLink}`);
      return;
    }

    try {
      const templateId = this.configService.get<string>(
        'sendgrid.merchantOnboardingTemplateId',
      );
      const fromEmail = this.configService.get<string>('sendgrid.fromEmail');
      const fromName =
        this.configService.get<string>('sendgrid.fromName') || '0xMart';

      // If no template configured, send simple email
      if (!templateId || !fromEmail) {
        this.logger.warn(
          '❌ Missing SendGrid configuration for Merchant Onboarding Email. Sending simple email instead.',
        );

        const simpleMsg = {
          to: email,
          from: { email: fromEmail || 'noreply@0xmart.com', name: fromName },
          subject: 'Complete Your Merchant Onboarding - 0xMart',
          text: `Hello ${companyName},\n\nWelcome to 0xMart! Please complete your merchant onboarding by clicking the link below:\n\n${onboardingLink}\n\nThis link will expire in 7 days.\n\nIf you have any questions, please contact our support team.\n\nBest regards,\n0xMart Team`,
          html: `
            <p>Hello <strong>${companyName}</strong>,</p>
            <p>Welcome to 0xMart! Please complete your merchant onboarding by clicking the link below:</p>
            <p><a href="${onboardingLink}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Complete Onboarding</a></p>
            <p>Or copy and paste this link: ${onboardingLink}</p>
            <p><em>This link will expire in 7 days.</em></p>
            <p>If you have any questions, please contact our support team.</p>
            <p>Best regards,<br>0xMart Team</p>
          `,
        };

        await sgMail.send(simpleMsg);
        this.logger.log(`✅ Simple merchant onboarding email sent to ${email}`);
        return;
      }

      // Send templated email
      const msg = {
        to: email,
        from: { email: fromEmail, name: fromName },
        templateId,
        dynamicTemplateData: {
          company_name: companyName,
          onboarding_link: onboardingLink,
          support_link:
            this.configService.get<string>('sendgrid.supportLink') ||
            'https://support.0xmart.com/help',
          expiry_days: '7',
        },
      };

      await sgMail.send(msg);
      this.logger.log(`✅ Merchant onboarding email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send merchant onboarding email: ${error.message}`,
      );
      throw new Error('Failed to send merchant onboarding email');
    }
  }
}
