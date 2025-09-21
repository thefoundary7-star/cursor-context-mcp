import { NextRequest, NextResponse } from 'next/server';
import { UsageTracker } from '../../../../services/usage/usageTracker';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const licenseKey = searchParams.get('license_key');

    if (!licenseKey) {
      return NextResponse.json({ error: 'License key required' }, { status: 400 });
    }

    const usage = await UsageTracker.getDailyUsage(licenseKey);
    
    return NextResponse.json({ 
      success: true, 
      usage 
    });

  } catch (error) {
    console.error('Usage check error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
