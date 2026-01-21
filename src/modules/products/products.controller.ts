import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole, ProductStatus } from '@prisma/client';
import { ProductEntity } from './entities/product.entity';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create new product (Admin only)' })
  @ApiResponse({ status: 201, type: ProductEntity })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiQuery({ name: 'status', required: false, enum: ProductStatus })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'country', required: false, description: 'Filter by country ISO code (e.g., US, IN, GB)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  findAll(
    @Query('status') status?: ProductStatus,
    @Query('category') category?: string,
    @Query('country') country?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.findAll({ status, category, country, page, limit });
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Get all product categories' })
  @ApiResponse({ status: 200 })
  getCategories() {
    return this.productsService.getCategories();
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search products' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'country', required: false, description: 'Filter by country ISO code (e.g., US, IN, GB)' })
  @ApiResponse({ status: 200 })
  search(
    @Query('q') query: string,
    @Query('category') category?: string,
    @Query('country') country?: string,
  ) {
    return this.productsService.searchProducts(query, { category, country });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, type: ProductEntity })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update product (Admin only)' })
  @ApiResponse({ status: 200, type: ProductEntity })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/deactivate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate product (Admin only)' })
  @ApiResponse({ status: 200 })
  deactivate(@Param('id') id: string) {
    return this.productsService.deactivate(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Permanently delete product (Admin only)' })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string, @Body() body: { deletedBy: string; reason?: string }) {
    return this.productsService.remove(id, body.deletedBy, body.reason);
  }

  // ==================== Product Variant Endpoints ====================

  @Post('variants')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create product variant (Admin only)' })
  @ApiResponse({ status: 201 })
  createVariant(@Body() createVariantDto: CreateProductVariantDto) {
    return this.productsService.createVariant(createVariantDto);
  }

  @Public()
  @Get(':productId/variants')
  @ApiOperation({ summary: 'Get all variants for a product' })
  @ApiResponse({ status: 200 })
  getProductVariants(@Param('productId') productId: string) {
    return this.productsService.getProductVariants(productId);
  }

  @Patch('variants/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update product variant (Admin only)' })
  @ApiResponse({ status: 200 })
  updateVariant(
    @Param('id') id: string,
    @Body() updateVariantDto: UpdateProductVariantDto,
  ) {
    return this.productsService.updateVariant(id, updateVariantDto);
  }

  @Patch('variants/:id/set-default')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Set variant as default (Admin only)' })
  @ApiResponse({ status: 200 })
  setDefaultVariant(@Param('id') id: string) {
    return this.productsService.setDefaultVariant(id);
  }

  @Delete('variants/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete product variant (Admin only)' })
  @ApiResponse({ status: 200 })
  deleteVariant(@Param('id') id: string) {
    return this.productsService.deleteVariant(id);
  }
}
