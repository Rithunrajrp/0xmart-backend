import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;
  const apiPrefix = configService.get<string>('apiPrefix') ?? 'api';

  // Security
  app.use(helmet());

  // Cookie parser - Required for CSRF protection
  app.use(cookieParser());

  // CORS - Allow multiple origins including subdomains
  const allowedOrigins = [
    // Local development
    'http://localhost:3000',
    'http://localhost:5173', // Mini app
    'http://superadmin.localhost:3000',
    'http://merchant.localhost:3000',
    'http://admin.localhost:3000',
    // Production domains
    'https://0xmart.com',
    'https://www.0xmart.com',
    'https://admin.0xmart.com',
    'https://merchant.0xmart.com',
    'https://superadmin.0xmart.com',
    'https://app.0xmart.com',
    // Custom frontend URL
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  // Stricter CORS configuration (SEC-BE-006)
  app.enableCors({
    origin: (origin, callback) => {
      // For requests without origin (server-to-server, mobile apps, Postman)
      if (!origin) {
        // Note: Requests without origin are allowed but must be authenticated via:
        // - ApiKeyGuard for external API endpoints
        // - JwtAuthGuard for mobile app endpoints
        // - Public endpoints (webhooks, health checks)
        //
        // This is necessary for:
        // 1. Webhook callbacks from Stripe/Razorpay/Sumsub (no origin)
        // 2. Server-to-server API key integrations
        // 3. Mobile apps (React Native doesn't send Origin header)
        //
        // Protection: CsrfGuard only validates requests WITH origin (browser requests)
        return callback(null, true);
      }

      // For browser requests (always have Origin header), validate against whitelist
      if (
        allowedOrigins.includes(origin) ||
        origin.match(/^http:\/\/(.*\.)?localhost:3000$/) ||
        origin.match(/^http:\/\/(.*\.)?localhost:5173$/) || // Mini app
        origin.match(/^https:\/\/(.*\.)?0xmart\.com$/)
      ) {
        callback(null, true);
      } else {
        logger.log(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-API-Key',
      'X-API-Secret',
    ],
  });

  // Compression

  app.use(compression());

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Stablecoin Commerce API')
      .setDescription('Enterprise-level stablecoin commerce platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('wallets', 'Wallet operations')
      .addTag('transactions', 'Transaction history')
      .addTag('products', 'Product catalog')
      .addTag('orders', 'Order management')
      .addTag('kyc', 'KYC verification')
      .addTag('fiat-purchase', 'Fiat to stablecoin purchases')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  logger.log(
    `📚 Swagger documentation: http://localhost:${port}/${apiPrefix}/docs`,
  );
  logger.log(
    `📱 Mobile/Network access: http://172.20.10.2:${port}/${apiPrefix}`,
  );
}

bootstrap().catch((err) => {
  // log the error and exit with failure
  console.error(err);
  process.exit(1);
});
