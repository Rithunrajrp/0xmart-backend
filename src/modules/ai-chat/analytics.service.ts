import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatRole } from '@prisma/client';

export interface UserPreferenceInsights {
  userId?: string;
  totalSessions: number;
  totalMessages: number;
  averageMessagesPerSession: number;
  topSearchedCategories: { category: string; count: number }[];
  topSearchedProducts: { product: string; count: number }[];
  commonPriceRanges: { range: string; count: number }[];
  popularNetworks: { network: string; count: number }[];
  popularStablecoins: { stablecoin: string; count: number }[];
  mostActiveHours: { hour: number; count: number }[];
  conversionMetrics: {
    sessionsWithCartAdd: number;
    sessionsWithOrder: number;
    conversionRate: number;
  };
}

export interface ProductInterestAnalysis {
  productMentions: { productName: string; mentions: number }[];
  categoryInterest: { category: string; searches: number }[];
  pricePreferences: { avgMin: number; avgMax: number };
}

@Injectable()
export class ChatAnalyticsService {
  private readonly logger = new Logger(ChatAnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get comprehensive user preference insights for a specific user
   */
  async getUserPreferences(userId: string): Promise<UserPreferenceInsights> {
    // Get recent user sessions (last 30 days) with limited messages
    // to prevent N+1 query and excessive memory usage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sessions = await this.prisma.chatSession.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo }, // Only recent sessions
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20, // Limit to last 20 messages per session
        },
      },
      take: 50, // Limit to 50 most recent sessions
      orderBy: { createdAt: 'desc' },
    });

    const totalSessions = sessions.length;
    const allMessages = sessions.flatMap(s => s.messages);
    const userMessages = allMessages.filter(m => m.role === ChatRole.USER);

    // Extract insights from message content
    const categoryMentions = this.extractCategoryMentions(userMessages);
    const productMentions = this.extractProductMentions(userMessages);
    const priceRanges = this.extractPriceRanges(userMessages);
    const networkMentions = this.extractNetworkMentions(userMessages);
    const stablecoinMentions = this.extractStablecoinMentions(userMessages);
    const messageHours = this.extractMessageHours(userMessages);

    // Calculate conversion metrics
    const sessionsWithCartAdd = sessions.filter(s =>
      s.messages.some(m => m.metadata && JSON.stringify(m.metadata).includes('add_to_cart'))
    ).length;

    const sessionsWithOrder = sessions.filter(s =>
      s.messages.some(m => m.metadata && JSON.stringify(m.metadata).includes('place_order'))
    ).length;

    return {
      userId,
      totalSessions,
      totalMessages: allMessages.length,
      averageMessagesPerSession: totalSessions > 0 ? allMessages.length / totalSessions : 0,
      topSearchedCategories: categoryMentions,
      topSearchedProducts: productMentions,
      commonPriceRanges: priceRanges,
      popularNetworks: networkMentions,
      popularStablecoins: stablecoinMentions,
      mostActiveHours: messageHours,
      conversionMetrics: {
        sessionsWithCartAdd,
        sessionsWithOrder,
        conversionRate: totalSessions > 0 ? (sessionsWithOrder / totalSessions) * 100 : 0,
      },
    };
  }

  /**
   * Get platform-wide analytics (all users)
   */
  async getPlatformAnalytics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalUsers: number;
    totalSessions: number;
    totalMessages: number;
    topCategories: { category: string; count: number }[];
    topProducts: { product: string; count: number }[];
    dailyActiveUsers: { date: string; users: number }[];
  }> {
    const whereClause: any = {};
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const sessions = await this.prisma.chatSession.findMany({
      where: whereClause,
      include: {
        messages: {
          where: { role: ChatRole.USER },
        },
      },
    });

    const uniqueUsers = new Set(sessions.map(s => s.userId).filter(Boolean));
    const allUserMessages = sessions.flatMap(s => s.messages);

    const categoryMentions = this.extractCategoryMentions(allUserMessages);
    const productMentions = this.extractProductMentions(allUserMessages);

    // Calculate daily active users
    const dailyUsers = this.calculateDailyActiveUsers(sessions);

    return {
      totalUsers: uniqueUsers.size,
      totalSessions: sessions.length,
      totalMessages: allUserMessages.length,
      topCategories: categoryMentions.slice(0, 10),
      topProducts: productMentions.slice(0, 10),
      dailyActiveUsers: dailyUsers,
    };
  }

  /**
   * Get product interest analysis from chat history
   */
  async getProductInterestAnalysis(): Promise<ProductInterestAnalysis> {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        role: ChatRole.USER,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    const productMentions = this.extractProductMentions(messages);
    const categoryInterest = this.extractCategoryMentions(messages);
    const pricePreferences = this.calculatePricePreferences(messages);

    return {
      productMentions: productMentions.map(p => ({ productName: p.product, mentions: p.count })),
      categoryInterest: categoryInterest.map(c => ({ category: c.category, searches: c.count })),
      pricePreferences,
    };
  }

  /**
   * Search chat history for specific keywords
   */
  async searchChatHistory(
    keyword: string,
    userId?: string,
  ): Promise<{
    matches: number;
    sessions: { sessionId: string; userId?: string; matches: string[] }[];
  }> {
    const whereClause: any = {
      role: ChatRole.USER,
      content: {
        contains: keyword,
        mode: 'insensitive',
      },
    };

    if (userId) {
      whereClause.session = { userId };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: whereClause,
      include: {
        session: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    const sessionMap = new Map<string, { userId?: string; matches: string[] }>();

    for (const msg of messages) {
      const sessionId = msg.session.id;
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          userId: msg.session.userId || undefined,
          matches: [],
        });
      }
      sessionMap.get(sessionId)!.matches.push(msg.content);
    }

    const sessions = Array.from(sessionMap.entries()).map(([sessionId, data]) => ({
      sessionId,
      userId: data.userId,
      matches: data.matches,
    }));

    return {
      matches: messages.length,
      sessions,
    };
  }

  // ─── Private helper methods ─────────────────────────────────────

  private extractCategoryMentions(messages: any[]): { category: string; count: number }[] {
    const categories = [
      'electronics', 'clothing', 'food', 'beverage', 'beauty', 'health',
      'sports', 'home', 'garden', 'toys', 'books', 'automotive',
    ];

    const mentions = new Map<string, number>();

    for (const msg of messages) {
      const content = msg.content.toLowerCase();
      for (const category of categories) {
        if (content.includes(category)) {
          mentions.set(category, (mentions.get(category) || 0) + 1);
        }
      }
    }

    return Array.from(mentions.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  private extractProductMentions(messages: any[]): { product: string; count: number }[] {
    const productKeywords = new Map<string, number>();

    for (const msg of messages) {
      const content = msg.content.toLowerCase();

      // Extract common product-related words (nouns)
      const words = content.match(/\b[a-z]{4,}\b/g) || [];

      for (const word of words) {
        // Filter out common words
        if (!this.isCommonWord(word)) {
          productKeywords.set(word, (productKeywords.get(word) || 0) + 1);
        }
      }
    }

    return Array.from(productKeywords.entries())
      .map(([product, count]) => ({ product, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private extractPriceRanges(messages: any[]): { range: string; count: number }[] {
    const ranges = {
      'under_10': 0,
      '10_50': 0,
      '50_100': 0,
      '100_500': 0,
      'over_500': 0,
    };

    for (const msg of messages) {
      const content = msg.content.toLowerCase();

      // Look for price patterns like "$50", "50 dollars", "under 100"
      const priceMatch = content.match(/\$?(\d+)/);
      if (priceMatch) {
        const price = parseInt(priceMatch[1]);

        if (price < 10) ranges.under_10++;
        else if (price < 50) ranges['10_50']++;
        else if (price < 100) ranges['50_100']++;
        else if (price < 500) ranges['100_500']++;
        else ranges.over_500++;
      }
    }

    return Object.entries(ranges)
      .map(([range, count]) => ({ range: range.replace('_', '-'), count }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  private extractNetworkMentions(messages: any[]): { network: string; count: number }[] {
    const networks = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism', 'avalanche', 'base', 'sui'];
    const mentions = new Map<string, number>();

    for (const msg of messages) {
      const content = msg.content.toLowerCase();
      for (const network of networks) {
        if (content.includes(network)) {
          mentions.set(network.toUpperCase(), (mentions.get(network.toUpperCase()) || 0) + 1);
        }
      }
    }

    return Array.from(mentions.entries())
      .map(([network, count]) => ({ network, count }))
      .sort((a, b) => b.count - a.count);
  }

  private extractStablecoinMentions(messages: any[]): { stablecoin: string; count: number }[] {
    const stablecoins = ['usdt', 'usdc', 'dai', 'busd'];
    const mentions = new Map<string, number>();

    for (const msg of messages) {
      const content = msg.content.toLowerCase();
      for (const coin of stablecoins) {
        if (content.includes(coin)) {
          mentions.set(coin.toUpperCase(), (mentions.get(coin.toUpperCase()) || 0) + 1);
        }
      }
    }

    return Array.from(mentions.entries())
      .map(([stablecoin, count]) => ({ stablecoin, count }))
      .sort((a, b) => b.count - a.count);
  }

  private extractMessageHours(messages: any[]): { hour: number; count: number }[] {
    const hourCounts = new Map<number, number>();

    for (const msg of messages) {
      const hour = new Date(msg.createdAt).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    return Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);
  }

  private calculateDailyActiveUsers(sessions: any[]): { date: string; users: number }[] {
    const dailyUsers = new Map<string, Set<string>>();

    for (const session of sessions) {
      if (!session.userId) continue;

      const date = session.createdAt.toISOString().split('T')[0];
      if (!dailyUsers.has(date)) {
        dailyUsers.set(date, new Set());
      }
      dailyUsers.get(date)!.add(session.userId);
    }

    return Array.from(dailyUsers.entries())
      .map(([date, users]) => ({ date, users: users.size }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculatePricePreferences(messages: any[]): { avgMin: number; avgMax: number } {
    const prices: number[] = [];

    for (const msg of messages) {
      const content = msg.content.toLowerCase();
      const priceMatches = content.match(/\$?(\d+)/g);

      if (priceMatches) {
        for (const match of priceMatches) {
          const price = parseInt(match.replace('$', ''));
          if (price > 0 && price < 10000) {
            prices.push(price);
          }
        }
      }
    }

    if (prices.length === 0) {
      return { avgMin: 0, avgMax: 0 };
    }

    prices.sort((a, b) => a - b);
    const p25 = prices[Math.floor(prices.length * 0.25)];
    const p75 = prices[Math.floor(prices.length * 0.75)];

    return {
      avgMin: p25 || 0,
      avgMax: p75 || 0,
    };
  }

  private isCommonWord(word: string): boolean {
    const commonWords = [
      'show', 'find', 'search', 'want', 'need', 'looking', 'have', 'using',
      'with', 'under', 'over', 'about', 'from', 'this', 'that', 'what',
      'where', 'when', 'which', 'some', 'many', 'much', 'more', 'less',
    ];
    return commonWords.includes(word);
  }
}
