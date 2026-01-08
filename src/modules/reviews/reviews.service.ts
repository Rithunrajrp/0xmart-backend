import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createReviewDto: CreateReviewDto) {
    const { productId, rating, title, comment, images } = createReviewDto;

    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if user already reviewed this product
    const existingReview = await this.prisma.productReview.findFirst({
      where: {
        productId,
        userId,
      },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this product');
    }

    // Check if user purchased this product (optional - can be enabled later)
    const hasPurchased = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: {
            in: ['DELIVERED'],
          },
        },
      },
    });

    // Create review
    const review = await this.prisma.productReview.create({
      data: {
        productId,
        userId,
        rating,
        title: title || null,
        comment: comment || null,
        images: images ? (images as any) : null,
        isVerified: !!hasPurchased,
        isApproved: true, // Auto-approve for now, can add moderation later
      },
    });

    // Update product rating and review count
    await this.updateProductStats(productId);

    return review;
  }

  async findByProduct(productId: string, params?: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = params || {};
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where: {
          productId,
          isApproved: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      }),
      this.prisma.productReview.count({
        where: {
          productId,
          isApproved: true,
        },
      }),
    ]);

    // Transform to include user info (anonymized for privacy)
    const transformedReviews = reviews.map((review) => ({
      ...review,
      userId: review.userId ? review.userId.substring(0, 8) + '...' : null,
      userName: review.userId ? `User ${review.userId.substring(0, 8)}` : 'Anonymous',
    }));

    return {
      reviews: transformedReviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const review = await this.prisma.productReview.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async update(id: string, userId: string, updateReviewDto: UpdateReviewDto) {
    const review = await this.findOne(id);

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only edit your own reviews');
    }

    const updated = await this.prisma.productReview.update({
      where: { id },
      data: {
        ...updateReviewDto,
        images: updateReviewDto.images ? (updateReviewDto.images as any) : (review.images as any),
      },
    });

    // Update product stats if rating changed
    if (updateReviewDto.rating && updateReviewDto.rating !== review.rating) {
      await this.updateProductStats(review.productId);
    }

    return updated;
  }

  async remove(id: string, userId: string) {
    const review = await this.findOne(id);

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.prisma.productReview.delete({
      where: { id },
    });

    // Update product stats
    await this.updateProductStats(review.productId);

    return { message: 'Review deleted successfully' };
  }

  async getMyReviews(userId: string, params?: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = params || {};
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      }),
      this.prisma.productReview.count({
        where: { userId },
      }),
    ]);

    return {
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async updateProductStats(productId: string) {
    // Calculate average rating and total reviews
    const stats = await this.prisma.productReview.aggregate({
      where: {
        productId,
        isApproved: true,
      },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    });

    const avgRating = stats._avg.rating || 0;
    const totalReviews = stats._count.id || 0;

    // Update product
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        rating: avgRating,
        totalReviews,
      },
    });
  }

  async markHelpful(id: string) {
    const review = await this.findOne(id);

    return this.prisma.productReview.update({
      where: { id },
      data: {
        helpfulCount: review.helpfulCount + 1,
      },
    });
  }
}
