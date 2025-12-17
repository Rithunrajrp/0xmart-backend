export default () => ({
  port: parseInt(process.env.PORT || '3000', 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '30d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '60d',
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL,
    fromName: process.env.SENDGRID_FROM_NAME || '0xMart',
    otpTemplateId: process.env.SENDGRID_OTP_TEMPLATE_ID,
    depositTemplateId: process.env.SENDGRID_DEPOSIT_TEMPLATE_ID,
    withdrawalTemplateId: process.env.SENDGRID_WITHDRAWAL_TEMPLATE_ID,
    withdrawalFailedTemplateId:
      process.env.SENDGRID_WITHDRAWAL_FAILED_TEMPLATE_ID,
    welcomeTemplateId: process.env.SENDGRID_WELCOME_TEMPLATE_ID,
    transactionTemplateId: process.env.SENDGRID_TRANSACTION_TEMPLATE_ID,
    kycApprovedTemplateId: process.env.SENDGRID_KYC_APPROVED_TEMPLATE_ID,
    kycRejectedTemplateId: process.env.SENDGRID_KYC_REJECTED_TEMPLATE_ID,
    orderConfirmedTemplateId: process.env.SENDGRID_ORDER_CONFIRMED_TEMPLATE_ID,
    orderShippedTemplateId: process.env.SENDGRID_ORDER_SHIPPED_TEMPLATE_ID,
    supportLink: process.env.SUPPORT_LINK || 'https://support.0xmart.com/help',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID, // Add this
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },
  kyc: {
    provider: 'sumsub',
    appToken: process.env.SUMSUB_APP_TOKEN,
    secretKey: process.env.SUMSUB_SECRET_KEY,
    baseUrl: process.env.SUMSUB_BASE_URL,
  },
  blockchain: {
    // EVM Networks - uses testnet in development, mainnet in production
    ethereum:
      process.env.NODE_ENV === 'development'
        ? process.env.ETHEREUM_SEPOLIA_RPC_URL || process.env.ETHEREUM_RPC_URL
        : process.env.ETHEREUM_RPC_URL,
    polygon:
      process.env.NODE_ENV === 'development'
        ? process.env.POLYGON_AMOY_RPC_URL || process.env.POLYGON_RPC_URL
        : process.env.POLYGON_RPC_URL,
    bsc:
      process.env.NODE_ENV === 'development'
        ? process.env.BSC_TESTNET_RPC_URL || process.env.BSC_RPC_URL
        : process.env.BSC_RPC_URL,
    arbitrum:
      process.env.NODE_ENV === 'development'
        ? process.env.ARBITRUM_SEPOLIA_RPC_URL || process.env.ARBITRUM_RPC_URL
        : process.env.ARBITRUM_RPC_URL,
    optimism:
      process.env.NODE_ENV === 'development'
        ? process.env.OPTIMISM_SEPOLIA_RPC_URL || process.env.OPTIMISM_RPC_URL
        : process.env.OPTIMISM_RPC_URL,
    avalanche:
      process.env.NODE_ENV === 'development'
        ? process.env.AVALANCHE_FUJI_RPC_URL || process.env.AVALANCHE_RPC_URL
        : process.env.AVALANCHE_RPC_URL,
    base:
      process.env.NODE_ENV === 'development'
        ? process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL
        : process.env.BASE_RPC_URL,
    // Solana - uses testnet in development, mainnet in production
    solana:
      process.env.NODE_ENV === 'development'
        ? process.env.SOLANA_TESTNET_RPC_URL || process.env.SOLANA_RPC_URL
        : process.env.SOLANA_RPC_URL,
    // SUI - uses testnet in development, mainnet in production
    sui:
      process.env.NODE_ENV === 'development'
        ? process.env.SUI_TESTNET_RPC_URL || process.env.SUI_RPC_URL
        : process.env.SUI_RPC_URL,
    // TON - uses testnet in development, mainnet in production
    ton:
      process.env.NODE_ENV === 'development'
        ? process.env.TON_TESTNET_RPC_URL || process.env.TON_RPC_URL
        : process.env.TON_RPC_URL,
    tonApiKey:
      process.env.NODE_ENV === 'development'
        ? process.env.TON_TESTNET_API_KEY || process.env.TON_API_KEY
        : process.env.TON_API_KEY,
  },
  encryption: {
    masterKeySecret: process.env.MASTER_KEY_ENCRYPTION_SECRET,
    masterKeySalt: process.env.MASTER_KEY_ENCRYPTION_SALT,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10) || 10,
  },
});
