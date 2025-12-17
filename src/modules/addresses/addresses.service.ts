import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAddressRequestDto, UpdateAddressRequestDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, userId: string) {
    const address = await this.prisma.userAddress.findUnique({
      where: { id },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return address;
  }

  async create(userId: string, dto: CreateAddressRequestDto) {
    // If this is set as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateAddressRequestDto) {
    // Verify ownership
    await this.findOne(id, userId);

    // If this is set as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.update({
      where: { id },
      data: dto,
    });
  }

  async setDefault(id: string, userId: string) {
    // Verify ownership
    await this.findOne(id, userId);

    // Unset other defaults
    await this.prisma.userAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    // Set this as default
    return this.prisma.userAddress.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async remove(id: string, userId: string) {
    // Verify ownership
    await this.findOne(id, userId);

    await this.prisma.userAddress.delete({
      where: { id },
    });

    return { message: 'Address deleted successfully' };
  }
}
