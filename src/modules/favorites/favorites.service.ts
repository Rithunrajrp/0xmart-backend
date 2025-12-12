import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async addToFavorites(userId: string, productId: string) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if already in favorites
    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Product already in favorites');
    }

    return this.prisma.favorite.create({
      data: {
        userId,
        productId,
      },
      include: {
        product: {
          include: {
            prices: true,
            seller: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
      },
    });
  }

  async removeFromFavorites(userId: string, productId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    await this.prisma.favorite.delete({
      where: { id: favorite.id },
    });

    return { success: true, message: 'Removed from favorites' };
  }

  async getUserFavorites(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              prices: true,
              seller: {
                select: {
                  id: true,
                  companyName: true,
                  logo: true,
                },
              },
              reviews: {
                where: { isApproved: true },
                select: {
                  rating: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ]);

    const favoritesWithAvgRating = favorites.map((fav) => {
      const avgRating =
        fav.product.reviews.length > 0
          ? fav.product.reviews.reduce((sum, r) => sum + r.rating, 0) /
            fav.product.reviews.length
          : 0;

      return {
        ...fav,
        product: {
          ...fav.product,
          avgRating: Math.round(avgRating * 10) / 10,
          reviewCount: fav.product.reviews.length,
        },
      };
    });

    return {
      favorites: favoritesWithAvgRating,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async checkIsFavorite(userId: string, productId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    return { isFavorite: !!favorite };
  }

  async getFavoriteProductIds(userId: string): Promise<string[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      select: { productId: true },
    });

    return favorites.map((f) => f.productId);
  }

  async clearFavorites(userId: string) {
    await this.prisma.favorite.deleteMany({
      where: { userId },
    });

    return { success: true, message: 'All favorites cleared' };
  }
}
