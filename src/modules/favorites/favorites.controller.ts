import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
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
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':productId')
  @ApiOperation({ summary: 'Add product to favorites' })
  @ApiResponse({ status: 201 })
  addToFavorites(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.addToFavorites(user.id, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove product from favorites' })
  @ApiResponse({ status: 200 })
  removeFromFavorites(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.removeFromFavorites(user.id, productId);
  }

  @Get()
  @ApiOperation({ summary: 'Get user favorites' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  getUserFavorites(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.favoritesService.getUserFavorites(user.id, page, limit);
  }

  @Get('check/:productId')
  @ApiOperation({ summary: 'Check if product is in favorites' })
  @ApiResponse({ status: 200 })
  checkIsFavorite(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.checkIsFavorite(user.id, productId);
  }

  @Get('product-ids')
  @ApiOperation({ summary: 'Get all favorite product IDs' })
  @ApiResponse({ status: 200 })
  getFavoriteProductIds(@CurrentUser() user: any) {
    return this.favoritesService.getFavoriteProductIds(user.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear all favorites' })
  @ApiResponse({ status: 200 })
  clearFavorites(@CurrentUser() user: any) {
    return this.favoritesService.clearFavorites(user.id);
  }
}
