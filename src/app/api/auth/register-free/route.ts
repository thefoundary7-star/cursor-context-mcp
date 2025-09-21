import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { UsageTracker, SubscriptionTier } from '../../../../services/usage/usageTracker';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { licenses: true }
    });

    if (existingUser) {
      // If user exists but has no free license, create one
      const freeLicense = existingUser.licenses.find(l => l.tier === SubscriptionTier.FREE);
      
      if (freeLicense) {
        return NextResponse.json({ 
          error: 'Account already exists. Please check your email for your license key.' 
        }, { status: 400 });
      }

      // Create free license for existing user
      const licenseKey = UsageTracker.generateFreeLicenseKey(email);
      
      const license = await prisma.license.create({
        data: {
          userId: existingUser.id,
          licenseKey,
          name: 'FileBridge Free',
          tier: SubscriptionTier.FREE,
          maxServers: 1,
          isActive: true
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Free license created for existing account',
        licenseKey
      });
    }

    // Create new free tier user
    const user = await prisma.user.create({
      data: {
        email,
        role: 'USER',
        isActive: true,
        emailVerified: new Date()
      }
    });

    // Generate free tier license
    const licenseKey = UsageTracker.generateFreeLicenseKey(email);
    
    const license = await prisma.license.create({
      data: {
        userId: user.id,
        licenseKey,
        name: 'FileBridge Free',
        tier: SubscriptionTier.FREE,
        maxServers: 1,
        isActive: true
      }
    });

    // TODO: Send welcome email with license key
    // await sendWelcomeEmail(email, licenseKey, 'free');

    return NextResponse.json({
      success: true,
      message: 'Free account created successfully',
      licenseKey
    });

  } catch (error) {
    console.error('Free registration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create account'
    }, { status: 500 });
  }
}
