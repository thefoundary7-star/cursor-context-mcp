#!/usr/bin/env python3
"""
Real-time Webhook Monitor for FileBridge Dodo Integration

This script monitors your webhook endpoint and database for incoming
Dodo payment events in real-time.
"""

import sqlite3
import time
import json
from datetime import datetime
from pathlib import Path

class WebhookMonitor:
    def __init__(self):
        self.db_path = Path("prisma/dev.db")
        self.last_check = datetime.now()
        
    def get_recent_webhooks(self, minutes=5):
        """Get webhooks from the last N minutes"""
        if not self.db_path.exists():
            return []
            
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT * FROM webhook_events 
                WHERE createdAt > datetime('now', '-{} minutes')
                ORDER BY createdAt DESC
            """.format(minutes))
            
            webhooks = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return webhooks
        except sqlite3.OperationalError:
            conn.close()
            return []
    
    def get_recent_subscriptions(self, minutes=10):
        """Get recently created subscriptions"""
        if not self.db_path.exists():
            return []
            
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT s.*, u.email, l.licenseKey 
                FROM subscriptions s
                LEFT JOIN users u ON s.userId = u.id
                LEFT JOIN licenses l ON s.licenseKey = l.licenseKey
                WHERE s.createdAt > datetime('now', '-{} minutes')
                ORDER BY s.createdAt DESC
            """.format(minutes))
            
            subscriptions = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return subscriptions
        except sqlite3.OperationalError:
            conn.close()
            return []
    
    def get_recent_licenses(self, minutes=10):
        """Get recently generated licenses"""
        if not self.db_path.exists():
            return []
            
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT l.*, u.email 
                FROM licenses l
                LEFT JOIN users u ON l.userId = u.id
                WHERE l.createdAt > datetime('now', '-{} minutes')
                ORDER BY l.createdAt DESC
            """.format(minutes))
            
            licenses = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return licenses
        except sqlite3.OperationalError:
            conn.close()
            return []
    
    def print_webhook_summary(self, webhooks):
        """Print a summary of webhook events"""
        if not webhooks:
            print("📭 No recent webhook events")
            return
            
        print(f"📨 {len(webhooks)} webhook event(s):")
        for webhook in webhooks:
            status = "✅ Processed" if webhook['processed'] else "⏳ Pending"
            timestamp = webhook['createdAt']
            event_type = webhook['eventType']
            attempts = webhook['attempts']
            
            print(f"  {status} | {timestamp} | {event_type} | {attempts} attempts")
            
            if webhook['error']:
                print(f"    ❌ Error: {webhook['error']}")
    
    def print_subscription_summary(self, subscriptions):
        """Print a summary of recent subscriptions"""
        if not subscriptions:
            print("📋 No recent subscriptions")
            return
            
        print(f"💳 {len(subscriptions)} subscription(s):")
        for sub in subscriptions:
            email = sub['email'] or 'N/A'
            tier = sub['tier']
            status = sub['status']
            license_key = sub['licenseKey'] or 'Not generated'
            
            print(f"  📧 {email} | {tier} | {status} | {license_key[:20]}...")
    
    def print_license_summary(self, licenses):
        """Print a summary of recent licenses"""
        if not licenses:
            print("🔑 No recent licenses")
            return
            
        print(f"🔑 {len(licenses)} license(s):")
        for license in licenses:
            email = license['email'] or 'N/A'
            tier = license['tier']
            license_key = license['licenseKey']
            active = "🟢 Active" if license['isActive'] else "🔴 Inactive"
            
            print(f"  {active} | {email} | {tier} | {license_key}")
    
    def monitor_continuous(self):
        """Continuously monitor for webhook events"""
        print("🚀 FileBridge Webhook Monitor Started")
        print("=" * 50)
        print("Monitoring for Dodo webhook events...")
        print("Press Ctrl+C to stop\n")
        
        try:
            while True:
                # Clear screen and show current time
                print(f"\n🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print("-" * 50)
                
                # Get recent data
                webhooks = self.get_recent_webhooks(1)  # Last 1 minute
                subscriptions = self.get_recent_subscriptions(5)  # Last 5 minutes  
                licenses = self.get_recent_licenses(5)  # Last 5 minutes
                
                # Print summaries
                self.print_webhook_summary(webhooks)
                print()
                self.print_subscription_summary(subscriptions)
                print()
                self.print_license_summary(licenses)
                
                # Wait before next check
                time.sleep(10)  # Check every 10 seconds
                
        except KeyboardInterrupt:
            print("\n\n👋 Webhook monitoring stopped")
    
    def check_webhook_health(self):
        """Check webhook endpoint health"""
        print("🏥 Webhook Health Check")
        print("=" * 30)
        
        # Check if database exists
        if not self.db_path.exists():
            print("❌ Database not found")
            return False
            
        print("✅ Database connection OK")
        
        # Check recent webhook activity
        webhooks = self.get_recent_webhooks(60)  # Last hour
        successful_webhooks = [w for w in webhooks if w['processed']]
        failed_webhooks = [w for w in webhooks if not w['processed'] and w['attempts'] > 0]
        
        print(f"📊 Last hour: {len(webhooks)} total, {len(successful_webhooks)} processed, {len(failed_webhooks)} failed")
        
        if failed_webhooks:
            print("⚠️  Recent failures:")
            for failure in failed_webhooks[-3:]:  # Show last 3 failures
                print(f"  {failure['eventType']} - {failure['error']}")
        
        return len(failed_webhooks) == 0

def main():
    import sys
    
    monitor = WebhookMonitor()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--health":
        monitor.check_webhook_health()
    else:
        monitor.monitor_continuous()

if __name__ == "__main__":
    main()
