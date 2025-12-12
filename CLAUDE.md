# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

0xMart Backend is a NestJS v11 backend for a multi-currency stablecoin commerce platform. It supports cryptocurrency wallet management, fiat-to-crypto purchases (Stripe/Razorpay), automated deposit/withdrawal processing, KYC verification, and e-commerce functionality.

## Commands

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debugger

# Build & Production
npm run build              # Compile TypeScript
npm run start:prod         # Run compiled code

# Code Quality
npm run lint               # ESLint with auto-fix
npm run format             # Prettier formatting

# Testing
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # End-to-end tests
npm run test:debug         # Run tests with Node debugger

# Database
npx prisma generate        # Generate Prisma client after schema changes
npx prisma migrate dev     # Create and run migrations
npx prisma migrate deploy  # Apply migrations in production
npx prisma studio          # Database GUI
npm run prisma:seed        # Seed database with initial data
```

## Architecture

### Module Structure

All feature modules live in `src/modules/`. Each module is self-contained with its own controller, service, DTOs, and entities:

- **auth/** - Email OTP authentication, JWT tokens (15m access, 7d refresh), 2FA (TOTP), session management
- **users/** - Profile management, shipping/billing addresses
- **wallets/** - HD wallet generation (BIP32/BIP39), multi-network support
- **kyc/** - Sumsub KYC integration with webhook callbacks
- **fiat-purchase/** - Stripe (global) and Razorpay (India) payment processing
- **deposit-monitor/** - Scheduled blockchain scanning for incoming deposits
- **withdrawal-processor/** - Automated withdrawal processing with approval workflow
- **products/** - Product catalog with multi-currency pricing
- **orders/** - Order management and checkout
- **sellers/** - Multi-seller marketplace with seller profiles and product management
- **commissions/** - Commission tracking for external API users and sellers
- **favorites/** - User favorite products functionality
- **api-keys/** - API key generation with rate limiting, billing tiers, key rotation
- **ads/** - Ad recommendations and click tracking for external developers
- **external-payment/** - 402 Payment Protocol with customer verification flow
- **webhooks/** - Webhook notifications for payment events to developers
- **employees/** - Employee management with role-based permissions and activity tracking
- **superadmin/** - Super admin functionality for platform management
- **master-keys/** - Master key management for secure operations

### Core Patterns

**Guard-Based Access Control:**
- `JwtAuthGuard` validates JWT on all routes except those marked `@Public()` (applied globally via APP_GUARD)
- `RolesGuard` enforces role-based access via `@Roles()` decorator (supports USER, ADMIN, SUPER_ADMIN, EMPLOYEE)
- `ApiKeyGuard` validates external API keys for third-party integrations
- `EmailDomainGuard` restricts access to @0xmart.com email domains
- `SuperAdminGuard` restricts access to super admin operations
- `EmployeePermissionGuard` enforces granular employee permissions

**Global Validation:**
- `ValidationPipe` with class-validator enabled globally
- DTOs define validation rules and transform input data

**Scheduled Tasks:**
- `DepositMonitorService` scans blockchain for deposits periodically
- `WithdrawalProcessorService` processes pending withdrawals in batches

### Key Services

- `AddressGeneratorService` - Generates deterministic wallet addresses from master seed (BIP44 derivation path: m/44'/60'/0'/0/{index})
- `BlockchainService` - RPC interactions, balance checks, transaction sending across 9 networks
- `ExchangeRateService` - Cached exchange rates (5-minute TTL)
- `TokenService` - JWT generation and refresh token management
- `EmailService` - SendGrid integration with templated emails
- `TwoFactorService` - TOTP-based 2FA (Google Authenticator compatible)
- `EmployeeActivityService` - Tracks employee actions for audit trails

### Database

Prisma ORM with PostgreSQL. Schema at `prisma/schema.prisma`.

**Key models**: User, UserSession, UserAddress, Wallet, Deposit, Withdrawal, Transaction, FiatPurchase, Product, Order, OrderItem, ApiKey, Seller, Commission, Favorite, Employee, KYCDocument, AuditLog

**Enums**:
- UserRole: USER, ADMIN, SUPER_ADMIN, EMPLOYEE
- KYCStatus: NOT_STARTED, PENDING, APPROVED, REJECTED, EXPIRED
- StablecoinType: USDT, USDC, DAI, BUSD
- NetworkType: ETHEREUM, POLYGON, BSC, ARBITRUM, OPTIMISM, AVALANCHE, BASE, SUI, TON
- TransactionStatus: PENDING, COMPLETED, FAILED, CANCELLED

**Important**: All crypto amounts use Decimal(20,8) precision

### Configuration

Environment-based config in `config/configuration.ts`. Key env vars:

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET`, `JWT_REFRESH_SECRET` - Token signing keys
- `MASTER_SEED` - BIP39 mnemonic for HD wallet generation (store securely in production)

