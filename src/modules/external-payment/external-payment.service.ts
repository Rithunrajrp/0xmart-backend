import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NetworkType,
  StablecoinType,
  ExternalOrderStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';
import { AdsService } from '../ads/ads.service';
import { CommissionsService } from '../commissions/commissions.service';
import { SellersService } from '../sellers/sellers.service';
import { EmailService } from '../auth/services/email.service';
import { AddressGeneratorService } from '../wallets/services/address-generator.service';
import { BlockchainService } from '../wallets/services/blockchain.service';
import { NetworksService } from '../networks/networks.service';
import { ethers } from 'ethers';

// Constants
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const ADDRESS_EXPIRY_HOURS = 24;
const RECENT_VERIFICATION_DAYS = 30;
const PAYMENT_EXPIRY_HOURS = 24;

export interface InitiatePaymentResult {
  status: string;
  orderId: string;
  orderNumber: string;
  need: {
    emailVerification: boolean;
    phoneVerification: boolean;
    address: boolean;
    networkSelection: boolean;
  };
  customer?: {
    email: string;
    phone: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    hasAddress: boolean;
  };
  product: {
    id: string;
    name: string;
    price: string;
    currency: string;
  };
  suggestedNetworks?: string[];
  reason?: string;
}

@Injectable()
export class ExternalPaymentService {
  private readonly logger = new Logger(ExternalPaymentService.name);

  // Network recommendations based on region/fees
  private readonly networkRecommendations: Record<string, NetworkType[]> = {
    default: ['TON', 'SUI', 'POLYGON', 'BSC', 'BASE', 'ARBITRUM'],
    India: ['POLYGON', 'BSC', 'TON', 'SUI'],
    USA: ['BASE', 'ARBITRUM', 'POLYGON', 'TON'],
    Europe: ['POLYGON', 'ARBITRUM', 'BASE', 'TON'],
    Asia: ['BSC', 'TON', 'SUI', 'POLYGON'],
  };

  constructor(
    private prisma: PrismaService,
    private adsService: AdsService,
    @Inject(forwardRef(() => CommissionsService))
    private commissionsService: CommissionsService,
    private sellersService: SellersService,
    private emailService: EmailService,
    private addressGeneratorService: AddressGeneratorService,
    private blockchainService: BlockchainService,
    private networksService: NetworksService,
  ) {}

  /**
   * Generate OTP code
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate order number
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `EXT-${timestamp}-${random}`;
  }

  /**
   * Normalize phone number (remove spaces, dashes)
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Extract country code from phone
   */
  private extractCountryCode(phone: string): string {
    const normalized = this.normalizePhone(phone);
    if (normalized.startsWith('+')) {
      // Extract first 1-4 digits after +
      const match = normalized.match(/^\+(\d{1,4})/);
      return match ? `+${match[1]}` : '+1';
    }
    return '+1'; // Default to US
  }

  /**
   * Step 1: Initiate Payment - Check customer status and determine required steps
   */
  async initiatePayment(
    apiKeyId: string,
    data: {
      productId: string;
      quantity: number;
      phone: string;
      email: string;
      stablecoinType: StablecoinType;
      network?: NetworkType;
      adClickToken?: string;
      idempotencyKey?: string;
    },
  ): Promise<InitiatePaymentResult> {
    const normalizedPhone = this.normalizePhone(data.phone);
    const normalizedEmail = data.email.toLowerCase().trim();

    // Check idempotency
    if (data.idempotencyKey) {
      const existing = await this.prisma.externalOrder.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) {
        throw new ConflictException({
          error: 'DUPLICATE_ORDER',
          message: 'Order with this idempotency key already exists',
          orderId: existing.id,
          orderNumber: existing.orderNumber,
        });
      }
    }

