import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus, KYCStatus } from '@prisma/client';

export class UserEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phoneNumber: string | null;

  @ApiProperty()
  countryCode: string | null;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ enum: KYCStatus })
  kycStatus: KYCStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  lastLoginAt: Date | null;
}

export class UserWithWalletsEntity extends UserEntity {
  @ApiProperty({ type: 'array' })
  wallets: Array<{
    id: string;
    stablecoinType: string;
    network: string;
    depositAddress: string;
    balance: string;
  }>;
}
