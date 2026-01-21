import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string | null;
  role: UserRole;
  jti?: string; // Optional JWT ID for uniqueness
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') ?? '',
      passReqToCallback: true, // SECURITY: Pass request to access token
    });
  }

  async validate(req: any, payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phoneNumber: true,
        countryCode: true,
        email: true,
        role: true,
        userType: true,
        status: true,
        kycStatus: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // SECURITY CRITICAL: Check if token has been revoked
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Check if session exists and is not revoked
      const session = await this.prisma.userSession.findUnique({
        where: { token },
        select: { revokedAt: true },
      });

      // If session doesn't exist or has been revoked, deny access
      if (!session || session.revokedAt) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    return user;
  }
}
