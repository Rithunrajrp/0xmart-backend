import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressType } from '@prisma/client';

@Injectable()
export class UserAddressesService {
  private readonly logger = new Logger(UserAddressesService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, createAddressDto: CreateAddressDto) {
    // If this is set as default, unset other defaults of the same type
    if (createAddressDto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: {
          userId,
          type: createAddressDto.type,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.userAddress.create({
      data: {
        userId,
        ...createAddressDto,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ADDRESS_ADDED',
        entityType: 'user_address',
        entityId: address.id,
        metadata: {
          type: address.type,
          city: address.city,
          country: address.country,
        },
      },
    });

    this.logger.log(`Address created for user ${userId}: ${address.id}`);
    return address;
  }

  async findAll(userId: string, type?: AddressType) {
    const where: { userId: string; type?: AddressType } = { userId };
    if (type) {
      where.type = type;
    }

    return this.prisma.userAddress.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(userId: string, addressId: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  async update(
    userId: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto,
  ) {
    const address = await this.findOne(userId, addressId);

    // If setting as default, unset other defaults of the same type
    if (updateAddressDto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: {
          userId,
          type: address.type,
          isDefault: true,
          id: { not: addressId },
        },
        data: { isDefault: false },
      });
    }

    const updatedAddress = await this.prisma.userAddress.update({
      where: { id: addressId },
      data: updateAddressDto,
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ADDRESS_UPDATED',
        entityType: 'user_address',
        entityId: addressId,
        metadata: {
          changes: JSON.parse(JSON.stringify(updateAddressDto)),
        } as any,
      },
    });

    this.logger.log(`Address updated: ${addressId}`);
    return updatedAddress;
  }

  async remove(userId: string, addressId: string) {
    const address = await this.findOne(userId, addressId);

    await this.prisma.userAddress.delete({
      where: { id: addressId },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ADDRESS_DELETED',
        entityType: 'user_address',
        entityId: addressId,
        metadata: {
          type: address.type,
          city: address.city,
        },
      },
    });

    this.logger.log(`Address deleted: ${addressId}`);
    return { message: 'Address deleted successfully' };
  }

  async setDefault(userId: string, addressId: string) {
    const address = await this.findOne(userId, addressId);

    // Unset other defaults of the same type
    await this.prisma.userAddress.updateMany({
      where: {
        userId,
        type: address.type,
        isDefault: true,
        id: { not: addressId },
      },
      data: { isDefault: false },
    });

    // Set this as default
    const updatedAddress = await this.prisma.userAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    this.logger.log(`Address set as default: ${addressId}`);
    return updatedAddress;
  }

  async getDefaultAddress(userId: string, type: AddressType) {
    return this.prisma.userAddress.findFirst({
      where: {
        userId,
        type,
        isDefault: true,
      },
    });
  }
}
