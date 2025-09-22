#!/usr/bin/env python3
"""
Dodo Payments Webhook Testing Suite

This script tests your Dodo Payments webhook integration by:
1. Simulating webhook events locally
2. Testing with Dodo's webhook testing tools
3. Verifying end-to-end payment flows
4. Monitoring webhook delivery and processing
"""

import requests
import json
import hmac
import hashlib
import time
from datetime import datetime
import os
from pathlib import Path

class DodoWebhookTester:
    def __init__(self):
        self.api_key = "9qdlscFv-j1-WagC.6qTQWMIg41EwtorB5Ja1NYB22H8tJ9kz8yuOPSj-CL5Siwy2"
        self.webhook_secret = "whsec_Yp/rYxU8ot2pQ9XAOGoyeW9Mfgz78Tqb"
        self.webhook_url = "http://localhost:3002/api/webhooks/dodo"  # Your local server
        self.pro_product_id = "pdt_p92POwVpAzZbsfuLo2HGm"
        self.enterprise_product_id = "pdt_GFVWPL3v3IfPnY0J3mRfN"
        
    def generate_webhook_signature(self, payload_body, timestamp):
        """Generate webhook signature for verification"""
        # Dodo uses HMAC-SHA256 for webhook signatures
        message = f"{timestamp}.{payload_body}"
        signature = hmac.new(
            self.webhook_secret.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return f"t={timestamp},v1={signature}"
    
    def test_webhook_endpoint_locally(self):
        """Test webhook endpoint with simulated events"""
        print("🧪 Testing Webhook Endpoint Locally")
        print("=" * 50)
        
        test_events = [
            {
                "name": "Subscription Created",
                "event": "subscription.created",
                "data": {
                    "id": "sub_test_12345",
                    "customer": {
                        "id": "cus_test_12345",
                        "email": "test@example.com"
                    },
                    "product_id": self.pro_product_id,
                    "status": "active",
                    "current_period_start": int(time.time()),
                    "current_period_end": int(time.time() + 30*24*60*60)
                }
            },
            {
                "name": "Payment Succeeded",
                "event": "payment.succeeded",
                "data": {
                    "id": "pay_test_12345",
                    "subscription_id": "sub_test_12345",
                    "amount": 1900,  # $19.00 in cents
                    "currency": "USD",
                    "status": "succeeded"
                }
            },
            {
                "name": "Subscription Cancelled",
                "event": "subscription.cancelled",
                "data": {
                    "id": "sub_test_12345",
                    "customer": {
                        "id": "cus_test_12345",
                        "email": "test@example.com"
                    },
                    "status": "cancelled",
                    "cancelled_at": int(time.time())
                }
            }
        ]
        
        for test_event in test_events:
            print(f"\n📋 Testing: {test_event['name']}")
            print("-" * 30)
            
            # Create webhook payload
            payload = {
                "id": f"evt_{int(time.time())}",
                "type": test_event["event"],
                "data": test_event["data"],
                "created": int(time.time())
            }
            
            payload_json = json.dumps(payload)
            timestamp = str(int(time.time()))
            
            # Generate signature
            signature = self.generate_webhook_signature(payload_json, timestamp)
            
            # Send webhook
            try:
                response = requests.post(
                    self.webhook_url,
                    data=payload_json,
                    headers={
                        "Content-Type": "application/json",
                        "X-Dodo-Signature": signature,
                        "X-Dodo-Timestamp": timestamp
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    print(f"✅ SUCCESS: {response.status_code}")
                    print(f"Response: {response.text}")
                else:
                    print(f"❌ FAILED: {response.status_code}")
                    print(f"Response: {response.text}")
                    
            except requests.exceptions.ConnectionError:
                print("❌ CONNECTION ERROR: Make sure your server is running on localhost:3001")
            except Exception as e:
                print(f"❌ ERROR: {e}")
                
            time.sleep(1)  # Wait between tests
    
    def test_real_dodo_webhook(self):
        """Test with Dodo's actual webhook testing tools"""
        print("\n🌐 Testing with Dodo Payments Webhook Tools")
        print("=" * 50)
        
        # Instructions for manual testing
        print("To test with real Dodo webhooks:")
        print("\n1. 📊 Access Dodo Dashboard:")
        print("   - Go to https://dashboard.dodo.dev")
        print("   - Navigate to Webhooks section")
        print("   - Find your webhook endpoint")
        
        print("\n2. 🔧 Configure Webhook URL:")
        print("   - If testing locally, use ngrok:")
        print("     ngrok http 3001")
        print("   - Update webhook URL to: https://your-ngrok-url.ngrok.io/api/webhooks/dodo")
        
        print("\n3. 🧪 Send Test Events:")
        print("   - Use Dodo's 'Send Test Event' feature")
        print("   - Test these events:")
        print("     • subscription.created")
        print("     • payment.succeeded") 
        print("     • subscription.cancelled")
        
        print("\n4. ✅ Verify in Dashboard:")
        print("   - Check webhook delivery status")
        print("   - View response codes and timing")
        print("   - Monitor for any failures")
    
    def create_test_subscription(self):
        """Create a real test subscription in Dodo"""
        print("\n💳 Creating Test Subscription")
        print("=" * 50)
        
        # Create a test customer and subscription
        subscription_data = {
            "customer": {
                "email": "webhook.test@filebridge.dev",
                "name": "Webhook Test User"
            },
            "product_id": self.pro_product_id,
            "success_url": "http://localhost:3001/success",
            "cancel_url": "http://localhost:3001/pricing",
            "metadata": {
                "test": "webhook_integration",
                "timestamp": str(int(time.time()))
            }
        }
        
        try:
            response = requests.post(
                "https://api.dodo.dev/v1/subscriptions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json=subscription_data,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Test subscription created successfully!")
                print(f"Subscription ID: {data.get('id')}")
                print(f"Checkout URL: {data.get('checkout_url')}")
                print("\n🔗 Next Steps:")
                print("1. Open the checkout URL")
                print("2. Complete the test payment")
                print("3. Monitor your webhook endpoint for events")
                return data
            else:
                print(f"❌ Failed to create subscription: {response.status_code}")
                print(f"Error: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error creating subscription: {e}")
            return None
    
    def monitor_webhook_logs(self):
        """Monitor webhook processing in your application"""
        print("\n📊 Webhook Monitoring Guide")
        print("=" * 50)
        
        print("Monitor these areas for webhook processing:")
        print("\n1. 📁 Application Logs:")
        print("   - Check console output from your Next.js server")
        print("   - Look for webhook processing messages")
        
        print("\n2. 🗄️  Database Changes:")
        print("   - Check webhook_events table for new entries")
        print("   - Verify subscription and payment records")
        print("   - Monitor license generation and activation")
        
        print("\n3. 📧 Email Delivery:")
        print("   - Confirm license delivery emails are sent")
        print("   - Check email content and formatting")
        
        print("\n4. 🔍 Debug Commands:")
        print("   # Check recent webhook events")
        print("   sqlite3 prisma/dev.db \"SELECT * FROM webhook_events ORDER BY createdAt DESC LIMIT 5;\"")
        print("\n   # Check license generation")
        print("   sqlite3 prisma/dev.db \"SELECT * FROM licenses WHERE createdAt > datetime('now', '-1 hour');\"")
        
    def run_comprehensive_test(self):
        """Run complete webhook testing suite"""
        print("🚀 FileBridge Dodo Webhook Integration Test")
        print("=" * 60)
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Environment: Sandbox")
        print(f"Webhook URL: {self.webhook_url}")
        print("=" * 60)
        
        # Test 1: Local webhook simulation
        self.test_webhook_endpoint_locally()
        
        # Test 2: Real Dodo webhook instructions  
        self.test_real_dodo_webhook()
        
        # Test 3: Create test subscription
        print("\n" + "=" * 60)
        user_choice = input("Do you want to create a real test subscription? (y/n): ")
        if user_choice.lower() == 'y':
            subscription = self.create_test_subscription()
            if subscription:
                print(f"\n🎯 Test Plan:")
                print("1. Complete the checkout process")
                print("2. Monitor webhook delivery")
                print("3. Verify license generation")
                print("4. Test customer journey end-to-end")
        
        # Test 4: Monitoring guide
        self.monitor_webhook_logs()
        
        print("\n" + "=" * 60)
        print("✅ Webhook testing setup complete!")
        print("Monitor your server logs and database for webhook events.")

def main():
    tester = DodoWebhookTester()
    tester.run_comprehensive_test()

if __name__ == "__main__":
    main()
