import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsInt, Min } from 'class-validator';

export class UpdateNetworkConfigDto {
  @ApiProperty({
    example: true,
    description: 'Whether this network is enabled for accepting payments',
  })
  @IsBoolean()
  isEnabled: boolean;

  @ApiProperty({
    example: 'Ethereum Mainnet',
    description: 'Display name for the network',
    required: false,
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({
    example: 'Ethereum is the most widely adopted blockchain network',
    description: 'Description of the network',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'https://cdn.0xmart.com/icons/ethereum.svg',
    description: 'URL to the network icon',
    required: false,
  })
  @IsString()
  @IsOptional()
  iconUrl?: string;

  @ApiProperty({
    example: 1,
    description: 'Sort order for displaying networks',
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateContractDeploymentDto {
  @ApiProperty({
    example: true,
    description: 'Whether the contract has been deployed',
  })
  @IsBoolean()
  contractDeployed: boolean;

  @ApiProperty({
    example: '0x1234567890abcdef1234567890abcdef12345678',
    description: 'The deployed contract address',
    required: false,
  })
  @IsString()
  @IsOptional()
  contractAddress?: string;
}

export class NetworkConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  network: string;

  @ApiProperty()
  isEnabled: boolean;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  iconUrl?: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  contractDeployed: boolean;

  @ApiProperty({ required: false })
  contractAddress?: string;

  @ApiProperty({ required: false })
  lastContractCheck?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  updatedBy?: string;
}
