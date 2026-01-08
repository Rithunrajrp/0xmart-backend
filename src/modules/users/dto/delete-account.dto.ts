import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({
    description: 'Must be exactly "DELETE" to confirm account deletion',
    example: 'DELETE',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^DELETE$/, {
    message: 'Confirmation text must be exactly "DELETE"',
  })
  confirmationText: string;
}