**Email (SendGrid)**:
- `SENDGRID_API_KEY` - SendGrid API key
- `SENDGRID_FROM_EMAIL` - Sender email address
- Multiple template IDs for OTP, deposits, withdrawals, KYC, orders

**Payment Providers**:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe (global)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` - Razorpay (India)

**Blockchain RPC URLs**:
- `ETHEREUM_RPC_URL`, `POLYGON_RPC_URL`, `BSC_RPC_URL`, `ARBITRUM_RPC_URL`, `OPTIMISM_RPC_URL`

**KYC (Sumsub)**:
- `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_BASE_URL`

**Optional**:
- `PORT` (default: 3000), `API_PREFIX` (default: api/v1)
- `FRONTEND_URL` - For CORS
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - SMS support (future)

### API Documentation

Swagger UI available at `/api/v1/docs` in non-production environments.

## External API (402 Payment Protocol)

The platform provides APIs for external developers to integrate product recommendations and payment processing:

### API Flow
1. **Developer Onboarding** - Create API key with `api_key` and `api_secret` via `/api-keys`
2. **Get Recommendations** - `POST /api/v1/ads/get-recommendations` with customer preferences
3. **Track Ad Click** - `POST /api/v1/ads/open` with click token
4. **Initiate Payment** - `POST /api/v1/payment/initiate` with customer phone/email
5. **Customer Verification** - Phone/email OTP verification, address collection
6. **Network Selection** - Get deposit address for selected blockchain
7. **Payment Confirmation** - `POST /api/v1/payment/confirm` with txHash

### Customer Verification Cases
- Phone+Email match existing customer → May skip verification if recent
- Phone exists with different email → Error: `EMAIL_MISMATCH`
- New customer → Full OTP verification required

### Deposit Address Rules
- Reuse address if customer verified within 30 days
- Generate new address if suspicious behavior detected
- Addresses expire after 24 hours of inactivity
- Keep using address if pending balance exists

### Webhook Events
Developers receive webhooks for: `PAYMENT_INITIATED`, `PAYMENT_DETECTED`, `PAYMENT_CONFIRMED`, `PAYMENT_FAILED`, `ORDER_SHIPPED`, `ORDER_DELIVERED`

## Code Conventions

**DTOs and Validation**:
- All request/response data must use DTOs with class-validator decorators
- Enable transformations with `@Transform()` for type coercion
- Use `@IsOptional()` for optional fields, `@IsNotEmpty()` for required fields

**Authentication**:
- Mark public endpoints with `@Public()` decorator (bypasses JwtAuthGuard)
- Use `@Roles()` decorator for role-based access control
- Access authenticated user via `@CurrentUser()` decorator
- External API endpoints use `ApiKeyGuard` instead of `JwtAuthGuard`

**Swagger Documentation**:
- Add `@ApiTags()` to controllers
- Use `@ApiOperation()` for endpoint descriptions
- Document responses with `@ApiResponse()`
- Add `@ApiBearerAuth()` for protected endpoints

**Webhooks**:
- All webhook endpoints must be marked `@Public()`
- Implement idempotency checks using unique event IDs
- Verify webhook signatures (Stripe, Razorpay, Sumsub)

**Database Operations**:
- All crypto amounts use Decimal(20,8) precision
- Use Prisma transactions for multi-step operations
- Index frequently queried fields

**Cross-Module Communication**:
- Export services from module files for cross-module usage
- Inject exported services via constructor
- Avoid circular dependencies

**Custom Decorators** (in `src/common/decorators/`):
- `@Public()` - Bypass JWT authentication
- `@Roles(...roles)` - Require specific roles
- `@CurrentUser()` - Extract user from request
- `@ZeroXMartEmail()` - Validate @0xmart.com email domain
