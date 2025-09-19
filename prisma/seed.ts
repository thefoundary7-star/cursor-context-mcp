import { PrismaClient, UserRole, SubscriptionPlan, SubscriptionStatus, LicensePlan } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Generate a secure license key
function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 3; i++) {
    segments.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return `MCP-${segments.join('-')}`;
}

// Generate a secure API key
function generateApiKey(): string {
  return `mcp_${crypto.randomBytes(32).toString('hex')}`;
}

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mcp-saas.com' },
    update: {},
    create: {
      email: 'admin@mcp-saas.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      company: 'MCP SaaS',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create demo users
  const demoUsers = [
    {
      email: 'demo@example.com',
      firstName: 'Demo',
      lastName: 'User',
      company: 'Demo Company',
      role: UserRole.USER,
    },
    {
      email: 'enterprise@example.com',
      firstName: 'Enterprise',
      lastName: 'User',
      company: 'Enterprise Corp',
      role: UserRole.USER,
    },
  ];

  for (const userData of demoUsers) {
    const password = await bcrypt.hash('demo123!', 12);
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        password,
        isActive: true,
      },
    });

    console.log('✅ Demo user created:', user.email);

    // Create subscriptions for demo users
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: userData.email === 'enterprise@example.com' ? SubscriptionPlan.ENTERPRISE : SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        trialStart: new Date(),
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      },
    });

    console.log('✅ Subscription created for:', user.email);

    // Create licenses for demo users
    const license = await prisma.license.create({
      data: {
        userId: user.id,
        licenseKey: generateLicenseKey(),
        name: `${userData.company} License`,
        description: `Production license for ${userData.company}`,
        plan: userData.email === 'enterprise@example.com' ? LicensePlan.ENTERPRISE : LicensePlan.PRO,
        maxServers: userData.email === 'enterprise@example.com' ? 100 : 10,
        isActive: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        subscriptionId: subscription.id,
      },
    });

    console.log('✅ License created for:', user.email, 'Key:', license.licenseKey);

    // Create API keys for demo users
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: 'Default API Key',
        keyHash: await bcrypt.hash(generateApiKey(), 12),
        permissions: {
          read: true,
          write: true,
          admin: userData.email === 'enterprise@example.com',
        },
        isActive: true,
      },
    });

    console.log('✅ API key created for:', user.email);

    // Create sample servers
    const servers = [
      {
        serverId: `server-${crypto.randomUUID()}`,
        name: 'Production Server',
        version: '1.0.0',
        isActive: true,
      },
      {
        serverId: `server-${crypto.randomUUID()}`,
        name: 'Development Server',
        version: '1.0.0',
        isActive: true,
      },
    ];

    for (const serverData of servers) {
      const server = await prisma.server.create({
        data: {
          ...serverData,
          licenseId: license.id,
          lastSeen: new Date(),
        },
      });

      console.log('✅ Server created:', server.name);

      // Create sample analytics data
      const analyticsEvents = [
        {
          eventType: 'SERVER_START' as const,
          eventData: { serverId: server.serverId, timestamp: new Date() },
          metadata: { version: server.version },
        },
        {
          eventType: 'REQUEST_COUNT' as const,
          eventData: { count: Math.floor(Math.random() * 1000) },
          metadata: { endpoint: '/api/health' },
        },
        {
          eventType: 'HEARTBEAT' as const,
          eventData: { status: 'healthy' },
          metadata: { uptime: Math.floor(Math.random() * 86400) },
        },
      ];

      for (const event of analyticsEvents) {
        await prisma.analytics.create({
          data: {
            userId: user.id,
            licenseId: license.id,
            serverId: server.id,
            ...event,
            timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last 7 days
          },
        });
      }

      // Create sample usage data
      await prisma.usage.create({
        data: {
          userId: user.id,
          licenseId: license.id,
          serverId: server.id,
          operationType: 'api_call',
          count: Math.floor(Math.random() * 10000),
          timestamp: new Date(),
          billingPeriod: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // First day of current month
          metadata: {
            endpoint: '/api/analytics',
            responseTime: Math.random() * 100,
          },
        },
      });
    }

    console.log('✅ Sample data created for:', user.email);
  }

  // Create sample invoices
  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
  });

  if (demoUser) {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: demoUser.id },
    });

    if (subscription) {
      await prisma.invoice.create({
        data: {
          userId: demoUser.id,
          stripeInvoiceId: `in_${crypto.randomUUID()}`,
          subscriptionId: subscription.id,
          amount: 2900, // $29.00
          currency: 'usd',
          status: 'PAID' as any,
          paidAt: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          invoiceUrl: 'https://invoice.stripe.com/i/acct_123/inv_456',
          hostedInvoiceUrl: 'https://invoice.stripe.com/i/acct_123/inv_456',
        },
      });

      console.log('✅ Sample invoice created');
    }
  }

  // Create webhook events for testing
  await prisma.webhookEvent.create({
    data: {
      eventType: 'customer.subscription.created',
      eventId: `evt_${crypto.randomUUID()}`,
      processed: true,
      data: {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        plan: { id: 'price_123', name: 'Pro Plan' },
      },
    },
  });

  console.log('✅ Sample webhook event created');

  console.log('🎉 Database seeding completed successfully!');
  console.log('');
  console.log('📋 Created data:');
  console.log('  - 1 Admin user (admin@mcp-saas.com / admin123!)');
  console.log('  - 2 Demo users (demo@example.com / demo123!)');
  console.log('  - 2 Active subscriptions');
  console.log('  - 2 Licenses with API keys');
  console.log('  - 4 Sample servers');
  console.log('  - Sample analytics and usage data');
  console.log('  - Sample invoices and webhook events');
  console.log('');
  console.log('🔑 License Keys:');
  const licenses = await prisma.license.findMany({
    include: { user: true },
  });
  licenses.forEach(license => {
    console.log(`  ${license.user.email}: ${license.licenseKey}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });