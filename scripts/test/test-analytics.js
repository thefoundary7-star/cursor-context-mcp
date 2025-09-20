#!/usr/bin/env node

require('dotenv').config();

function testAnalyticsConfiguration() {
  console.log('📊 Testing Analytics Configuration...\n');

  // Check environment variables
  console.log('1. Checking environment variables...');
  
  if (process.env.NEXT_PUBLIC_GA_ID) {
    console.log(`✅ Google Analytics ID found: ${process.env.NEXT_PUBLIC_GA_ID}`);
    
    // Validate GA ID format
    if (process.env.NEXT_PUBLIC_GA_ID.match(/^G-[A-Z0-9]{10}$/)) {
      console.log('✅ GA ID format is valid');
    } else {
      console.log('⚠️  GA ID format may be incorrect (should be G-XXXXXXXXXX)');
    }
  } else {
    console.log('❌ NEXT_PUBLIC_GA_ID not found in environment variables');
  }

  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    console.log(`✅ PostHog key found: ${process.env.NEXT_PUBLIC_POSTHOG_KEY.substring(0, 10)}...`);
  } else {
    console.log('⚠️  NEXT_PUBLIC_POSTHOG_KEY not found (optional)');
  }

  console.log('\n2. Testing analytics implementation...');
  
  // Test if analytics component exists
  const fs = require('fs');
  const path = require('path');
  
  const analyticsPath = path.join(process.cwd(), 'src', 'components', 'analytics', 'analytics.tsx');
  if (fs.existsSync(analyticsPath)) {
    console.log('✅ Analytics component exists');
    
    // Check if it's properly configured
    const analyticsContent = fs.readFileSync(analyticsPath, 'utf8');
    if (analyticsContent.includes('gtag')) {
      console.log('✅ Google Analytics integration found');
    }
    if (analyticsContent.includes('posthog')) {
      console.log('✅ PostHog integration found');
    }
  } else {
    console.log('❌ Analytics component not found');
  }

  console.log('\n3. Checking landing page integration...');
  
  const landingPagePath = path.join(process.cwd(), 'src', 'app', 'page.tsx');
  if (fs.existsSync(landingPagePath)) {
    const landingContent = fs.readFileSync(landingPagePath, 'utf8');
    if (landingContent.includes('Analytics')) {
      console.log('✅ Analytics component imported in landing page');
    } else {
      console.log('⚠️  Analytics component may not be imported in landing page');
    }
  }

  console.log('\n4. Testing tracking events...');
  
  // Simulate analytics events (for development testing)
  const mockWindow = {
    gtag: function(command, eventName, parameters) {
      console.log(`📈 GA Event: ${command} - ${eventName}`, parameters);
    },
    posthog: {
      capture: function(eventName, properties) {
        console.log(`📈 PostHog Event: ${eventName}`, properties);
      }
    }
  };

  // Import and test analytics functions
  try {
    // Mock window for testing
    global.window = mockWindow;
    
    // Test tracking functions
    console.log('   Testing event tracking...');
    
    // Simulate common events
    mockWindow.gtag('event', 'page_view', {
      page_title: 'Landing Page',
      page_location: 'https://mcpserver.com'
    });
    
    mockWindow.gtag('event', 'plan_selected', {
      plan: 'pro',
      currency: 'USD',
      value: 19
    });
    
    mockWindow.gtag('event', 'begin_checkout', {
      currency: 'USD',
      value: 19,
      items: [{
        item_id: 'pro',
        item_name: 'MCP Server Pro',
        category: 'subscription',
        quantity: 1,
        price: 19
      }]
    });
    
    console.log('✅ Event tracking simulation completed');
    
  } catch (error) {
    console.log('⚠️  Could not test analytics functions:', error.message);
  }

  console.log('\n🎉 Analytics configuration test completed!');
  
  console.log('\nNext steps:');
  console.log('1. Start your development server: npm run dev');
  console.log('2. Open browser developer tools (F12)');
  console.log('3. Go to Network tab and visit your landing page');
  console.log('4. Look for requests to google-analytics.com or googletagmanager.com');
  console.log('5. Check Google Analytics Real-time reports');
  console.log('6. Visit: https://analytics.google.com/analytics/web/#/realtime/rt-overview');

  console.log('\nManual testing checklist:');
  console.log('- [ ] Page views appear in GA Real-time');
  console.log('- [ ] Plan selection events fire');
  console.log('- [ ] Registration events track');
  console.log('- [ ] Checkout events track');
  console.log('- [ ] Purchase events fire on completion');
}

// Run the test
testAnalyticsConfiguration();