import { NextRequest, NextResponse } from 'next/server';
import { UsageTracker } from '../../../../services/usage/usageTracker';

export async function POST(req: NextRequest) {
  try {
    const { license_key, operation } = await req.json();

    if (!license_key) {
      return NextResponse.json({ error: 'License key required' }, { status: 400 });
    }

    // Check usage and validate license
    const result = await UsageTracker.trackMCPCall(license_key, operation || 'mcp_call');
    
    if (!result.allowed) {
      return NextResponse.json({
        success: false,
        error: result.error,
        usage: {
          remaining: result.remaining || 0,
          resetTime: result.resetTime
        }
      }, { status: 429 });
    }

    return NextResponse.json({
      success: true,
      message: 'License valid and usage recorded',
      usage: {
        remaining: result.remaining,
        resetTime: result.resetTime
      }
    });

  } catch (error) {
    console.error('License validation error:', error);
    return NextResponse.json({
      success: false,
      error: 'License validation failed'
    }, { status: 500 });
  }
}