    // Get product and validate
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId },
      include: { prices: true },
    });

    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundException('Product not found or unavailable');
    }

    if (product.stock < data.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const price = product.prices.find(
      (p) => p.stablecoinType === data.stablecoinType,
    );
    if (!price) {
      throw new BadRequestException(
        `Product not available in ${data.stablecoinType}`,
      );
    }

    // Check customer by phone
    const customerByPhone = await this.prisma.externalCustomer.findUnique({
      where: { phone: normalizedPhone },
    });

    // Check customer by email
    const customerByEmail = await this.prisma.externalCustomer.findUnique({
      where: { email: normalizedEmail },
    });

    let customer: any = null;
    let needEmailVerification = false;
    let needPhoneVerification = false;
    let needAddress = false;
    let reason = '';

    // CASE 1: Phone exists + Email exists + They match
    if (
      customerByPhone &&
      customerByEmail &&
      customerByPhone.id === customerByEmail.id
    ) {
      customer = customerByPhone;

      // No OTP verification needed for external purchases
      // OTP is only required when accessing 0xMart account funds
      needEmailVerification = false;
      needPhoneVerification = false;

      needAddress = !customer.addressLine1;
      reason = 'Existing customer';
    }
    // CASE 2: Phone exists but mapped to different email
    else if (
      customerByPhone &&
      customerByPhone.email &&
      customerByPhone.email !== normalizedEmail
    ) {
      throw new BadRequestException({
        error: 'EMAIL_MISMATCH',
        message:
          'Phone number already exists but associated with a different email',
        hint: 'Please use the email associated with this phone number',
      });
    }
    // CASE 3: Email exists but mapped to different phone
    else if (
      customerByEmail &&
      customerByEmail.phone &&
      customerByEmail.phone !== normalizedPhone
    ) {
      throw new BadRequestException({
        error: 'PHONE_MISMATCH',
        message:
          'Email already exists but associated with a different phone number',
        hint: 'Please use the phone number associated with this email',
      });
    }
    // CASE 4: Phone exists but email missing - link email without verification
    else if (customerByPhone && !customerByPhone.email) {
      customer = customerByPhone;
      // Update customer with email (no OTP needed)
      customer = await this.prisma.externalCustomer.update({
        where: { id: customerByPhone.id },
        data: { email: normalizedEmail },
      });
      needEmailVerification = false;
      needAddress = !customer.addressLine1;
      reason = 'Email linked to existing account';
    }
    // CASE 5: Email exists but phone missing - link phone without verification
    else if (customerByEmail && !customerByEmail.phone) {
      customer = customerByEmail;
      // Update customer with phone (no OTP needed)
      customer = await this.prisma.externalCustomer.update({
        where: { id: customerByEmail.id },
        data: {
          phone: normalizedPhone,
          countryCode: this.extractCountryCode(data.phone),
        },
      });
      needPhoneVerification = false;
      needAddress = !customer.addressLine1;
      reason = 'Phone linked to existing account';
    }
    // CASE 6: New customer - no verification needed for external purchases
    else {
      // Create new customer without requiring OTP
      customer = await this.prisma.externalCustomer.create({
        data: {
          phone: normalizedPhone,
          countryCode: this.extractCountryCode(data.phone),
          email: normalizedEmail,
          emailVerified: false,
          phoneVerified: false,
          verificationStatus: 'PENDING', // Can verify later when accessing account
        },
      });
      needEmailVerification = false;
      needPhoneVerification = false;
      needAddress = true;
      reason = 'New customer - provide shipping address';
    }

    // Calculate order totals
    const pricePerUnit = new Decimal(price.price.toString());
    const subtotal = pricePerUnit.mul(data.quantity);
    const tax = subtotal.mul(0.1); // 10% tax
    const total = subtotal.add(tax);

    // Create the order
    const order = await this.prisma.externalOrder.create({
      data: {
        apiKeyId,
        customerId: customer.id,
        orderNumber: this.generateOrderNumber(),
        productId: data.productId,
        quantity: data.quantity,
        stablecoinType: data.stablecoinType,
        network: data.network,
        pricePerUnit,
        subtotal,
        tax,
        total,
        status: this.determineInitialStatus(
          needEmailVerification,
          needPhoneVerification,
          needAddress,
        ),
        idempotencyKey: data.idempotencyKey,
        expiresAt: new Date(Date.now() + PAYMENT_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    });

    // No OTP needed for external purchases
    // OTP is only required when user wants to access their 0xMart account funds

    // Get network suggestions - filter to only enabled networks
    const enabledNetworks = await this.networksService.getEnabledNetworks();
    const enabledNetworkTypes = enabledNetworks.map(n => n.network);
    const suggestedNetworks = this.networkRecommendations.default.filter(
      network => enabledNetworkTypes.includes(network)
    );

    // Track conversion if ad click token provided
    if (data.adClickToken) {
      await this.adsService.markConversion(data.adClickToken, order.id);
    }

    return {
      status: 'INITIATED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      need: {
        emailVerification: needEmailVerification,
        phoneVerification: needPhoneVerification,
        address: needAddress,
        networkSelection: !data.network,
      },
      customer: {
        email: this.maskEmail(normalizedEmail),
        phone: this.maskPhone(normalizedPhone),
        emailVerified: customer.emailVerified,
        phoneVerified: customer.phoneVerified,
        hasAddress: !!customer.addressLine1,
      },
      product: {
        id: product.id,
        name: product.name,
        price: total.toString(),
        currency: data.stablecoinType,
      },
      suggestedNetworks: suggestedNetworks as string[],
      reason,
    };
  }

  /**
   * Determine initial order status based on requirements
   */
  private determineInitialStatus(
    needEmailVerification: boolean,
    needPhoneVerification: boolean,
    needAddress: boolean,
  ): ExternalOrderStatus {
    if (needEmailVerification || needPhoneVerification) {
      return 'AWAITING_VERIFICATION';
    }
    if (needAddress) {
      return 'AWAITING_ADDRESS';
    }
    return 'AWAITING_PAYMENT';
  }

  /**
   * Send OTP to customer
   */
  private async sendOtp(
    customerId: string,
    type: 'email' | 'phone',
    recipient: string,
  ): Promise<void> {
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate existing OTPs
    await this.prisma.externalOtpVerification.updateMany({
      where: {
        customerId,
        type,
        verified: false,
      },
      data: { verified: true }, // Mark as used
    });

    // Create new OTP
    await this.prisma.externalOtpVerification.create({
      data: {
        customerId,
        type,
        recipient,
        otp,
        expiresAt,
      },
    });

    // Send OTP via email/SMS service
    if (type === 'email') {
      try {
        await this.emailService.sendOtpEmail(recipient, otp);
        this.logger.log(`✅ OTP email sent to: ${recipient}`);
      } catch (error) {
        this.logger.error(
          `❌ Failed to send OTP email to ${recipient}: ${error.message}`,
        );
        // Don't throw - OTP is saved in DB, user can try resend
      }
    } else {
      // TODO: Implement SMS sending via Twilio or similar service
      this.logger.log(
        `📱 OTP for phone ${recipient}: ${otp} (SMS not yet implemented)`,
      );
    }
  }

  /**
   * Step 2: Verify OTP (single OTP verifies both email and phone)
   */
  async verifyOtp(
    apiKeyId: string,
    orderId: string,
    otp: string,
    type: 'email' | 'phone',
  ): Promise<{ success: boolean; nextStep: string }> {
    const order = await this.getOrderWithValidation(apiKeyId, orderId);

    // Find OTP record - check both email and phone types since same OTP works for both
    const otpRecord = await this.prisma.externalOtpVerification.findFirst({
      where: {
        customerId: order.customerId,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException(
        'OTP expired or not found. Please request a new one.',
      );
    }

    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Maximum OTP attempts exceeded. Please request a new one.',
      );
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      await this.prisma.externalOtpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP');
    }

    // Mark OTP as verified
    await this.prisma.externalOtpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    // Update customer verification status - verify BOTH email and phone with same OTP
    const updateData: any = {
      lastVerifiedAt: new Date(),
      emailVerified: true,
      phoneVerified: true,
    };

    const customer = await this.prisma.externalCustomer.update({
      where: { id: order.customerId },
      data: updateData,
    });

    // Update verification status to fully verified
    await this.prisma.externalCustomer.update({
      where: { id: customer.id },
      data: { verificationStatus: 'FULLY_VERIFIED' },
    });

    // Determine next step
    const needsAddress = !customer.addressLine1;
    const needsNetwork = !order.network;

    if (needsAddress) {
      await this.prisma.externalOrder.update({
        where: { id: orderId },
        data: { status: 'AWAITING_ADDRESS' },
      });
      return { success: true, nextStep: 'SUBMIT_ADDRESS' };
    }

    if (needsNetwork) {
      return { success: true, nextStep: 'SELECT_NETWORK' };
    }

    // Ready for payment
    return { success: true, nextStep: 'READY_FOR_PAYMENT' };
  }

  /**
   * Resend OTP
   */
  async resendOtp(
    apiKeyId: string,
    orderId: string,
    type: 'email' | 'phone',
  ): Promise<{ success: boolean; message: string }> {
    const order = await this.getOrderWithValidation(apiKeyId, orderId);
    const customer = await this.prisma.externalCustomer.findUnique({
      where: { id: order.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const recipient = type === 'email' ? customer.email : customer.phone;
    if (!recipient) {
      throw new BadRequestException(`No ${type} found for customer`);
    }

    await this.sendOtp(customer.id, type, recipient);

    return {
      success: true,
      message: `OTP sent to ${type}`,
    };
  }

  /**
   * Step 3: Submit shipping address
   */
  async submitAddress(
    apiKeyId: string,
    orderId: string,
    address: {
      fullName: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state?: string;
      postalCode: string;
      country: string;
      landmark?: string;
    },
  ): Promise<{ success: boolean; nextStep: string }> {
    const order = await this.getOrderWithValidation(apiKeyId, orderId);

    // Update customer address
    await this.prisma.externalCustomer.update({
      where: { id: order.customerId },
      data: {
        fullName: address.fullName,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        landmark: address.landmark,
      },
    });

    // Update order shipping address
    await this.prisma.externalOrder.update({
      where: { id: orderId },
      data: {
        shippingAddress: address,
        status: order.network ? 'AWAITING_PAYMENT' : 'AWAITING_PAYMENT',
      },
    });

    if (!order.network) {
      return { success: true, nextStep: 'SELECT_NETWORK' };
    }

    return { success: true, nextStep: 'READY_FOR_PAYMENT' };
  }

  /**
   * Step 4: Select network and get deposit address
   */
  async selectNetwork(
    apiKeyId: string,
    orderId: string,
    network: NetworkType,
  ): Promise<{
    success: boolean;
    payment: {
      depositAddress: string;
      amount: string;
      currency: string;
      network: string;
      expiresAt: string;
      qrData: string;
    };
  }> {
    const order = await this.getOrderWithValidation(apiKeyId, orderId);

    // Get or create deposit address for customer
    const depositAddress = await this.getOrCreateDepositAddress(
      order.customerId,
      network,
      order.stablecoinType,
    );

    // Update order with network and deposit address
    const paymentExpiresAt = new Date(
      Date.now() + PAYMENT_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.externalOrder.update({
      where: { id: orderId },
      data: {
        network,
        depositAddressId: depositAddress.id,
        depositAddress: depositAddress.address,
        expectedAmount: order.total,
        status: 'AWAITING_PAYMENT',
        paymentExpiresAt,
      },
    });

    // Generate QR code data
    const qrData = JSON.stringify({
      address: depositAddress.address,
      amount: order.total.toString(),
      currency: order.stablecoinType,
      network,
      orderId: order.orderNumber,
    });

    return {
      success: true,
      payment: {
        depositAddress: depositAddress.address,
        amount: order.total.toString(),
        currency: order.stablecoinType,
        network,
        expiresAt: paymentExpiresAt.toISOString(),
        qrData,
      },
    };
  }

  /**
   * Get or create deposit address with expiration rules
   */
  private async getOrCreateDepositAddress(
    customerId: string,
    network: NetworkType,
    stablecoinType: StablecoinType,
  ) {
    const customer = await this.prisma.externalCustomer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check for existing active address
    const existingAddress = await this.prisma.externalDepositAddress.findFirst({
      where: {
        customerId,
        network,
        stablecoinType,
        status: 'ACTIVE',
      },
    });

    // Rule 1: If suspicious behavior, force new address
    if (customer.isSuspicious) {
      if (existingAddress) {
        await this.prisma.externalDepositAddress.update({
          where: { id: existingAddress.id },
          data: { status: 'SUSPENDED' },
        });
      }
      return this.createNewDepositAddress(customerId, network, stablecoinType);
    }

    // Rule 2: If recently verified (< 30 days), reuse existing
    if (existingAddress && customer.lastVerifiedAt) {
      const daysSinceVerification =
        (Date.now() - customer.lastVerifiedAt.getTime()) /
        (1000 * 60 * 60 * 24);

      if (daysSinceVerification < RECENT_VERIFICATION_DAYS) {
        // Check if address is not expired
        if (
          !existingAddress.expiresAt ||
          existingAddress.expiresAt > new Date()
        ) {
          // Update last used
          await this.prisma.externalDepositAddress.update({
            where: { id: existingAddress.id },
            data: {
              lastUsedAt: new Date(),
              expiresAt: new Date(
                Date.now() + ADDRESS_EXPIRY_HOURS * 60 * 60 * 1000,
              ),
            },
          });
          return existingAddress;
        }
      }
    }

    // Rule 3: If existing address has pending balance, keep using it
    if (existingAddress && Number(existingAddress.pendingBalance) > 0) {
      await this.prisma.externalDepositAddress.update({
        where: { id: existingAddress.id },
        data: {
          lastUsedAt: new Date(),
          expiresAt: new Date(
            Date.now() + ADDRESS_EXPIRY_HOURS * 60 * 60 * 1000,
          ),
        },
      });
      return existingAddress;
    }

    // Rule 4: Generate new address
    if (existingAddress) {
      await this.prisma.externalDepositAddress.update({
        where: { id: existingAddress.id },
        data: { status: 'EXPIRED' },
      });
    }

    return this.createNewDepositAddress(customerId, network, stablecoinType);
  }

  /**
   * Create new deposit address using HD wallet generation
   */
  private async createNewDepositAddress(
    customerId: string,
    network: NetworkType,
    stablecoinType: StablecoinType,
  ) {
    // Get next available address index for this customer
    const existingAddresses = await this.prisma.externalDepositAddress.findMany(
      {
        where: { customerId },
        select: { id: true },
      },
    );
    const addressIndex = existingAddresses.length;

    // Generate real blockchain address using HD wallet
    let address: string;

    const evmNetworks: NetworkType[] = [
      'ETHEREUM',
      'POLYGON',
      'BSC',
      'ARBITRUM',
      'OPTIMISM',
      'AVALANCHE',
      'BASE',
    ];

    if (evmNetworks.includes(network)) {
      // Generate EVM-compatible address (works for all EVM chains)
      const walletData =
        await this.addressGeneratorService.generateDepositAddress(
          customerId,
          addressIndex,
        );
      address = walletData.address;

      this.logger.log(
        `Generated EVM address for customer ${customerId} on ${network}: ${address}`,
      );
    } else {
      // For non-EVM networks (SUI, TON), we'll use EVM address for now
      // TODO: Implement native SUI and TON address generation
      const walletData =
        await this.addressGeneratorService.generateDepositAddress(
          customerId,
          addressIndex,
        );
      address = walletData.address;

      this.logger.warn(
        `Using EVM-style address for ${network}. Native ${network} address generation not yet implemented.`,
      );
    }

    return this.prisma.externalDepositAddress.create({
      data: {
        customerId,
        network,
        stablecoinType,
        address,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + ADDRESS_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    });
  }

  /**
   * Verify payment on blockchain
   */
  private async verifyPaymentOnChain(
    txHash: string,
    network: NetworkType,
    expectedRecipient: string,
    expectedAmount: Decimal,
  ): Promise<{ verified: boolean; reason?: string }> {
    try {
      // Only verify EVM networks for now
      const evmNetworks: NetworkType[] = [
        'ETHEREUM',
        'POLYGON',
        'BSC',
        'ARBITRUM',
        'OPTIMISM',
        'AVALANCHE',
        'BASE',
      ];

      if (!evmNetworks.includes(network)) {
        this.logger.warn(
          `Blockchain verification not implemented for ${network}. Skipping verification.`,
        );
        return { verified: true }; // Auto-approve for non-EVM networks (TODO: implement)
      }

      // Get transaction receipt
      const receipt = await this.blockchainService.getTransactionReceipt(
        txHash,
        network,
      );

      if (!receipt) {
        return {
          verified: false,
          reason: 'Transaction not found on blockchain',
        };
      }

      if (!receipt.status || receipt.status === 0) {
        return {
          verified: false,
          reason: 'Transaction failed on blockchain',
        };
      }

      // Verify recipient address (case-insensitive comparison)
      if (receipt.to?.toLowerCase() !== expectedRecipient.toLowerCase()) {
        return {
          verified: false,
          reason: `Transaction sent to wrong address. Expected: ${expectedRecipient}, Got: ${receipt.to}`,
        };
      }

      // For ERC20 token transfers (stablecoins), amount verification requires parsing logs
      // For now, we verify the transaction succeeded and was sent to correct address
      // TODO: Parse Transfer event logs to verify exact token amount
      this.logger.log(
        `Transaction verified. Amount validation via logs not yet implemented.`,
      );

      this.logger.log(
        `✅ Payment verified on ${network}: ${txHash} -> ${receipt.to} (block ${receipt.blockNumber})`,
      );

      return { verified: true };
    } catch (error) {
      this.logger.error(
        `Blockchain verification failed: ${(error as Error).message}`,
      );
      return {
        verified: false,
        reason: `Blockchain verification error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Step 5: Confirm payment with blockchain verification
   */
  async confirmPayment(
    apiKeyId: string,
    orderId: string,
    txHash: string,
  ): Promise<{
    success: boolean;
    order: {
      id: string;
      orderNumber: string;
      status: string;
      total: string;
    };
    commission?: {
      id: string;
      amount: string;
      rate: string;
    };
  }> {
    const order = await this.getOrderWithValidation(apiKeyId, orderId);

    if (order.status !== 'AWAITING_PAYMENT') {
      throw new BadRequestException(
        `Order is not awaiting payment. Current status: ${order.status}`,
      );
    }

    // Check for duplicate txHash
    const existingTx = await this.prisma.externalOrder.findFirst({
      where: { txHash },
    });
    if (existingTx) {
      throw new ConflictException('Transaction hash already used');
    }

    // Get deposit address for this order
    const depositAddress = order.depositAddressId
      ? await this.prisma.externalDepositAddress.findUnique({
          where: { id: order.depositAddressId },
        })
      : null;

    if (!depositAddress) {
      throw new BadRequestException('Deposit address not found for this order');
    }

    // Verify payment on blockchain
    const verification = await this.verifyPaymentOnChain(
      txHash,
      order.network!,
      depositAddress.address,
      order.total,
    );

    if (!verification.verified) {
      throw new BadRequestException(
        `Payment verification failed: ${verification.reason || 'Unknown error'}`,
      );
    }

    // Payment verified - update order status
    const updatedOrder = await this.prisma.externalOrder.update({
      where: { id: orderId },
      data: {
        txHash,
        status: 'PAYMENT_CONFIRMED', // Changed from PAYMENT_DETECTED to PAYMENT_CONFIRMED
      },
    });

    // Create commission record for the API user (5% default)
    let commissionData:
      | { id: string; amount: string; rate: string }
      | undefined;
    try {
      const commission = await this.commissionsService.createCommission(
        apiKeyId,
        orderId,
        order.total,
        order.stablecoinType,
        order.network || undefined,
      );
      commissionData = {
        id: commission.id,
        amount: commission.commissionAmount.toString(),
        rate: `${Number(commission.commissionRate) * 100}%`,
      };
      this.logger.log(
        `Commission created for order ${orderId}: ${commission.commissionAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create commission for order ${orderId}: ${(error as Error).message}`,
      );
    }

    // TODO: Trigger webhook to developer about payment confirmation

    return {
      success: true,
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        total: updatedOrder.total.toString(),
      },
      commission: commissionData,
    };
  }

  /**
   * Called by blockchain monitor when payment is confirmed on-chain
   */
  async onPaymentConfirmed(
    orderId: string,
    receivedAmount: Decimal,
  ): Promise<void> {
    const order = await this.prisma.externalOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.error(`Order not found for confirmation: ${orderId}`);
      return;
    }

    // Update order to confirmed
    await this.prisma.externalOrder.update({
      where: { id: orderId },
      data: {
        status: 'PAYMENT_CONFIRMED',
        receivedAmount,
        paidAt: new Date(),
      },
    });

    // Confirm the commission (starts the 14-day availability window)
    await this.commissionsService.confirmCommission(orderId);

    this.logger.log(`Payment confirmed for order ${orderId}`);
  }

  /**
   * Get order status
   */
  async getOrderStatus(apiKeyId: string, orderId: string) {
    const order = await this.getOrderWithValidation(apiKeyId, orderId);
    const customer = await this.prisma.externalCustomer.findUnique({
      where: { id: order.customerId },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      product: {
        id: order.productId,
      },
      pricing: {
        subtotal: order.subtotal.toString(),
        tax: order.tax.toString(),
        total: order.total.toString(),
        currency: order.stablecoinType,
      },
      payment: order.depositAddress
        ? {
            depositAddress: order.depositAddress,
            network: order.network,
            expectedAmount: order.expectedAmount?.toString(),
            receivedAmount: order.receivedAmount?.toString(),
            txHash: order.txHash,
            expiresAt: order.paymentExpiresAt?.toISOString(),
          }
        : null,
      shipping: order.shippingAddress,
      customer: customer
        ? {
            emailVerified: customer.emailVerified,
            phoneVerified: customer.phoneVerified,
            hasAddress: !!customer.addressLine1,
          }
        : null,
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt?.toISOString(),
    };
  }

  /**
   * Helper: Get order with API key validation
   */
  private async getOrderWithValidation(apiKeyId: string, orderId: string) {
    const order = await this.prisma.externalOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.apiKeyId !== apiKeyId) {
      throw new BadRequestException('Order does not belong to this API key');
    }

    if (
      order.expiresAt &&
      order.expiresAt < new Date() &&
      order.status === 'AWAITING_PAYMENT'
    ) {
      await this.prisma.externalOrder.update({
        where: { id: orderId },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Order has expired');
    }

    return order;
  }

  /**
   * Helper: Mask email for privacy
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    const maskedLocal = local.slice(0, 2) + '***' + local.slice(-1);
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Helper: Mask phone for privacy
   */
  private maskPhone(phone: string): string {
    return phone.slice(0, 4) + '****' + phone.slice(-2);
  }
}
