import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressRequestDto, UpdateAddressRequestDto } from './dto/address.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all addresses for current user' })
  @ApiResponse({ status: 200, description: 'List of addresses' })
  async findAll(@CurrentUser() user: any) {
    return this.addressesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get address by ID' })
  @ApiResponse({ status: 200, description: 'Address details' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.addressesService.findOne(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new address' })
  @ApiResponse({ status: 201, description: 'Address created' })
  async create(@Body() dto: CreateAddressRequestDto, @CurrentUser() user: any) {
    return this.addressesService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update address' })
  @ApiResponse({ status: 200, description: 'Address updated' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAddressRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.addressesService.update(id, user.id, dto);
  }

  @Put(':id/default')
  @ApiOperation({ summary: 'Set address as default' })
  @ApiResponse({ status: 200, description: 'Default address updated' })
  async setDefault(@Param('id') id: string, @CurrentUser() user: any) {
    return this.addressesService.setDefault(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete address' })
  @ApiResponse({ status: 200, description: 'Address deleted' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.addressesService.remove(id, user.id);
  }
}
