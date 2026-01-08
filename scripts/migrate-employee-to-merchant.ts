import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateEmployeeToMerchant() {
  try {
    console.log('🔄 Starting migration: EMPLOYEE -> MERCHANT...\n');

    // Step 1: Add MERCHANT to enum if it doesn't exist
    console.log('Step 1: Adding MERCHANT to UserRole enum...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MERCHANT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')) THEN
              ALTER TYPE "UserRole" ADD VALUE 'MERCHANT';
              RAISE NOTICE 'Added MERCHANT to UserRole enum';
          ELSE
              RAISE NOTICE 'MERCHANT already exists in UserRole enum';
          END IF;
      END $$;
    `);
    console.log('✅ MERCHANT added to enum\n');

    // Step 2: Check for any users with EMPLOYEE role
    console.log('Step 2: Checking for users with EMPLOYEE role...');
    const employeeUsers = await prisma.$queryRaw<any[]>`
      SELECT id, email, role FROM users WHERE role::text = 'EMPLOYEE'
    `;

    if (employeeUsers.length > 0) {
      console.log(`Found ${employeeUsers.length} users with EMPLOYEE role:`);
      employeeUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.id})`);
      });

      // Update them to USER temporarily
      console.log('Converting EMPLOYEE users to USER...');
      await prisma.$executeRawUnsafe(`
        UPDATE users SET role = 'USER' WHERE role = 'EMPLOYEE'
      `);
      console.log('✅ Converted EMPLOYEE users to USER\n');
    } else {
      console.log('✅ No users with EMPLOYEE role found\n');
    }

    // Step 3: Update users with seller profiles to MERCHANT
    console.log('Step 3: Updating users with seller profiles to MERCHANT role...');
    const sellersWithUsers = await prisma.seller.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    console.log(`Found ${sellersWithUsers.length} seller profiles`);

    let updatedCount = 0;
    for (const seller of sellersWithUsers) {
      if (!seller.user) continue;

      if (seller.user.role !== 'MERCHANT') {
        await prisma.user.update({
          where: { id: seller.userId! },
          data: { role: 'MERCHANT' },
        });
        console.log(`  ✅ Updated ${seller.user.email} to MERCHANT role`);
        updatedCount++;
      } else {
        console.log(`  ℹ️  ${seller.user.email} already has MERCHANT role`);
      }
    }

    console.log(`\n✅ Updated ${updatedCount} user(s) to MERCHANT role\n`);

    // Step 4: Show final role distribution
    console.log('Step 4: Final role distribution:');
    const roleCounts = await prisma.$queryRaw<any[]>`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY role
    `;

    console.table(roleCounts);

    console.log('\n🎉 Migration completed successfully!');
    console.log('ℹ️  Note: The EMPLOYEE value still exists in the enum type but is no longer used.');
    console.log('   This is normal PostgreSQL behavior - enum values cannot be removed easily.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateEmployeeToMerchant();
