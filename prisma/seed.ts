import { PrismaClient, SellerType, SellerStatus, ProductStatus, StablecoinType, NetworkType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning ALL existing data...');
  console.log('⚠️  WARNING: This will delete ALL data in the database!');
  console.log('');

  // Delete all data in reverse dependency order (comprehensive cleanup)
  await prisma.webhookLog.deleteMany();
  await prisma.commissionPayout.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.productReview.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.adClick.deleteMany();
  await prisma.productPrice.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.externalOrder.deleteMany();
  await prisma.product.deleteMany();
  await prisma.sellerDocument.deleteMany();
  await prisma.sellerPayout.deleteMany();
  await prisma.seller.deleteMany();
  await prisma.externalDepositAddress.deleteMany();
  await prisma.externalOtpVerification.deleteMany();
  await prisma.externalCustomer.deleteMany();
  await prisma.apiUsageLog.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.userAddress.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.kYCDocument.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.fiatPurchase.deleteMany();
  await prisma.employeeActivity.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.masterKeyAccessLog.deleteMany();
  await prisma.masterKey.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ All existing data cleared');
  console.log('');

  // ============================================
  // CREATE SUPER ADMIN USER
  // ============================================

  console.log('👤 Creating Super Admin user...');

  const superAdmin = await prisma.user.create({
    data: {
      email: 'rithun@0xmart.com',
      phoneNumber: '7871766466',
      countryCode: '+91',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`✅ Super Admin created: ${superAdmin.email} (ID: ${superAdmin.id})`);
  console.log('   📧 Email: rithun@0xmart.com');
  console.log('   📱 Phone: +91 7871766466');
  console.log('   🔑 Role: SUPER_ADMIN');
  console.log('   ℹ️  Development OTP: 123456 (for login)');
  console.log('');

  // ============================================
  // CREATE MERCHANT USER
  // ============================================

  console.log('👤 Creating Merchant user...');

  const merchantUser = await prisma.user.create({
    data: {
      email: 'rithunravi@gmail.com',
      phoneNumber: '8754011177',
      countryCode: '+91',
      role: 'USER',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`✅ Merchant User created: ${merchantUser.email} (ID: ${merchantUser.id})`);
  console.log('   📧 Email: rithunravi@gmail.com');
  console.log('   📱 Phone: +91 8754011177');
  console.log('   🔑 Role: USER');
  console.log('   ℹ️  Development OTP: 123456 (for login)');
  console.log('');
  console.log('🌱 Seeding enterprise-level data...');
  console.log('');

  // ============================================
  // SELLERS / COMPANIES
  // ============================================

  console.log('📦 Creating verified sellers...');

  const seller1 = await prisma.seller.create({
    data: {
      userId: merchantUser.id, // Link to merchant user
      companyName: 'TechNova Electronics India Pvt. Ltd.',
      tradingName: 'TechNova India',
      sellerType: SellerType.MANUFACTURER,
      status: SellerStatus.VERIFIED,
      registrationNumber: 'U74900KA2019PTC125896', // CIN (Corporate Identification Number)
      taxId: '29AABCT1234F1Z5', // GST Number (Karnataka)
      businessLicense: 'MSME-DL-07-12345678', // MSME/Udyam Registration
      email: 'rithunravi@gmail.com',
      phone: '+91-8754011177',
      website: 'https://technova.in',
      addressLine1: '#42, Electronic City Phase 1',
      addressLine2: 'Hosur Road',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560100',
      country: 'India',
      logo: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400',
      banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200',
      description: 'TechNova Electronics India is a leading manufacturer of premium consumer electronics, specializing in laptops, smartphones, and smart home devices. Based in Bangalore\'s Electronic City, we combine cutting-edge technology with elegant design. Our products are trusted by millions of customers across India and backed by comprehensive warranties and dedicated customer support.',
      rating: new Decimal('4.7'),
      totalReviews: 15847,
      totalSales: 89234,
      verifiedAt: new Date('2024-01-15'),
      verifiedBy: superAdmin.id,
      bankAccountName: 'TechNova Electronics India Pvt. Ltd.',
      bankAccountNumber: 'HDFC-****5678', // Masked
      bankName: 'HDFC Bank',
      bankRoutingNumber: 'HDFC0001234', // IFSC Code
      payoutWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
      payoutNetwork: NetworkType.POLYGON,
      commissionRate: new Decimal('0.08'),
      minOrderValue: new Decimal('500.00'),
      metadata: {
        certifications: ['ISO 9001', 'BIS', 'CE', 'RoHS'],
        shippingCountries: ['IN'],
        shippingStates: ['KA', 'TN', 'MH', 'DL', 'UP', 'WB', 'AP', 'TG'],
        averageProcessingTime: '24 hours',
        returnPolicy: '7-day return and replacement policy',
        warrantyPeriod: '1 year manufacturer warranty',
        panNumber: 'AABCT1234F', // PAN
        gstNumber: '29AABCT1234F1Z5',
        msmeNumber: 'UDYAM-KA-12-0012345',
        cinNumber: 'U74900KA2019PTC125896',
      },
    },
  });

  const seller2 = await prisma.seller.create({
    data: {
      companyName: 'StyleHub Fashion Ltd.',
      tradingName: 'StyleHub',
      sellerType: SellerType.RETAILER,
      status: SellerStatus.VERIFIED,
      registrationNumber: 'SH-2020-UK-123456',
      taxId: 'GB-VAT-987654321',
      email: 'contact@stylehub.co.uk',
      phone: '+44-20-7946-0958',
      website: 'https://stylehub.co.uk',
      addressLine1: '42 Fashion Street',
      addressLine2: 'Shoreditch',
      city: 'London',
      state: 'Greater London',
      postalCode: 'E1 6PX',
      country: 'United Kingdom',
      logo: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400',
      banner: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200',
      description: 'StyleHub is a premium fashion retailer offering curated collections of contemporary clothing and accessories for the modern individual. We partner with emerging designers and established brands to bring you the latest trends at competitive prices. Our commitment to sustainability and ethical sourcing sets us apart in the fashion industry.',
      rating: new Decimal('4.5'),
      totalReviews: 8932,
      totalSales: 45678,
      verifiedAt: new Date('2024-02-20'),
      verifiedBy: 'admin-002',
      bankAccountName: 'StyleHub Fashion Ltd.',
      bankName: 'Barclays Bank',
      payoutWalletAddress: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      payoutNetwork: NetworkType.POLYGON,
      commissionRate: new Decimal('0.10'),
      minOrderValue: new Decimal('15.00'),
      metadata: {
        certifications: ['Fair Trade', 'GOTS Certified', 'B Corp'],
        shippingCountries: ['UK', 'EU', 'US'],
        averageProcessingTime: '48 hours',
        returnPolicy: '60-day return policy',
      },
    },
  });

  const seller3 = await prisma.seller.create({
    data: {
      companyName: 'HomeLux Living Pte Ltd',
      tradingName: 'HomeLux',
      sellerType: SellerType.DISTRIBUTOR,
      status: SellerStatus.VERIFIED,
      registrationNumber: 'HL-2018-SG-789123',
      taxId: 'SG-GST-456789123',
      email: 'sales@homelux.sg',
      phone: '+65-6234-5678',
      website: 'https://homelux.sg',
      addressLine1: '150 Orchard Road',
      addressLine2: '#05-01 Orchard Plaza',
      city: 'Singapore',
      postalCode: '238841',
      country: 'Singapore',
      logo: 'https://images.unsplash.com/photo-1556912173-3bb406ef7e77?w=400',
      banner: 'https://images.unsplash.com/photo-1556912167-f556f1f39faa?w=1200',
      description: 'HomeLux is Asia\'s premier distributor of luxury home furnishings and décor. We source products from renowned international brands and deliver them directly to your doorstep. From elegant furniture to designer lighting, we help you create the home of your dreams with products that combine functionality and aesthetics.',
      rating: new Decimal('4.8'),
      totalReviews: 6234,
      totalSales: 23456,
      verifiedAt: new Date('2024-01-10'),
      verifiedBy: 'admin-001',
      bankAccountName: 'HomeLux Living Pte Ltd',
      bankName: 'DBS Bank',
      payoutWalletAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      payoutNetwork: NetworkType.POLYGON,
      commissionRate: new Decimal('0.09'),
      minOrderValue: new Decimal('25.00'),
      metadata: {
        certifications: ['ISO 14001', 'FSC Certified'],
        shippingCountries: ['SG', 'MY', 'TH', 'ID', 'PH'],
        averageProcessingTime: '3-5 business days',
        returnPolicy: '14-day return policy',
        warrantyPeriod: '1 year',
      },
    },
  });

  const seller4 = await prisma.seller.create({
    data: {
      companyName: 'BeautyCore Cosmetics LLC',
      tradingName: 'BeautyCore',
      sellerType: SellerType.BRAND,
      status: SellerStatus.VERIFIED,
      registrationNumber: 'BC-2021-US-345678',
      taxId: 'US-EIN-345678912',
      email: 'hello@beautycore.com',
      phone: '+1-310-555-7890',
      website: 'https://beautycore.com',
      addressLine1: '8950 Sunset Boulevard',
      city: 'Los Angeles',
      state: 'California',
      postalCode: '90069',
      country: 'United States',
      logo: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400',
      banner: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200',
      description: 'BeautyCore is an innovative cosmetics brand dedicated to clean, cruelty-free beauty products. Our scientifically-formulated skincare and makeup lines are made with natural, sustainable ingredients. We believe beauty should never come at the expense of your health or the environment. All our products are dermatologically tested and suitable for sensitive skin.',
      rating: new Decimal('4.6'),
      totalReviews: 12543,
      totalSales: 67890,
      verifiedAt: new Date('2024-03-01'),
      verifiedBy: 'admin-003',
      bankAccountName: 'BeautyCore Cosmetics LLC',
      bankName: 'Bank of America',
      payoutWalletAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      payoutNetwork: NetworkType.ETHEREUM,
      commissionRate: new Decimal('0.12'),
      minOrderValue: new Decimal('20.00'),
      metadata: {
        certifications: ['Cruelty-Free', 'Vegan', 'Leaping Bunny', 'EWG Verified'],
        shippingCountries: ['US', 'CA', 'UK', 'AU'],
        averageProcessingTime: '24-48 hours',
        returnPolicy: '90-day satisfaction guarantee',
      },
    },
  });

  const seller5 = await prisma.seller.create({
    data: {
      companyName: 'ActiveFit Sports GmbH',
      tradingName: 'ActiveFit',
      sellerType: SellerType.MANUFACTURER,
      status: SellerStatus.VERIFIED,
      registrationNumber: 'AF-2019-DE-987654',
      taxId: 'DE-VAT-123987456',
      email: 'info@activefit.de',
      phone: '+49-89-1234-5678',
      website: 'https://activefit.de',
      addressLine1: 'Sportstraße 45',
      city: 'Munich',
      state: 'Bavaria',
      postalCode: '80809',
      country: 'Germany',
      logo: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400',
      banner: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200',
      description: 'ActiveFit is a German sports equipment manufacturer with a legacy of engineering excellence. For over 20 years, we\'ve been producing high-performance athletic gear for professionals and fitness enthusiasts alike. Our products undergo rigorous testing to ensure durability, comfort, and optimal performance in any sporting environment.',
      rating: new Decimal('4.7'),
      totalReviews: 9871,
      totalSales: 38654,
      verifiedAt: new Date('2024-02-15'),
      verifiedBy: 'admin-002',
      bankAccountName: 'ActiveFit Sports GmbH',
      bankName: 'Deutsche Bank',
      payoutWalletAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      payoutNetwork: NetworkType.ETHEREUM,
      commissionRate: new Decimal('0.10'),
      minOrderValue: new Decimal('30.00'),
      metadata: {
        certifications: ['ISO 9001', 'Oeko-Tex Standard 100'],
        shippingCountries: ['DE', 'AT', 'CH', 'EU', 'UK', 'US'],
        averageProcessingTime: '2-3 business days',
        returnPolicy: '30-day return policy',
        warrantyPeriod: '2 years',
      },
    },
  });

  console.log(`✅ Created ${5} verified sellers`);
  console.log('');

  // ============================================
  // PRODUCTS - ELECTRONICS
  // ============================================

  console.log('💻 Creating Electronics products...');

  const product1 = await prisma.product.create({
    data: {
      sellerId: seller1.id,
      name: 'TechNova ProBook X1 Laptop - 15.6" 4K Display',
      shortDescription: 'Ultra-thin professional laptop with 4K display, Intel i7, 32GB RAM, 1TB SSD',
      description: `The TechNova ProBook X1 represents the pinnacle of mobile computing. Engineered for professionals who demand uncompromising performance, this laptop features a stunning 15.6" 4K OLED display with 100% DCI-P3 color gamut, perfect for creative work and media consumption.

**Performance Features:**
- 12th Gen Intel Core i7-12700H processor (14 cores, up to 4.7GHz)
- 32GB DDR5 RAM (expandable to 64GB)
- 1TB NVMe PCIe 4.0 SSD (upgradeable)
- NVIDIA GeForce RTX 3060 graphics (6GB GDDR6)

**Display & Design:**
- 15.6" 4K OLED touchscreen (3840x2160)
- 400 nits brightness, HDR support
- Ultra-slim aluminum unibody (17.5mm thin, 1.8kg)
- Backlit keyboard with precision touchpad

**Connectivity:**
- Thunderbolt 4 ports (x2)
- USB-C 3.2 Gen 2
- HDMI 2.1
- Wi-Fi 6E & Bluetooth 5.2
- Fingerprint reader & IR camera for Windows Hello

**Battery & Audio:**
- 85Wh battery (up to 12 hours)
- 100W USB-C fast charging
- Quad speakers with Dolby Atmos
- Studio-quality microphone array

Includes: Laptop, 100W USB-C charger, USB-C to USB-A adapter, Quick start guide, 2-year international warranty`,
      sku: 'TNPX1-15-BLK-32-1TB',
      barcode: '0850012345001',
      imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800',
        'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800',
        'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800',
        'https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=800',
      ]),
      category: 'Electronics',
      subcategory: 'Laptops & Computers',
      brand: 'TechNova',
      tags: JSON.stringify(['laptop', 'professional', '4k', 'gaming', 'creator', 'workstation']),
      status: ProductStatus.ACTIVE,
      stock: 245,
      lowStockThreshold: 20,
      weight: new Decimal('1.80'),
      dimensions: JSON.stringify({ length: 35.6, width: 23.4, height: 1.75, unit: 'cm' }),
      shippingClass: 'standard',
      isFeatured: true,
      isDigital: false,
      specifications: JSON.stringify({
        processor: 'Intel Core i7-12700H (12th Gen, 14-core)',
        memory: '32GB DDR5 4800MHz',
        storage: '1TB NVMe PCIe 4.0 SSD',
        graphics: 'NVIDIA GeForce RTX 3060 (6GB GDDR6)',
        display: '15.6" 4K OLED (3840x2160), Touchscreen',
        os: 'Windows 11 Pro',
        battery: '85Wh Lithium-polymer',
        weight: '1.8kg',
        warranty: '2 years international',
        color: 'Space Black',
      }),
      slug: 'technova-probook-x1-laptop-15-4k',
      metaTitle: 'TechNova ProBook X1 - Professional 4K Laptop | 32GB RAM, RTX 3060',
      metaDescription: 'Premium professional laptop with 4K OLED display, Intel i7 processor, 32GB RAM, and RTX 3060 graphics. Perfect for creators and power users.',
      rating: new Decimal('4.8'),
      totalReviews: 324,
    },
  });

  const product2 = await prisma.product.create({
    data: {
      sellerId: seller1.id,
      name: 'TechNova SmartPhone Pro 5G - 256GB',
      shortDescription: '6.7" AMOLED flagship smartphone with 108MP camera, 5G connectivity',
      description: `Experience the future of mobile technology with the TechNova SmartPhone Pro 5G. This flagship device combines cutting-edge hardware with intelligent software to deliver an unparalleled smartphone experience.

**Display:**
- 6.7" Dynamic AMOLED 2X display
- QHD+ resolution (3200x1440)
- 120Hz adaptive refresh rate
- Gorilla Glass Victus protection

**Camera System:**
- 108MP main camera with OIS
- 12MP ultra-wide (123° FOV)
- 10MP telephoto (3x optical zoom)
- 32MP front camera
- 8K video recording at 30fps
- Night mode, Portrait mode, Pro mode

**Performance:**
- Snapdragon 8 Gen 2 processor
- 12GB RAM
- 256GB internal storage
- 5G connectivity (sub-6GHz & mmWave)

**Battery & Charging:**
- 5000mAh battery
- 45W super-fast charging
- 15W wireless charging
- Reverse wireless charging

**Additional Features:**
- In-display ultrasonic fingerprint scanner
- IP68 water & dust resistance
- Stereo speakers with Dolby Atmos
- Wi-Fi 6E, Bluetooth 5.3, NFC
- USB-C 3.2

Available in Phantom Black, Cloud White, and Aurora Purple. Includes charger, USB-C cable, SIM ejector tool, and protective case.`,
      sku: 'TNSP5G-256-BLK',
      barcode: '0850012345018',
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800',
        'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800',
      ]),
      category: 'Electronics',
      subcategory: 'Smartphones & Tablets',
      brand: 'TechNova',
      tags: JSON.stringify(['smartphone', '5g', 'flagship', 'camera', 'amoled']),
      status: ProductStatus.ACTIVE,
      stock: 567,
      lowStockThreshold: 50,
      weight: new Decimal('0.23'),
      dimensions: JSON.stringify({ length: 16.3, width: 7.8, height: 0.89, unit: 'cm' }),
      shippingClass: 'standard',
      isFeatured: true,
      isDigital: false,
      specifications: JSON.stringify({
        display: '6.7" Dynamic AMOLED 2X, 3200x1440, 120Hz',
        processor: 'Snapdragon 8 Gen 2',
        memory: '12GB RAM',
        storage: '256GB',
        mainCamera: '108MP + 12MP + 10MP',
        frontCamera: '32MP',
        battery: '5000mAh',
        charging: '45W wired, 15W wireless',
        os: 'Android 14',
        connectivity: '5G, Wi-Fi 6E, Bluetooth 5.3',
        dimensions: '163 x 78 x 8.9 mm',
        weight: '229g',
        colors: ['Phantom Black', 'Cloud White', 'Aurora Purple'],
      }),
      slug: 'technova-smartphone-pro-5g-256gb',
      metaTitle: 'TechNova SmartPhone Pro 5G | 108MP Camera, 256GB Storage',
      metaDescription: 'Flagship 5G smartphone with 6.7" AMOLED display, 108MP camera system, Snapdragon 8 Gen 2, and 12GB RAM.',
      rating: new Decimal('4.7'),
      totalReviews: 892,
    },
  });

  const product3 = await prisma.product.create({
    data: {
      sellerId: seller1.id,
      name: 'TechNova AirPods Ultra - Wireless Earbuds',
      shortDescription: 'Premium wireless earbuds with active noise cancellation and spatial audio',
      description: `TechNova AirPods Ultra deliver exceptional audio quality in a compact, comfortable design. Whether you're commuting, working out, or relaxing at home, these earbuds provide an immersive listening experience.

**Audio Performance:**
- Custom-tuned 11mm dynamic drivers
- Hi-Res audio certification
- AAC, SBC, LDAC codec support
- 3D spatial audio with head tracking

**Active Noise Cancellation:**
- Adaptive ANC with 3 microphones per earbud
- Up to 40dB noise reduction
- Transparency mode for ambient awareness
- Wind noise reduction

**Comfort & Design:**
- Ergonomic design with 3 ear tip sizes
- IPX5 water & sweat resistance
- Touch controls (play/pause, volume, calls, ANC)
- In-ear detection (auto pause/play)

**Battery Life:**
- 8 hours playback (ANC off)
- 6 hours with ANC on
- 30 hours total with charging case
- USB-C fast charging (10 min = 2 hours)
- Wireless charging case

**Connectivity:**
- Bluetooth 5.3
- Multipoint connection (2 devices)
- Low latency gaming mode (60ms)
- Voice assistant support

Includes: Earbuds, charging case, 3 sizes of silicone ear tips, USB-C cable, user manual.`,
      sku: 'TNAP-ULTRA-BLK',
      barcode: '0850012345025',
      imageUrl: 'https://images.unsplash.com/photo-1606400082777-ef05f3c5cde2?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1606400082777-ef05f3c5cde2?w=800',
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800',
      ]),
      category: 'Electronics',
      subcategory: 'Audio & Headphones',
      brand: 'TechNova',
      tags: JSON.stringify(['earbuds', 'wireless', 'anc', 'bluetooth', 'audio']),
      status: ProductStatus.ACTIVE,
      stock: 1234,
      lowStockThreshold: 100,
      weight: new Decimal('0.05'),
      dimensions: JSON.stringify({ length: 6.2, width: 5.0, height: 2.5, unit: 'cm' }),
      shippingClass: 'standard',
      isFeatured: true,
      isDigital: false,
      specifications: JSON.stringify({
        driver: '11mm dynamic',
        anc: 'Adaptive ANC, up to 40dB',
        battery: '8hrs (6hrs with ANC), 30hrs with case',
        bluetooth: 'Bluetooth 5.3',
        waterResistance: 'IPX5',
        charging: 'USB-C, wireless charging',
        weight: '5.4g per earbud',
        codecs: ['AAC', 'SBC', 'LDAC'],
      }),
      slug: 'technova-airpods-ultra-wireless-earbuds',
      metaTitle: 'TechNova AirPods Ultra - Wireless Earbuds with ANC | Premium Audio',
      metaDescription: 'Premium wireless earbuds with adaptive ANC, spatial audio, 30-hour battery life, and IPX5 water resistance.',
      rating: new Decimal('4.6'),
      totalReviews: 567,
    },
  });

  console.log(`✅ Created ${3} Electronics products`);
  console.log('');

  // ============================================
  // PRODUCTS - FASHION
  // ============================================

  console.log('👔 Creating Fashion products...');

  const product4 = await prisma.product.create({
    data: {
      sellerId: seller2.id,
      name: 'Premium Merino Wool Crew Neck Sweater',
      shortDescription: 'Luxuriously soft merino wool sweater for men and women',
      description: `Elevate your wardrobe with this timeless merino wool crew neck sweater. Crafted from 100% premium Australian merino wool, this sweater offers unparalleled softness, breathability, and temperature regulation.

**Material & Construction:**
- 100% Australian merino wool (19.5 micron)
- Lightweight yet warm (260 GSM)
- Naturally odor-resistant and moisture-wicking
- Machine washable (wool cycle)
- Fully-fashioned seamless construction

**Design Details:**
- Classic crew neck design
- Ribbed collar, cuffs, and hem
- Relaxed fit suitable for layering
- Unisex design
- Available in 8 colors

**Sustainability:**
- Ethically sourced wool from certified farms
- Biodegradable natural fiber
- Carbon-neutral shipping
- Recyclable packaging

**Care Instructions:**
Machine wash cold on wool cycle or hand wash. Lay flat to dry. Do not bleach. Cool iron if needed.

**Size Guide:**
XS: Chest 34-36" | Length 26"
S: Chest 36-38" | Length 27"
M: Chest 38-40" | Length 28"
L: Chest 40-42" | Length 29"
XL: Chest 42-44" | Length 30"
XXL: Chest 44-46" | Length 31"

Available colors: Charcoal, Navy, Forest Green, Burgundy, Camel, Cream, Black, Light Gray`,
      sku: 'SH-WOOL-CREW-M-CHAR',
      barcode: '0850023456001',
      imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800',
        'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800',
        'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800',
      ]),
      category: 'Fashion',
      subcategory: 'Men\'s Clothing',
      brand: 'StyleHub Collection',
      tags: JSON.stringify(['sweater', 'merino', 'wool', 'menswear', 'sustainable', 'winter']),
      status: ProductStatus.ACTIVE,
      stock: 456,
      lowStockThreshold: 30,
      weight: new Decimal('0.35'),
      dimensions: JSON.stringify({ length: 30, width: 25, height: 3, unit: 'cm' }),
      shippingClass: 'standard',
      isFeatured: true,
      isDigital: false,
      specifications: JSON.stringify({
        material: '100% Merino Wool',
        weight: '260 GSM',
        fit: 'Relaxed',
        neckline: 'Crew Neck',
        care: 'Machine washable',
        origin: 'Made in Italy',
        certification: 'Responsible Wool Standard',
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        colors: ['Charcoal', 'Navy', 'Forest Green', 'Burgundy', 'Camel', 'Cream', 'Black', 'Light Gray'],
      }),
      slug: 'premium-merino-wool-crew-neck-sweater',
      metaTitle: 'Premium Merino Wool Crew Neck Sweater | StyleHub',
      metaDescription: 'Luxuriously soft 100% merino wool sweater. Breathable, temperature-regulating, and machine washable. Available in 8 colors.',
      rating: new Decimal('4.8'),
      totalReviews: 234,
    },
  });

  const product5 = await prisma.product.create({
    data: {
      sellerId: seller2.id,
      name: 'Designer Leather Crossbody Bag',
      shortDescription: 'Handcrafted genuine leather crossbody bag with adjustable strap',
      description: `A timeless accessory that combines Italian craftsmanship with modern design. This crossbody bag is made from premium full-grain leather that develops a beautiful patina over time.

**Material & Craftsmanship:**
- Full-grain Italian leather
- Vegetable-tanned for durability
- Hand-stitched details
- Antique brass hardware

**Features:**
- Main compartment with magnetic closure
- Interior zip pocket
- 2 card slots
- Adjustable leather strap (drop: 22-26")
- Gold-embossed brand logo

**Dimensions:**
- Width: 9"
- Height: 7"
- Depth: 3"
- Weight: 0.6 lbs

**Care:**
Wipe clean with a soft, damp cloth. Condition leather periodically with leather cream. Avoid exposure to water and direct sunlight.

Available in Cognac Brown, Black, Navy Blue, and Burgundy.`,
      sku: 'SH-LEATH-CROSS-COG',
      barcode: '0850023456018',
      imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800',
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',
      ]),
      category: 'Fashion',
      subcategory: 'Bags & Accessories',
      brand: 'StyleHub Collection',
      tags: JSON.stringify(['bag', 'leather', 'crossbody', 'handbag', 'accessories', 'women']),
      status: ProductStatus.ACTIVE,
      stock: 189,
      lowStockThreshold: 20,
      weight: new Decimal('0.27'),
      dimensions: JSON.stringify({ length: 23, width: 18, height: 7.5, unit: 'cm' }),
      shippingClass: 'standard',
      isFeatured: false,
      isDigital: false,
      specifications: JSON.stringify({
        material: 'Full-grain Italian leather',
        lining: 'Cotton canvas',
        hardware: 'Antique brass',
        closure: 'Magnetic snap',
        strapType: 'Adjustable leather',
        pockets: '1 main, 1 zip, 2 card slots',
        colors: ['Cognac Brown', 'Black', 'Navy Blue', 'Burgundy'],
        madeIn: 'Italy',
      }),
      slug: 'designer-leather-crossbody-bag',
      metaTitle: 'Designer Leather Crossbody Bag | Italian Craftsmanship',
      metaDescription: 'Handcrafted full-grain Italian leather crossbody bag. Timeless design with adjustable strap and antique brass hardware.',
      rating: new Decimal('4.7'),
      totalReviews: 156,
    },
  });

  console.log(`✅ Created ${2} Fashion products`);
  console.log('');

  // ============================================
  // PRODUCTS - HOME & LIVING
  // ============================================

  console.log('🏠 Creating Home & Living products...');

  const product6 = await prisma.product.create({
    data: {
      sellerId: seller3.id,
      name: 'Scandinavian Modern Coffee Table - Solid Oak',
      shortDescription: 'Minimalist solid oak coffee table with clean lines and natural finish',
      description: `Bring Scandinavian elegance to your living space with this beautifully crafted solid oak coffee table. Featuring clean lines and a natural finish, this piece exemplifies the "less is more" philosophy of Nordic design.

**Materials:**
- 100% solid European oak wood
- Natural oil finish (non-toxic, food-safe)
- FSC-certified sustainable wood

**Design:**
- Minimalist Scandinavian aesthetic
- Rounded edges for safety
- Tapered legs with subtle grain patterns
- Lower shelf for books/magazines

**Dimensions:**
- Length: 47.2" (120 cm)
- Width: 23.6" (60 cm)
- Height: 17.7" (45 cm)
- Weight capacity: 220 lbs

**Care:**
Wipe with a damp cloth. Reapply furniture oil annually. Avoid direct sunlight and excessive moisture.

**Assembly:**
Minimal assembly required (15 minutes). Legs attach via pre-drilled holes. All hardware and tools included.

Perfect for modern living rooms, apartments, and minimalist interiors. Complements both contemporary and mid-century modern décor.`,
      sku: 'HL-COFFEE-OAK-NAT',
      barcode: '0850034567001',
      imageUrl: 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=800',
        'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800',
        'https://images.unsplash.com/photo-1634712282287-14ed57b9cc89?w=800',
      ]),
      category: 'Home & Living',
      subcategory: 'Furniture',
      brand: 'HomeLux Nordic',
      tags: JSON.stringify(['furniture', 'table', 'coffee table', 'scandinavian', 'oak', 'modern']),
      status: ProductStatus.ACTIVE,
      stock: 78,
      lowStockThreshold: 10,
      weight: new Decimal('28.50'),
      dimensions: JSON.stringify({ length: 120, width: 60, height: 45, unit: 'cm' }),
      shippingClass: 'fragile',
      isFeatured: true,
      isDigital: false,
      specifications: JSON.stringify({
        material: 'Solid European Oak',
        finish: 'Natural oil',
        style: 'Scandinavian/Mid-century Modern',
        assembly: 'Minimal (15 min)',
        weightCapacity: '100 kg',
        certification: 'FSC Certified',
        warranty: '5 years',
        origin: 'Made in Denmark',
      }),
      slug: 'scandinavian-modern-coffee-table-solid-oak',
      metaTitle: 'Scandinavian Oak Coffee Table | Minimalist Design | HomeLux',
      metaDescription: 'Elegant solid oak coffee table with Scandinavian design. FSC-certified wood, natural finish, and 5-year warranty.',
      rating: new Decimal('4.9'),
      totalReviews: 89,
    },
  });

  const product7 = await prisma.product.create({
    data: {
      sellerId: seller3.id,
      name: 'Luxury Egyptian Cotton Bedding Set - King Size',
      shortDescription: '1000 thread count Egyptian cotton duvet cover set with pillowcases',
      description: `Experience hotel-quality sleep every night with this luxurious Egyptian cotton bedding set. Crafted from long-staple Egyptian cotton with a 1000 thread count, this set offers unmatched softness and durability.

**Material Quality:**
- 100% long-staple Egyptian cotton
- 1000 thread count sateen weave
- OEKO-TEX Standard 100 certified
- Pre-washed for softness

**Set Includes (King):**
- 1 Duvet cover (104" x 92")
- 2 Pillowcases (20" x 36")
- 1 Fitted sheet (78" x 80")
- 1 Flat sheet (108" x 102")

**Features:**
- Silky smooth sateen finish
- Breathable and temperature-regulating
- Fade-resistant colors
- Hidden button closure on duvet
- Deep pocket fitted sheet (16" depth)

**Care:**
Machine wash cold separately. Tumble dry low. Iron on low if desired. Colors stay vibrant wash after wash.

**Available Colors:**
Pure White, Ivory, Charcoal Gray, Navy Blue, Sage Green, Blush Pink

**Size Options:**
Twin, Full, Queen, King, California King

Elevate your bedroom with luxury that lasts. This bedding set gets softer with every wash while maintaining its lustrous finish.`,
      sku: 'HL-BED-EGYCOT-K-WHT',
      barcode: '0850034567018',
      imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
        'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800',
      ]),
      category: 'Home & Living',
      subcategory: 'Bedding & Bath',
      brand: 'HomeLux Luxury',
      tags: JSON.stringify(['bedding', 'cotton', 'egyptian cotton', 'duvet', 'luxury', 'bedroom']),
      status: ProductStatus.ACTIVE,
      stock: 234,
      lowStockThreshold: 30,
      weight: new Decimal('2.80'),
      dimensions: JSON.stringify({ length: 35, width: 30, height: 10, unit: 'cm' }),
      shippingClass: 'standard',
      isFeatured: true,
      isDigital: false,
      specifications: JSON.stringify({
        material: '100% Egyptian Cotton',
        threadCount: '1000',
        weave: 'Sateen',
        certification: 'OEKO-TEX Standard 100',
        care: 'Machine washable',
        pocketDepth: '16 inches',
        sizes: ['Twin', 'Full', 'Queen', 'King', 'Cal King'],
        colors: ['Pure White', 'Ivory', 'Charcoal Gray', 'Navy Blue', 'Sage Green', 'Blush Pink'],
      }),
      slug: 'luxury-egyptian-cotton-bedding-set-king',
      metaTitle: '1000 Thread Count Egyptian Cotton Bedding Set | King Size',
      metaDescription: 'Luxury Egyptian cotton bedding with 1000 thread count sateen weave. Hotel-quality softness and durability. OEKO-TEX certified.',
      rating: new Decimal('4.8'),
      totalReviews: 312,
    },
  });

  console.log(`✅ Created ${2} Home & Living products`);
  console.log('');

  // ============================================
  // PRODUCTS - BEAUTY & PERSONAL CARE
  // ============================================

  console.log('💄 Creating Beauty products...');

  const product8 = await prisma.product.create({
    data: {
      sellerId: seller4.id,
      name: 'Vitamin C Brightening Serum - 20% L-Ascorbic Acid',
      shortDescription: 'Clinical-strength vitamin C serum for radiant, even-toned skin',
      description: `Transform your skin with our best-selling Vitamin C Brightening Serum. Formulated with 20% L-Ascorbic Acid (the most effective form of vitamin C), this serum delivers visible results in reducing dark spots, fine lines, and dullness.

**Key Ingredients:**
- 20% L-Ascorbic Acid (Vitamin C)
- 2% Ferulic Acid (antioxidant booster)
- 1% Vitamin E (α-tocopherol)
- Hyaluronic Acid (hydration)

**Benefits:**
- Brightens and evens skin tone
- Reduces appearance of dark spots and hyperpigmentation
- Minimizes fine lines and wrinkles
- Boosts collagen production
- Protects against environmental damage
- Suitable for all skin types

**Clinical Results (8-week study):**
- 92% saw brighter, more radiant skin
- 87% noticed reduced dark spots
- 84% saw improvement in fine lines
- Dermatologist-tested and approved

**How to Use:**
Apply 3-4 drops to clean, dry skin every morning. Follow with moisturizer and SPF. May cause slight tingling initially - this is normal. Store in a cool, dark place.

**Formulation:**
- Vegan & cruelty-free
- Fragrance-free
- Paraben-free
- Sulfate-free
- Non-comedogenic
- pH-balanced (3.0-3.5)

**Size:** 1 fl oz (30ml) - 2-3 months supply

**Shelf Life:** 3 months after opening. Refrigeration extends freshness.

Backed by our 90-day satisfaction guarantee. If you don't see results, we'll refund you - no questions asked.`,
      sku: 'BC-VITC-SERUM-30ML',
      barcode: '0850045678001',
      imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800',
        'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800',
      ]),
      category: 'Beauty & Personal Care',
      subcategory: 'Skincare',
      brand: 'BeautyCore',
      tags: JSON.stringify(['skincare', 'serum', 'vitamin c', 'brightening', 'anti-aging', 'vegan']),
      status: ProductStatus.ACTIVE,
      stock: 892,
      lowStockThreshold: 100,
      weight: new Decimal('0.08'),
      dimensions: JSON.stringify({ length: 3.5, width: 3.5, height: 11, unit: 'cm' }),
      shippingClass: 'standard',
      isFeatured: true,
      isDigital: false,
      specifications: JSON.stringify({
        size: '30ml (1 fl oz)',
        keyIngredients: ['20% L-Ascorbic Acid', '2% Ferulic Acid', '1% Vitamin E', 'Hyaluronic Acid'],
        skinType: 'All skin types',
        concerns: ['Dark spots', 'Dullness', 'Fine lines', 'Uneven tone'],
        vegan: true,
        crueltyFree: true,
        fragranceFree: true,
        pH: '3.0-3.5',
        shelfLife: '3 months after opening',
        testing: 'Dermatologist-tested',
      }),
      slug: 'vitamin-c-brightening-serum-20-percent',
      metaTitle: 'Vitamin C Serum 20% | Brightening & Anti-Aging | BeautyCore',
      metaDescription: 'Clinical-strength 20% Vitamin C serum with ferulic acid. Brightens skin, reduces dark spots, and fights signs of aging. Vegan & cruelty-free.',
      rating: new Decimal('4.7'),
      totalReviews: 1547,
    },
  });

  const product9 = await prisma.product.create({
    data: {
      sellerId: seller4.id,
      name: 'Hydrating Hyaluronic Acid Moisturizer',
      shortDescription: 'Lightweight gel moisturizer with triple molecular weight hyaluronic acid',
      description: `Quench thirsty skin with our Hydrating Hyaluronic Acid Moisturizer. This lightweight, oil-free gel formula delivers multi-level hydration that lasts all day without feeling heavy or greasy.

**Hydration Technology:**
- Triple molecular weight hyaluronic acid
- Low MW: Penetrates deeply into skin
- Medium MW: Plumps mid-layers
- High MW: Seals moisture at surface

**Additional Actives:**
- Niacinamide (Vitamin B3) - strengthens skin barrier
- Ceramides - locks in moisture
- Aloe Vera - soothes and calms
- Green Tea Extract - antioxidant protection

**Texture & Feel:**
- Lightweight gel-cream texture
- Absorbs instantly
- Non-greasy, non-sticky
- Perfect under makeup
- Won't clog pores

**Benefits:**
- Provides 72-hour hydration
- Plumps and smooths skin
- Reduces appearance of fine lines
- Strengthens moisture barrier
- Soothes irritation and redness

**Ideal For:**
- All skin types (especially oily, combination, sensitive)
- Dehydrated skin
- Daily use (morning & night)
- Post-procedure care

**Size:** 1.7 fl oz (50ml)

**Clean Formula:**
Vegan, cruelty-free, fragrance-free, alcohol-free, silicone-free, non-comedogenic. Dermatologist-tested and hypoallergenic.

Apply to clean skin morning and night. Can be layered with other serums and treatments.`,
      sku: 'BC-HA-MOIST-50ML',
      barcode: '0850045678018',
      imageUrl: 'https://images.unsplash.com/photo-1620916297187-e0348da2b01a?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1620916297187-e0348da2b01a?w=800',
        'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=800',
      ]),
      category: 'Beauty & Personal Care',
      subcategory: 'Skincare',
      brand: 'BeautyCore',
      tags: JSON.stringify(['skincare', 'moisturizer', 'hyaluronic acid', 'hydration', 'gel cream', 'vegan']),
      status: ProductStatus.ACTIVE,
      stock: 1456,
      lowStockThreshold: 150,
      weight: new Decimal('0.12'),
      dimensions: JSON.stringify({ length: 5, width: 5, height: 6.5, unit: 'cm' }),
      shippingClass: 'standard',
      isFeatured: false,
      isDigital: false,
      specifications: JSON.stringify({
        size: '50ml (1.7 fl oz)',
        keyIngredients: ['Triple-Weight Hyaluronic Acid', 'Niacinamide', 'Ceramides', 'Aloe Vera', 'Green Tea'],
        texture: 'Lightweight gel-cream',
        skinType: 'All types (especially oily, combo, sensitive)',
        vegan: true,
        crueltyFree: true,
        fragranceFree: true,
        nonComedogenic: true,
        hypoallergenic: true,
        hydrationDuration: '72 hours',
      }),
      slug: 'hydrating-hyaluronic-acid-moisturizer',
      metaTitle: 'Hyaluronic Acid Moisturizer | 72-Hour Hydration | BeautyCore',
      metaDescription: 'Lightweight gel moisturizer with triple-weight hyaluronic acid, niacinamide, and ceramides. 72-hour hydration for all skin types.',
      rating: new Decimal('4.8'),
      totalReviews: 1923,
    },
  });

  console.log(`✅ Created ${2} Beauty products`);
  console.log('');

  // ============================================
  // PRODUCTS - SPORTS & FITNESS
  // ============================================

  console.log('⚽ Creating Sports & Fitness products...');

  const product10 = await prisma.product.create({
    data: {
      sellerId: seller5.id,
      name: 'Premium Yoga Mat - Extra Thick 6mm',
      shortDescription: 'Non-slip TPE yoga mat with alignment markers and carrying strap',
      description: `Elevate your practice with the ActiveFit Premium Yoga Mat. Designed by yogis, for yogis, this mat combines superior cushioning with excellent grip for a stable, comfortable practice.

**Material & Construction:**
- 6mm thick TPE (Thermoplastic Elastomer)
- Non-toxic, PVC-free, latex-free
- Biodegradable and recyclable
- Dual-layer construction for durability

**Performance Features:**
- Non-slip textured surface (wet & dry grip)
- Extra cushioning for joints
- Alignment markers for proper positioning
- High-density core (prevents compression)
- Noise-dampening for apartment workouts

**Specifications:**
- Dimensions: 72" L x 24" W x 6mm thick
- Weight: 2.2 lbs
- Density: 0.95 g/cm³
- Grip rating: 5/5 (tested)

**Included:**
- Yoga mat
- Adjustable carrying strap
- Mesh carrying bag
- Online workout guide

**Care Instructions:**
Wipe with damp cloth and mild soap after use. Air dry before rolling up. Avoid direct sunlight for extended periods.

**Ideal For:**
- All yoga styles (Hatha, Vinyasa, Ashtanga, Yin)
- Pilates
- Floor exercises
- Stretching and meditation

**Available Colors:**
Midnight Black, Ocean Blue, Forest Green, Sunset Purple, Desert Sand, Coral Pink

**Eco-Friendly:**
Made from sustainable materials with zero harmful chemicals. For every mat sold, we plant one tree through our reforestation partnership.

**Warranty:** 1-year satisfaction guarantee`,
      sku: 'AF-YOGA-MAT-6MM-BLK',
      barcode: '0850056789001',
      imageUrl: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800',
        'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
      ]),
      category: 'Sports & Fitness',
      subcategory: 'Yoga & Pilates',
      brand: 'ActiveFit',
      tags: JSON.stringify(['yoga', 'mat', 'fitness', 'exercise', 'pilates', 'eco-friendly']),
      status: ProductStatus.ACTIVE,
      stock: 567,
      lowStockThreshold: 50,
      weight: new Decimal('1.00'),
      dimensions: JSON.stringify({ length: 183, width: 61, height: 0.6, unit: 'cm' }),
      shippingClass: 'standard',
      isFeatured: true,
      isDigital: false,
      specifications: JSON.stringify({
        material: 'TPE (Thermoplastic Elastomer)',
        thickness: '6mm',
        dimensions: '72" x 24" (183cm x 61cm)',
        weight: '2.2 lbs (1kg)',
        features: ['Non-slip', 'Alignment markers', 'Extra cushioning'],
        eco: 'PVC-free, latex-free, biodegradable',
        colors: ['Midnight Black', 'Ocean Blue', 'Forest Green', 'Sunset Purple', 'Desert Sand', 'Coral Pink'],
        warranty: '1 year',
      }),
      slug: 'premium-yoga-mat-extra-thick-6mm',
      metaTitle: 'Premium Yoga Mat 6mm | Non-Slip TPE | ActiveFit',
      metaDescription: 'Extra thick 6mm yoga mat with superior grip and cushioning. Eco-friendly TPE material, alignment markers, and carrying strap included.',
      rating: new Decimal('4.7'),
      totalReviews: 643,
    },
  });

  const product11 = await prisma.product.create({
    data: {
      sellerId: seller5.id,
      name: 'Adjustable Dumbbell Set - 5-52.5 lbs',
      shortDescription: 'Space-saving adjustable dumbbells that replace 15 sets of weights',
      description: `Transform your home gym with the ActiveFit Adjustable Dumbbell Set. This innovative design replaces 15 sets of traditional dumbbells, saving space while providing versatile strength training options.

**Weight System:**
- Adjustable from 5 to 52.5 lbs (2.5-24 kg) per dumbbell
- 15 weight settings in 2.5 lb increments
- Quick-change dial mechanism (takes 2 seconds)
- Total weight: 105 lbs when both dumbbells maxed

**Construction:**
- Durable molded steel weight plates
- Chrome-finished steel handle
- Textured grip for secure hold
- Smooth plate loading system

**Weight Settings Per Dumbbell:**
5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 52.5 lbs

**Storage Tray:**
- Compact design (saves 75% space vs. traditional dumbbells)
- Smooth base protects floors
- Dimensions: 16" x 9" x 9" per tray

**Exercises:**
Perfect for bicep curls, shoulder presses, chest presses, rows, lunges, squats, and 100+ exercises.

**Ideal For:**
- Home gyms
- Apartment living
- Progressive training
- All fitness levels

**What's Included:**
- 2 adjustable dumbbells
- 2 storage trays
- Workout guide (digital access)
- Exercise chart poster

**Warranty:** 2-year manufacturer warranty

**Safety Features:**
- Locking mechanism ensures plates stay secure
- Smooth edges prevent injury
- Anti-roll design

Used by personal trainers and recommended by fitness professionals worldwide.`,
      sku: 'AF-DUMBBELL-ADJ-52',
      barcode: '0850056789018',
      imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
        'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=800',
      ]),
      category: 'Sports & Fitness',
      subcategory: 'Strength Training',
      brand: 'ActiveFit',
      tags: JSON.stringify(['dumbbells', 'weights', 'strength', 'fitness', 'home gym', 'adjustable']),
      status: ProductStatus.ACTIVE,
      stock: 145,
      lowStockThreshold: 20,
      weight: new Decimal('23.50'),
      dimensions: JSON.stringify({ length: 40, width: 23, height: 23, unit: 'cm' }),
      shippingClass: 'fragile',
      isFeatured: true,
      isDigital: false,
      specifications: JSON.stringify({
        weightRange: '5-52.5 lbs per dumbbell (2.5-24 kg)',
        settings: '15 weight settings',
        increment: '2.5 lbs',
        material: 'Molded steel plates, chrome handle',
        totalWeight: '105 lbs (48 kg)',
        trayDimensions: '16" x 9" x 9"',
        warranty: '2 years',
        replaces: '15 sets of traditional dumbbells',
      }),
      slug: 'adjustable-dumbbell-set-5-52-lbs',
      metaTitle: 'Adjustable Dumbbells 5-52.5 lbs | Space-Saving Home Gym | ActiveFit',
      metaDescription: 'Adjustable dumbbell set with 15 weight settings. Replaces 15 sets of weights. Perfect for home gyms. 2-year warranty.',
      rating: new Decimal('4.8'),
      totalReviews: 421,
    },
  });

  console.log(`✅ Created ${2} Sports & Fitness products`);
  console.log('');

  // ============================================
  // PRODUCT PRICES (Multiple stablecoins)
  // ============================================

  console.log('💰 Creating product prices in multiple stablecoins...');

  // Product 1: Laptop - TechNova ProBook X1
  await prisma.productPrice.createMany({
    data: [
      { productId: product1.id, stablecoinType: StablecoinType.USDT, price: new Decimal('1299.99') },
      { productId: product1.id, stablecoinType: StablecoinType.USDC, price: new Decimal('1299.99') },
      { productId: product1.id, stablecoinType: StablecoinType.DAI, price: new Decimal('1299.99') },
      { productId: product1.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('1299.99') },
    ],
  });

  // Product 2: Smartphone
  await prisma.productPrice.createMany({
    data: [
      { productId: product2.id, stablecoinType: StablecoinType.USDT, price: new Decimal('899.99') },
      { productId: product2.id, stablecoinType: StablecoinType.USDC, price: new Decimal('899.99') },
      { productId: product2.id, stablecoinType: StablecoinType.DAI, price: new Decimal('899.99') },
      { productId: product2.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('899.99') },
    ],
  });

  // Product 3: AirPods
  await prisma.productPrice.createMany({
    data: [
      { productId: product3.id, stablecoinType: StablecoinType.USDT, price: new Decimal('179.99') },
      { productId: product3.id, stablecoinType: StablecoinType.USDC, price: new Decimal('179.99') },
      { productId: product3.id, stablecoinType: StablecoinType.DAI, price: new Decimal('179.99') },
      { productId: product3.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('179.99') },
    ],
  });

  // Product 4: Merino Sweater
  await prisma.productPrice.createMany({
    data: [
      { productId: product4.id, stablecoinType: StablecoinType.USDT, price: new Decimal('129.00') },
      { productId: product4.id, stablecoinType: StablecoinType.USDC, price: new Decimal('129.00') },
      { productId: product4.id, stablecoinType: StablecoinType.DAI, price: new Decimal('129.00') },
      { productId: product4.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('129.00') },
    ],
  });

  // Product 5: Leather Bag
  await prisma.productPrice.createMany({
    data: [
      { productId: product5.id, stablecoinType: StablecoinType.USDT, price: new Decimal('249.00') },
      { productId: product5.id, stablecoinType: StablecoinType.USDC, price: new Decimal('249.00') },
      { productId: product5.id, stablecoinType: StablecoinType.DAI, price: new Decimal('249.00') },
      { productId: product5.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('249.00') },
    ],
  });

  // Product 6: Coffee Table
  await prisma.productPrice.createMany({
    data: [
      { productId: product6.id, stablecoinType: StablecoinType.USDT, price: new Decimal('599.00') },
      { productId: product6.id, stablecoinType: StablecoinType.USDC, price: new Decimal('599.00') },
      { productId: product6.id, stablecoinType: StablecoinType.DAI, price: new Decimal('599.00') },
      { productId: product6.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('599.00') },
    ],
  });

  // Product 7: Bedding Set
  await prisma.productPrice.createMany({
    data: [
      { productId: product7.id, stablecoinType: StablecoinType.USDT, price: new Decimal('189.00') },
      { productId: product7.id, stablecoinType: StablecoinType.USDC, price: new Decimal('189.00') },
      { productId: product7.id, stablecoinType: StablecoinType.DAI, price: new Decimal('189.00') },
      { productId: product7.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('189.00') },
    ],
  });

  // Product 8: Vitamin C Serum
  await prisma.productPrice.createMany({
    data: [
      { productId: product8.id, stablecoinType: StablecoinType.USDT, price: new Decimal('39.99') },
      { productId: product8.id, stablecoinType: StablecoinType.USDC, price: new Decimal('39.99') },
      { productId: product8.id, stablecoinType: StablecoinType.DAI, price: new Decimal('39.99') },
      { productId: product8.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('39.99') },
    ],
  });

  // Product 9: HA Moisturizer
  await prisma.productPrice.createMany({
    data: [
      { productId: product9.id, stablecoinType: StablecoinType.USDT, price: new Decimal('34.99') },
      { productId: product9.id, stablecoinType: StablecoinType.USDC, price: new Decimal('34.99') },
      { productId: product9.id, stablecoinType: StablecoinType.DAI, price: new Decimal('34.99') },
      { productId: product9.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('34.99') },
    ],
  });

  // Product 10: Yoga Mat
  await prisma.productPrice.createMany({
    data: [
      { productId: product10.id, stablecoinType: StablecoinType.USDT, price: new Decimal('49.99') },
      { productId: product10.id, stablecoinType: StablecoinType.USDC, price: new Decimal('49.99') },
      { productId: product10.id, stablecoinType: StablecoinType.DAI, price: new Decimal('49.99') },
      { productId: product10.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('49.99') },
    ],
  });

  // Product 11: Dumbbells
  await prisma.productPrice.createMany({
    data: [
      { productId: product11.id, stablecoinType: StablecoinType.USDT, price: new Decimal('349.00') },
      { productId: product11.id, stablecoinType: StablecoinType.USDC, price: new Decimal('349.00') },
      { productId: product11.id, stablecoinType: StablecoinType.DAI, price: new Decimal('349.00') },
      { productId: product11.id, stablecoinType: StablecoinType.BUSD, price: new Decimal('349.00') },
    ],
  });

  console.log(`✅ Created prices for ${11} products in 4 stablecoins`);
  console.log('');

  // ============================================
  // PRODUCT REVIEWS
  // ============================================

  console.log('⭐ Creating product reviews...');

  // Reviews for Product 1 (Laptop)
  await prisma.productReview.createMany({
    data: [
      {
        productId: product1.id,
        customerId: 'cust-ext-001',
        rating: 5,
        title: 'Best laptop I\'ve ever owned!',
        comment: 'The ProBook X1 exceeded all my expectations. The 4K display is absolutely stunning, and the performance is top-notch. I use it for video editing and 3D rendering, and it handles everything I throw at it. Battery life is impressive too - easily lasts a full workday. Worth every penny!',
        isVerified: true,
        isApproved: true,
        helpfulCount: 47,
      },
      {
        productId: product1.id,
        customerId: 'cust-ext-002',
        rating: 4,
        title: 'Great performance, but runs hot under load',
        comment: 'This is a powerful machine with excellent build quality. The keyboard is comfortable and the touchpad is smooth. My only complaint is that it gets quite warm during intensive tasks. I recommend using a laptop stand for better airflow. Overall, very satisfied with the purchase.',
        isVerified: true,
        isApproved: true,
        helpfulCount: 23,
      },
      {
        productId: product1.id,
        customerId: 'cust-ext-003',
        rating: 5,
        title: 'Perfect for creative professionals',
        comment: 'As a graphic designer, color accuracy is crucial. The 4K OLED display with 100% DCI-P3 coverage is a dream come true. Adobe Creative Suite runs buttery smooth. The Thunderbolt 4 ports make it easy to connect to my external monitors and storage. Highly recommended!',
        isVerified: true,
        isApproved: true,
        helpfulCount: 31,
      },
    ],
  });

  // Reviews for Product 2 (Smartphone)
  await prisma.productReview.createMany({
    data: [
      {
        productId: product2.id,
        customerId: 'cust-ext-004',
        rating: 5,
        title: 'Camera quality is insane!',
        comment: 'The 108MP camera takes incredible photos, even in low light. Night mode is magical. The 120Hz display is super smooth. Battery easily lasts all day with heavy use. This phone has everything I need and more.',
        isVerified: true,
        isApproved: true,
        helpfulCount: 89,
      },
      {
        productId: product2.id,
        customerId: 'cust-ext-005',
        rating: 4,
        title: 'Excellent flagship, minor software bugs',
        comment: 'Hardware is fantastic - screen is gorgeous, performance is blazing fast, and build quality is premium. Encountered a few minor software bugs, but they were fixed in the first update. Overall, very happy with this phone.',
        isVerified: true,
        isApproved: true,
        helpfulCount: 34,
      },
    ],
  });

  // Reviews for Product 8 (Vitamin C Serum)
  await prisma.productReview.createMany({
    data: [
      {
        productId: product8.id,
        customerId: 'cust-ext-006',
        rating: 5,
        title: 'My dark spots have faded significantly!',
        comment: 'I\'ve been using this serum for 6 weeks and I can see a noticeable difference in my dark spots and overall skin tone. My skin looks brighter and more even. Yes, it tingles a bit when you first apply it, but you get used to it. Make sure to wear SPF during the day! Worth the investment.',
        isVerified: true,
        isApproved: true,
        helpfulCount: 156,
      },
      {
        productId: product8.id,
        customerId: 'cust-ext-007',
        rating: 5,
        title: 'Finally, a vitamin C serum that works!',
        comment: 'I\'ve tried many vitamin C serums before, but this is the first one that actually delivered visible results. My skin texture has improved, fine lines are less noticeable, and I\'m getting compliments on my glow. The formula is stable and doesn\'t oxidize quickly. A must-have in my routine!',
        isVerified: true,
        isApproved: true,
        helpfulCount: 203,
      },
      {
        productId: product8.id,
        customerId: 'cust-ext-008',
        rating: 4,
        title: 'Effective but can be irritating',
        comment: 'This serum definitely works - my skin is brighter and more radiant. However, it can be irritating if you have sensitive skin. I had to build up tolerance by using it every other day initially. Now I can use it daily without issues. Just be patient and listen to your skin.',
        isVerified: true,
        isApproved: true,
        helpfulCount: 67,
      },
    ],
  });

  console.log(`✅ Created sample product reviews`);
  console.log('');

  // ============================================
  // SUMMARY
  // ============================================

  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('✨ Seed data creation completed successfully!');
  console.log('════════════════════════════════════════════');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   • Sellers: 5`);
  console.log(`   • Products: 11`);
  console.log(`   • Product Prices: 44 (11 products × 4 stablecoins)`);
  console.log(`   • Reviews: 8`);
  console.log('');
  console.log('📦 Categories created:');
  console.log('   • Electronics (Laptops, Smartphones, Audio)');
  console.log('   • Fashion (Clothing, Accessories)');
  console.log('   • Home & Living (Furniture, Bedding)');
  console.log('   • Beauty & Personal Care (Skincare)');
  console.log('   • Sports & Fitness (Yoga, Strength Training)');
  console.log('');
  console.log('💰 All products priced in:');
  console.log('   • USDT, USDC, DAI, BUSD');
  console.log('');
  console.log('🎉 Ready for testing!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
