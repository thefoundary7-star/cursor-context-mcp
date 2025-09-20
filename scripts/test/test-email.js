#!/usr/bin/env node

require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmailConfiguration() {
  console.log('📧 Testing Email Configuration...\n');

  // Check environment variables
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL'];
  const missing = requiredVars.filter(var_name => !process.env[var_name]);
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    return;
  }

  console.log('Configuration:');
  console.log(`- SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`- SMTP Port: ${process.env.SMTP_PORT}`);
  console.log(`- SMTP User: ${process.env.SMTP_USER}`);
  console.log(`- From Email: ${process.env.FROM_EMAIL}`);

  try {
    // Create transporter
    console.log('\n1. Creating email transporter...');
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Test connection
    console.log('2. Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful');

    // Send test email
    console.log('\n3. Sending test email...');
    const testEmail = {
      from: process.env.FROM_EMAIL,
      to: process.env.FROM_EMAIL, // Send to self for testing
      subject: '🎉 MCP Server Email Test - Configuration Successful!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px; text-align: center; }
            .content { padding: 20px; }
            .success { background: #f0f9ff; border: 1px solid #0284c7; border-radius: 8px; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 Email Configuration Test</h1>
            <p>MCP Server Platform</p>
          </div>
          
          <div class="content">
            <div class="success">
              <h3>✅ Email Configuration Successful!</h3>
              <p>Your MCP Server platform email system is working correctly.</p>
            </div>
            
            <h3>Configuration Details:</h3>
            <ul>
              <li><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</li>
              <li><strong>From Address:</strong> ${process.env.FROM_EMAIL}</li>
              <li><strong>Test Time:</strong> ${new Date().toISOString()}</li>
            </ul>
            
            <h3>Next Steps:</h3>
            <ol>
              <li>Test the complete customer registration flow</li>
              <li>Verify license delivery emails</li>
              <li>Test welcome email sequences</li>
            </ol>
            
            <p>If you received this email, your email configuration is ready for production!</p>
          </div>
        </body>
        </html>
      `,
      text: `
        MCP Server Email Configuration Test
        
        ✅ Email Configuration Successful!
        
        Your MCP Server platform email system is working correctly.
        
        Configuration Details:
        - SMTP Host: ${process.env.SMTP_HOST}
        - From Address: ${process.env.FROM_EMAIL}
        - Test Time: ${new Date().toISOString()}
        
        Next Steps:
        1. Test the complete customer registration flow
        2. Verify license delivery emails
        3. Test welcome email sequences
        
        If you received this email, your email configuration is ready for production!
      `
    };

    const info = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    
    if (info.preview) {
      console.log(`   Preview URL: ${info.preview}`);
    }

    console.log('\n🎉 Email configuration test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Check your inbox for the test email');
    console.log('2. Test the license delivery email templates');
    console.log('3. Configure email templates for production');

  } catch (error) {
    console.error('\n❌ Email test failed:', error.message);
    
    console.log('\nTroubleshooting:');
    if (error.code === 'EAUTH') {
      console.log('- Authentication failed: Check SMTP_USER and SMTP_PASS');
      console.log('- For Gmail: Use App Password, not regular password');
      console.log('- For Resend: Ensure API key starts with "re_"');
    } else if (error.code === 'ECONNECTION') {
      console.log('- Connection failed: Check SMTP_HOST and SMTP_PORT');
      console.log('- Verify firewall settings');
      console.log('- Check if SMTP service is accessible');
    } else {
      console.log('- Check all SMTP configuration values');
      console.log('- Verify FROM_EMAIL domain is authorized');
      console.log('- Check email provider documentation');
    }
  }
}

// Run the test
testEmailConfiguration().catch(console.error);