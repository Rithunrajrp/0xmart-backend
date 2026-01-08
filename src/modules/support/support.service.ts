import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../auth/services/email.service';
import { ContactSupportDto } from './dto/contact-support.dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private emailService: EmailService) {}

  async handleContactForm(contactDto: ContactSupportDto) {
    const { name, email, category, subject, message } = contactDto;

    // Email content for support team
    const supportEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #555; }
            .value { margin-top: 5px; padding: 10px; background: white; border-left: 3px solid #667eea; }
            .footer { text-align: center; padding: 15px; font-size: 12px; color: #888; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">New Support Ticket</h2>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">From 0xMart Support Portal</p>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">From:</div>
                <div class="value">${name} (${email})</div>
              </div>

              <div class="field">
                <div class="label">Category:</div>
                <div class="value">${category}</div>
              </div>

              <div class="field">
                <div class="label">Subject:</div>
                <div class="value">${subject}</div>
              </div>

              <div class="field">
                <div class="label">Message:</div>
                <div class="value" style="white-space: pre-wrap;">${message}</div>
              </div>
            </div>
            <div class="footer">
              <p>Submitted via support.0xmart.com contact form</p>
              <p>Respond to: ${email}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email to support team
    await this.emailService.sendCustomEmail(
      'help@0xmart.com',
      `[${category}] ${subject}`,
      supportEmailHtml,
    );

    // Send confirmation email to user
    const userConfirmationHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: white; padding: 30px; border: 1px solid #ddd; border-top: none; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Message Received!</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>

              <p>Thank you for contacting 0xMart Support. We've received your message regarding:</p>

              <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
                <strong>${subject}</strong>
              </div>

              <p>Our support team will review your inquiry and respond within 24 hours.</p>

              <p><strong>What happens next?</strong></p>
              <ul>
                <li>Our team will investigate your issue</li>
                <li>You'll receive a detailed response at <strong>${email}</strong></li>
                <li>Average response time: 12-24 hours</li>
              </ul>

              <p style="text-align: center;">
                <a href="https://support.0xmart.com/faq" class="button">Browse FAQs</a>
              </p>

              <p>If you have additional information to add, please reply to this email.</p>

              <p>Best regards,<br><strong>0xMart Support Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated confirmation email from 0xMart Support</p>
              <p>© ${new Date().getFullYear()} 0xMart. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.emailService.sendCustomEmail(
      email,
      'Support Ticket Received - 0xMart',
      userConfirmationHtml,
    );

    this.logger.log(
      `Support ticket submitted: ${category} - ${subject} from ${email}`,
    );

    return {
      message: 'Support ticket submitted successfully',
      ticketId: `ST-${Date.now()}`,
    };
  }
}
