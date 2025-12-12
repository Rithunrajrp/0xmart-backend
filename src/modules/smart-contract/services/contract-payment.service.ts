import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  NetworkType,
  getContractAddress,
  isEvmNetwork,
  isSolanaNetwork,
} from '../constants/contract-addresses';
import {
  InitiateContractPaymentDto,
  InitiateBatchContractPaymentDto,
  ContractPaymentResponseDto,
  PaymentStatusResponseDto,
} from '../dto/initiate-contract-payment.dto';
import { randomBytes } from 'crypto';

const PAYMENT_CONTRACT_ABI = [
  'function processPayment(bytes32 orderId, address tokenAddress, uint256 amount, string memory productId, address apiKeyOwner, uint16 commissionBps) external',
  'function processBatchPayment(bytes32 orderId, address tokenAddress, uint256 totalAmount, string[] memory productIds, address apiKeyOwner, uint16 commissionBps) external',
  'function platformFeeBps() view returns (uint16)',
];

@Injectable()
export class ContractPaymentService {
  private readonly logger = new Logger(ContractPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initiate a single product payment via smart contract
   */
  async initiatePayment(
    userId: string,
    dto: InitiateContractPaymentDto,
  ): Promise<ContractPaymentResponseDto> {
    const {
      productId,
      quantity = 1,
      network,
      stablecoinType,
      buyerAddress,
      apiKeyOwnerAddress,
      commissionBps = 0,
      shippingAddressId,
    } = dto;

    // Validate network
    if (!isEvmNetwork(network) && !isSolanaNetwork(network)) {
      throw new BadRequestException('Invalid network');
    }

    // Get product with prices
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        prices: {
          where: {
            stablecoinType: stablecoinType as any,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Get price for specified stablecoin
    const productPriceRecord = product.prices[0];
    if (!productPriceRecord) {
      throw new BadRequestException(
        `Product price not set for ${stablecoinType}`,
      );
    }

    // Calculate amounts
    const productPrice = parseFloat(productPriceRecord.price.toString());
    const totalAmount = productPrice * quantity;

    // Get platform fee
    const platformFeeBps = 0; // Would fetch from contract or config
    const platformFee = (totalAmount * platformFeeBps) / 10000;

    // Calculate commission
    const commission = (totalAmount * commissionBps) / 10000;

    // Generate order ID (32 bytes)
    const orderId = '0x' + randomBytes(32).toString('hex');

    // Generate order number
    const timestamp = Date.now();
    const orderNumber = `SC-${timestamp}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;

    // Get contract and token addresses
    const contractAddresses = getContractAddress(network);
    if (!contractAddresses) {
      throw new BadRequestException('Contract not deployed on this network');
    }

    const contractAddress = contractAddresses.payment;
    const tokenAddress = contractAddresses.tokens[stablecoinType];

    if (
      !tokenAddress ||
      tokenAddress === '0x0000000000000000000000000000000000000000'
    ) {
      throw new BadRequestException(
        `Token ${stablecoinType} not supported on ${network}`,
      );
    }

    // Convert amount to token units (assuming 6 decimals for stablecoins)
    const decimals = ['DAI', 'BUSD'].includes(stablecoinType) ? 18 : 6;
    const amountInUnits = ethers.utils.parseUnits(
      totalAmount.toFixed(6),
      decimals,
    );

    // Create order in database
    await this.prisma.order.create({
      data: {
        id: orderId,
        orderNumber,
        userId,
        status: 'PENDING',
        network: network.toUpperCase() as any,
        stablecoinType: stablecoinType as any,
        totalAmount,
        subtotal: totalAmount,
        total: totalAmount,
        platformFee,
        shippingAddressId,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: {
          create: [
            {
              productId,
              quantity,
              stablecoinType: stablecoinType as any,
              pricePerUnit: productPrice,
              totalPrice: totalAmount,
            },
          ],
        },
      },
    });

    this.logger.log(
      `Created order ${orderNumber} for ${totalAmount} ${stablecoinType} on ${network}`,
    );

    // Return instructions for frontend
    return {
      orderId,
      orderNumber,
      contractAddress,
      tokenAddress,
      amount: amountInUnits.toString(),
      amountFormatted: `${totalAmount.toFixed(2)} ${stablecoinType}`,
      platformFee: ethers.utils
        .parseUnits(platformFee.toFixed(6), decimals)
        .toString(),
      commission: ethers.utils
        .parseUnits(commission.toFixed(6), decimals)
        .toString(),
      network,
      instructions: {
        step1: `Approve ${totalAmount.toFixed(2)} ${stablecoinType} to contract ${contractAddress}`,
        step2: `Call processPayment with orderId: ${orderId}`,
        step3: 'Wait for blockchain confirmation',
      },
      abi: PAYMENT_CONTRACT_ABI,
      products: [
        {
          productId: product.id,
          name: product.name,
          quantity,
          price: productPrice,
        },
      ],
    };
  }

  /**
   * Initiate a batch payment (shopping cart) via smart contract
   */
  async initiateBatchPayment(
    userId: string,
    dto: InitiateBatchContractPaymentDto,
  ): Promise<ContractPaymentResponseDto> {
    const {
      products,
      network,
      stablecoinType,
      buyerAddress,
      apiKeyOwnerAddress,
      commissionBps = 0,
      shippingAddressId,
    } = dto;

    if (!products || products.length === 0) {
      throw new BadRequestException('Products list cannot be empty');
    }

    // Validate network
    if (!isEvmNetwork(network) && !isSolanaNetwork(network)) {
      throw new BadRequestException('Invalid network');
    }

    // Get all products with prices
    const productIds = products.map((p) => p.productId);
    const productRecords = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        prices: {
          where: {
            stablecoinType: stablecoinType as any,
          },
        },
      },
    });

    if (productRecords.length !== productIds.length) {
      throw new NotFoundException('One or more products not found');
    }

    // Calculate total amount
    let totalAmount = 0;
    const productDetails = products.map((p) => {
      const product = productRecords.find((pr) => pr.id === p.productId);
      if (!product) {
        throw new NotFoundException(`Product ${p.productId} not found`);
      }

      const priceRecord = product.prices[0];
      if (!priceRecord) {
        throw new BadRequestException(
          `Product ${product.id} price not set for ${stablecoinType}`,
        );
      }

      const price = parseFloat(priceRecord.price.toString());
      const subtotal = price * p.quantity;
      totalAmount += subtotal;

      return {
        productId: product.id,
        name: product.name,
        quantity: p.quantity,
        price,
      };
    });

    // Get platform fee
    const platformFeeBps = 0; // Would fetch from contract
    const platformFee = (totalAmount * platformFeeBps) / 10000;

    // Calculate commission
    const commission = (totalAmount * commissionBps) / 10000;

    // Generate order ID
    const orderId = '0x' + randomBytes(32).toString('hex');
    const timestamp = Date.now();
    const orderNumber = `SC-${timestamp}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;

    // Get contract and token addresses
    const contractAddresses = getContractAddress(network);
    if (!contractAddresses) {
      throw new BadRequestException('Contract not deployed on this network');
    }

    const contractAddress = contractAddresses.payment;
    const tokenAddress = contractAddresses.tokens[stablecoinType];

    if (
      !tokenAddress ||
      tokenAddress === '0x0000000000000000000000000000000000000000'
    ) {
      throw new BadRequestException(
        `Token ${stablecoinType} not supported on ${network}`,
      );
    }

    // Convert amount to token units
    const decimals = ['DAI', 'BUSD'].includes(stablecoinType) ? 18 : 6;
    const amountInUnits = ethers.utils.parseUnits(
      totalAmount.toFixed(6),
      decimals,
    );

    // Create order in database
    await this.prisma.order.create({
      data: {
        id: orderId,
        orderNumber,
        userId,
        status: 'PENDING',
        network: network.toUpperCase() as any,
        stablecoinType: stablecoinType as any,
        totalAmount,
        subtotal: totalAmount,
        total: totalAmount,
        platformFee,
        shippingAddressId,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: {
          create: productDetails.map((pd) => ({
            productId: pd.productId,
            quantity: pd.quantity,
            stablecoinType: stablecoinType as any,
            pricePerUnit: pd.price,
            totalPrice: pd.price * pd.quantity,
          })),
        },
      },
    });

    this.logger.log(
      `Created batch order ${orderNumber} for ${totalAmount} ${stablecoinType} on ${network} (${products.length} products)`,
    );

    return {
      orderId,
      orderNumber,
      contractAddress,
      tokenAddress,
      amount: amountInUnits.toString(),
      amountFormatted: `${totalAmount.toFixed(2)} ${stablecoinType}`,
      platformFee: ethers.utils
        .parseUnits(platformFee.toFixed(6), decimals)
        .toString(),
      commission: ethers.utils
        .parseUnits(commission.toFixed(6), decimals)
        .toString(),
      network,
      instructions: {
        step1: `Approve ${totalAmount.toFixed(2)} ${stablecoinType} to contract ${contractAddress}`,
        step2: `Call processBatchPayment with orderId: ${orderId} and ${products.length} product IDs`,
        step3: 'Wait for blockchain confirmation',
      },
      abi: PAYMENT_CONTRACT_ABI,
      products: productDetails,
    };
  }

  /**
   * Check payment status for an order
   */
  async checkPaymentStatus(orderId: string): Promise<PaymentStatusResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      orderId: order.id,
      status: order.status,
      transactionHash: order.transactionHash,
      blockNumber: order.blockNumber,
      paymentConfirmedAt: order.paymentConfirmedAt,
    };
  }

  /**
   * Get user's contract payment orders
   */
  async getUserOrders(userId: string, limit = 20, offset = 0) {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        // Filter for smart contract orders (have contract-style order IDs)
        id: {
          startsWith: '0x',
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shippingAddr: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return orders;
  }
}
