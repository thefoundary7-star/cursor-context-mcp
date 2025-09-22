import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('Test webhook received:', new Date().toISOString());

  try {
    const body = await req.text();
    console.log('Request body:', body);

    return NextResponse.json({
      success: true,
      message: 'Test webhook received',
      timestamp: new Date().toISOString(),
      body_length: body.length
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Test webhook endpoint is working',
    timestamp: new Date().toISOString()
  });
}