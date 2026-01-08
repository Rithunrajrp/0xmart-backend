import { IsEmail, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ContactSupportDto {
  @ApiProperty({
    description: 'Full name of the person contacting support',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Email address for response',
    example: 'john@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Category of the support request',
    example: 'Technical Support',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'Subject of the support request',
    example: 'Having issues with wallet creation',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({
    description: 'Detailed message describing the issue',
    example: 'I am unable to create a new wallet. The page keeps loading but nothing happens.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
