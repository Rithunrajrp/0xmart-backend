import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { JwtPayload } from '../strategies/jwt.strategy';
import { UserRole } from '@prisma/client';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async generateTokens(userId: string, email: string | null, role: UserRole) {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as any, {
        secret: this.configService.get<string>('jwt.secret') ?? '',
        expiresIn: this.configService.get<string>('jwt.expiresIn') ?? '30d',
      } as any),
      this.jwtService.signAsync(payload as any, {
        secret: this.configService.get<string>('jwt.refreshSecret') ?? '',
        expiresIn:
          this.configService.get<string>('jwt.refreshExpiresIn') ?? '60d',
      } as any),
    ]);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60); // 60 days

    await this.prisma.userSession.create({
      data: {
        userId,
        token: accessToken,
        refreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const session = await this.prisma.userSession.findUnique({
        where: { refreshToken },
        include: { user: true },
      });

      if (!session || session.revokedAt) {
        throw new Error('Invalid refresh token');
      }

      // Revoke old session
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      // Generate new tokens
      return this.generateTokens(
        session.user.id,
        session.user.email,
        session.user.role,
      );
    } catch (error) {
      throw new Error(`Invalid or expired refresh token: ${error}`);
    }
  }

  async revokeToken(token: string) {
    await this.prisma.userSession.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserTokens(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
