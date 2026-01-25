import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';

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

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list or matches localhost/0xmart.com pattern
      if (
        allowedOrigins.includes(origin) ||
        origin.match(/^http:\/\/(.*\.)?localhost:3000$/) ||
        origin.match(/^https:\/\/(.*\.)?0xmart\.com$/)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
