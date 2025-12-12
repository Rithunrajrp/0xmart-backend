import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminManagementService {
  constructor(private prisma: PrismaService) {}

  async createAdmin(createAdminDto: CreateAdminDto, createdBy: string) {
    const { email, countryCode, phoneNumber, name } = createAdminDto;

    // Check if user already exists with this email
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUserByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    // Check if user exists with this phone number
    const existingUserByPhone = await this.prisma.user.findFirst({
      where: {
        phoneNumber,
        countryCode,
      },
    });

    if (existingUserByPhone) {
      throw new ConflictException('User with this phone number already exists');
    }

    // Create admin user
    const admin = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        phoneNumber,
        countryCode,
        role: 'ADMIN',
        status: 'ACTIVE',
        kycStatus: 'APPROVED',
        metadata: name ? { name } : undefined,
      },
    });

    return {
      id: admin.id,
      email: admin.email,
      phoneNumber: admin.phoneNumber,
      countryCode: admin.countryCode,
      role: admin.role,
      status: admin.status,
      createdAt: admin.createdAt,
    };
  }

  async getAllAdmins(page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;

    const where: any = { role: 'ADMIN' };
    if (status) {
      where.status = status;
    }

    const [admins, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          countryCode: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          metadata: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      admins: admins.map((admin) => ({
        ...admin,
        name:
          admin.metadata &&
          typeof admin.metadata === 'object' &&
          'name' in admin.metadata
            ? admin.metadata.name
            : null,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAdminById(id: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        countryCode: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        metadata: true,
      },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new NotFoundException('Admin not found');
    }

    return {
      ...admin,
      name:
        admin.metadata &&
        typeof admin.metadata === 'object' &&
        'name' in admin.metadata
          ? admin.metadata.name
          : null,
    };
  }

  async updateAdmin(id: string, updateAdminDto: UpdateAdminDto) {
    const admin = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new NotFoundException('Admin not found');
    }

    const updateData: any = {};

    if (updateAdminDto.isActive !== undefined) {
      updateData.status = updateAdminDto.isActive ? 'ACTIVE' : 'SUSPENDED';
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        countryCode: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async deleteAdmin(id: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new NotFoundException('Admin not found');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'Admin deleted successfully' };
  }
}
