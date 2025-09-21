import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// String constants for enum values
const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
} as const;

const SubscriptionTier = {
  FREE: 'FREE',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE'
} as const;

const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  CANCELED: 'CANCELED',
  PAST_DUE: 'PAST_DUE',
  TRIALING: 'TRIALING',
  UNPAID: 'UNPAID'
} as const;

// Generate a secure license key
function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 3; i++) {
    segments.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return `FILEBRIDGE-${segments.join('-')}`;
}

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create test users
  const testUsers = [
    {
      email: 'admin@filebridge.dev',
      role: UserRole.ADMIN,
      name: 'Admin User',
      password: await bcrypt.hash('admin123', 10)
    },
    {
      email: 'free@filebridge.dev',
      role: UserRole.USER,
      name: 'Free User',
      password: await bcrypt.hash('free123', 10)
    },
    {
      email: 'pro@filebridge.dev',
      role: UserRole.USER,
      name: 'Pro User',
      password: await bcrypt.hash('pro123', 10)
    }
  ];

  // Create users
  for (const userData of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        role: userData.role,
        name: userData.name,
        password: userData.password,
        isActive: true,
        emailVerified: new Date()
      }
    });

    console.log(`✅ Created user: ${user.email}`);

    // Create licenses for users
    let tier: string = SubscriptionTier.FREE;
    if (userData.email.includes('pro')) tier = SubscriptionTier.PRO;
    if (userData.email.includes('admin')) tier = SubscriptionTier.ENTERPRISE;

    const licenseKey = userData.email === 'free@filebridge.dev' 
      ? 'FILEBRIDGE-FREE-TEST1234'
      : generateLicenseKey();

    const license = await prisma.license.upsert({
      where: { licenseKey },
      update: {},
      create: {
        licenseKey,
        userId: user.id,
        name: `FileBridge ${tier}`,
        tier,
        maxServers: tier === SubscriptionTier.FREE ? 1 : 5,
        isActive: true
      }
    });

    console.log(`✅ Created license: ${license.licenseKey} (${tier})`);

    // Create subscription for paid users
    if (tier !== SubscriptionTier.FREE) {
      await prisma.subscription.upsert({
        where: { licenseKey },
        update: {},
        create: {
          userId: user.id,
          dodoSubscriptionId: `sub_${crypto.randomUUID()}`,
          dodoCustomerId: `cus_${crypto.randomUUID()}`,
          dodoProductId: tier === SubscriptionTier.PRO ? 'pdt_pro' : 'pdt_enterprise',
          tier,
          status: SubscriptionStatus.ACTIVE,
          licenseKey,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          metadata: JSON.stringify({ source: 'seed' })
        }
      });

      console.log(`✅ Created subscription for ${user.email}`);
    }

    // Create sample daily usage for free user
    if (tier === SubscriptionTier.FREE) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.dailyUsage.upsert({
        where: {
          licenseId_date: {
            licenseId: license.id,
            date: today
          }
        },
        update: {},
        create: {
          licenseId: license.id,
          date: today,
          callCount: 5 // Show some usage
        }
      });

      console.log(`✅ Created daily usage for free user`);
    }
  }

  // Create some sample webhook events
  await prisma.webhookEvent.create({
    data: {
      dodoEventId: 'evt_test_123',
      eventType: 'subscription.created',
      processed: true,
      data: JSON.stringify({
        id: 'sub_test',
        customer: 'cus_test',
        status: 'active'
      }),
      processedAt: new Date()
    }
  });

  console.log('✅ Created sample webhook event');

  console.log('🎉 Database seeding completed successfully!');
  console.log('');
  console.log('Test accounts created:');
  console.log('📧 admin@filebridge.dev (password: admin123) - Enterprise');
  console.log('📧 pro@filebridge.dev (password: pro123) - Pro');  
  console.log('📧 free@filebridge.dev (password: free123) - Free');
  console.log('');
  console.log('🔑 Test license key: FILEBRIDGE-FREE-TEST1234');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
