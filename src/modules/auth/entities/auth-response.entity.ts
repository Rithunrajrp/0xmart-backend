import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseEntity {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty()
  user: {
    id: string;
    email: string;
    phoneNumber?: string;
    role: string;
    kycStatus: string;
  };
}
