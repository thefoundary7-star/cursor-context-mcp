#!/usr/bin/env python3
"""
Production Webhook Testing Setup

This script helps you test webhooks with Dodo Payments in a production-like environment
using ngrok to expose your local server to the internet.
"""

import subprocess
import requests
import json
import time
import re
from pathlib import Path

class ProductionWebhookTester:
    def __init__(self):
        self.dodo_api_key = "9qdlscFv-j1-WagC.6qTQWMIg41EwtorB5Ja1NYB22H8tJ9kz8yuOPSj-CL5Siwy2"
        self.local_port = 3001
        self.ngrok_url = None
        
    def check_ngrok_installed(self):
        """Check if ngrok is installed"""
        try:
            result = subprocess.run(['ngrok', 'version'], capture_output=True, text=True)
            return result.returncode == 0
        except FileNotFoundError:
            return False
    
    def start_ngrok(self):
        """Start ngrok tunnel"""
        print("Starting ngrok tunnel...")
        
        try:
            # Start ngrok in background
            process = subprocess.Popen(
                ['ngrok', 'http', str(self.local_port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Wait for ngrok to start
            time.sleep(3)
            
            # Get ngrok URL from API
            try:
                response = requests.get('http://localhost:4040/api/tunnels')
                data = response.json()
                
                for tunnel in data['tunnels']:
                    if tunnel['config']['addr'] == f'localhost:{self.local_port}':
                        self.ngrok_url = tunnel['public_url']
                        if self.ngrok_url.startswith('http://'):
                            # Prefer HTTPS URL
                            self.ngrok_url = self.ngrok_url.replace('http://', 'https://')
                        break
                        
                if self.ngrok_url:
                    print(f"✅ Ngrok tunnel active: {self.ngrok_url}")
                    return True
                else:
                    print("❌ Could not get ngrok URL")
                    return False
                    
            except Exception as e:
                print(f"❌ Error getting ngrok URL: {e}")
                return False
                
        except Exception as e:
            print(f"❌ Error starting ngrok: {e}")
            return False
    
    def update_dodo_webhook_url(self):
        """Update webhook URL in Dodo dashboard"""
        webhook_endpoint = f"{self.ngrok_url}/api/webhooks/dodo"
        
        print(f"🔧 Webhook Configuration")
        print("=" * 40)
        print(f"Public URL: {webhook_endpoint}")
        print(f"Local URL: http://localhost:{self.local_port}/api/webhooks/dodo")
        print()
        print("📋 Manual Steps Required:")
        print("1. Go to Dodo Dashboard: https://dashboard.dodo.dev")
        print("2. Navigate to Webhooks section")
        print("3. Update webhook endpoint URL to:")
        print(f"   {webhook_endpoint}")
        print("4. Ensure these events are enabled:")
        print("   - subscription.created")
        print("   - subscription.updated") 
        print("   - subscription.cancelled")
        print("   - payment.succeeded")
        print("   - payment.failed")
        print()
        
        return webhook_endpoint
    
    def test_webhook_connectivity(self):
        """Test if webhook endpoint is accessible"""
        if not self.ngrok_url:
            print("❌ Ngrok URL not available")
            return False
            
        webhook_url = f"{self.ngrok_url}/api/webhooks/dodo"
        
        print("🔍 Testing webhook connectivity...")
        
        try:
            # Test GET request (should return method not allowed)
            response = requests.get(webhook_url, timeout=10)
            if response.status_code == 405:  # Method not allowed is expected
                print("✅ Webhook endpoint is accessible")
                return True
            else:
                print(f"⚠️  Unexpected response: {response.status_code}")
                return True  # Still accessible
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Webhook not accessible: {e}")
            return False
    
    def create_test_payment_link(self):
        """Create a test payment link for webhook testing"""
        print("💳 Creating Test Payment Link")
        print("=" * 40)
        
        payment_data = {
            "customer": {
                "email": "webhook.test@filebridge.dev",
                "name": "Webhook Test Customer"
            },
            "product_id": "pdt_p92POwVpAzZbsfuLo2HGm",  # Pro plan
            "success_url": f"{self.ngrok_url}/success?test=webhook",
            "cancel_url": f"{self.ngrok_url}/pricing",
            "metadata": {
                "test_type": "webhook_integration",
                "timestamp": str(int(time.time())),
                "webhook_url": f"{self.ngrok_url}/api/webhooks/dodo"
            }
        }
        
        try:
            response = requests.post(
                "https://api.dodo.dev/v1/subscriptions",
                headers={
                    "Authorization": f"Bearer {self.dodo_api_key}",
                    "Content-Type": "application/json"
                },
                json=payment_data,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                checkout_url = data.get('checkout_url')
                subscription_id = data.get('id')
                
                print("✅ Test payment link created!")
                print(f"Subscription ID: {subscription_id}")
                print(f"Checkout URL: {checkout_url}")
                print()
                print("🧪 Testing Instructions:")
                print("1. Complete the payment using test card details")
                print("2. Monitor webhook events in real-time")
                print("3. Verify license generation and email delivery")
                print("4. Check database for new records")
                print()
                print("💳 Test Card Details (Dodo Sandbox):")
                print("Card Number: 4242424242424242")
                print("Expiry: Any future date")
                print("CVC: Any 3 digits")
                
                return checkout_url
                
            else:
                print(f"❌ Failed to create payment link: {response.status_code}")
                print(f"Error: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error creating payment link: {e}")
            return None
    
    def run_production_test(self):
        """Run complete production webhook test"""
        print("🚀 FileBridge Production Webhook Test")
        print("=" * 50)
        print("This will test your webhook integration with real Dodo events")
        print()
        
        # Step 1: Check ngrok
        if not self.check_ngrok_installed():
            print("❌ ngrok not found. Please install ngrok:")
            print("   Download from: https://ngrok.com/download")
            print("   Or install via: brew install ngrok (macOS)")
            return False
        
        print("✅ ngrok is installed")
        
        # Step 2: Start ngrok
        if not self.start_ngrok():
            print("❌ Failed to start ngrok tunnel")
            return False
        
        # Step 3: Update webhook URL
        webhook_endpoint = self.update_dodo_webhook_url()
        
        # Step 4: Test connectivity
        if not self.test_webhook_connectivity():
            print("❌ Webhook endpoint not accessible")
            return False
        
        # Step 5: Create test payment
        print("\n" + "=" * 50)
        create_payment = input("Create test payment link? (y/n): ").lower() == 'y'
        
        if create_payment:
            checkout_url = self.create_test_payment_link()
            if checkout_url:
                print(f"\n🔗 Open this URL to test: {checkout_url}")
        
        print("\n" + "=" * 50)
        print("🎯 Next Steps:")
        print("1. Keep this script running")
        print("2. Complete test payment in browser")
        print("3. Run webhook monitor in another terminal:")
        print("   python monitor_webhooks.py")
        print("4. Verify end-to-end customer journey")
        print()
        print("Press Ctrl+C to stop ngrok tunnel...")
        
        try:
            while True:
                time.sleep(30)
                print(f"🟢 Webhook endpoint active: {webhook_endpoint}")
        except KeyboardInterrupt:
            print("\n👋 Stopping webhook test...")
            return True

def main():
    tester = ProductionWebhookTester()
    tester.run_production_test()

if __name__ == "__main__":
    main()
