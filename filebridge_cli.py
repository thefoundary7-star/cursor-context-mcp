#!/usr/bin/env python3
"""
FileBridge CLI - License Management Tool

A simple command-line interface for managing FileBridge licenses,
activation, and viewing usage statistics.
"""

import os
import sys
import json
import argparse
import requests
from pathlib import Path
from typing import Dict, Any, Optional

class FileBridgeCLI:
    """Command-line interface for FileBridge license management"""
    
    def __init__(self):
        self.config_dir = Path.home() / '.filebridge'
        self.config_file = self.config_dir / 'config.json'
        self.api_base_url = os.getenv('NEXT_PUBLIC_API_URL', 'http://localhost:3000/api')
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file"""
        if not self.config_file.exists():
            return {}
        
        try:
            with open(self.config_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load config: {e}")
            return {}
    
    def _save_config(self):
        """Save configuration to file"""
        try:
            self.config_dir.mkdir(parents=True, exist_ok=True)
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")
            return False
        return True
    
    def activate(self, license_key: str) -> bool:
        """Activate a FileBridge license"""
        print(f"[KEY] Activating license: {license_key[:20]}...")
        
        # Validate license with API
        try:
            response = requests.get(
                f"{self.api_base_url}/usage/check",
                params={"license_key": license_key},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    # Save license to config
                    self.config['license_key'] = license_key
                    self.config['activated_at'] = str(Path.cwd())
                    
                    if self._save_config():
                        usage = data.get("usage", {})
                        if usage == "unlimited":
                            print("[SUCCESS] License activated successfully! (Pro Plan - Unlimited)")
                        else:
                            remaining = usage.get("remaining", 0)
                            limit = usage.get("limit", 50)
                            print(f"[SUCCESS] License activated successfully! (Free Plan - {remaining}/{limit} calls remaining)")
                        
                        print(f"[CONFIG] Config saved to: {self.config_file}")
                        return True
                    else:
                        print("[ERROR] License valid but could not save config")
                        return False
                else:
                    print(f"[ERROR] License validation failed: {data.get('error', 'Unknown error')}")
                    return False
            else:
                print(f"❌ License validation failed: HTTP {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error during activation: {e}")
            print("💡 Tip: Ensure the FileBridge server is running and accessible")
            return False
    
    def status(self) -> bool:
        """Show current license and usage status"""
        license_key = self.config.get('license_key')
        
        if not license_key:
            print("❌ No license activated")
            print("\n💡 To get started:")
            print("   1. Get free license: https://filebridge.dev/free")
            print("   2. Activate with: filebridge activate YOUR_LICENSE_KEY")
            return False
        
        print(f"[LICENSE] License: {license_key[:20]}...{license_key[-8:]}")
        print(f"[CONFIG] Config: {self.config_file}")
        
        # Get current usage
        try:
            response = requests.get(
                f"{self.api_base_url}/usage/check",
                params={"license_key": license_key},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    usage = data.get("usage", {})
                    
                    if usage == "unlimited":
                        print("✅ Status: Active (Pro Plan)")
                        print("📊 Usage: Unlimited calls")
                    else:
                        remaining = usage.get("remaining", 0)
                        used = usage.get("usage", 0)
                        limit = usage.get("limit", 50)
                        reset_time = usage.get("resetTime", "")
                        
                        print("✅ Status: Active (Free Plan)")
                        print(f"📊 Usage: {used}/{limit} calls used today")
                        print(f"⏳ Remaining: {remaining} calls")
                        
                        if reset_time:
                            from datetime import datetime
                            try:
                                reset_dt = datetime.fromisoformat(reset_time.replace('Z', '+00:00'))
                                print(f"🔄 Resets: {reset_dt.strftime('%Y-%m-%d %H:%M UTC')}")
                            except:
                                print(f"🔄 Resets: {reset_time}")
                    
                    return True
                else:
                    print(f"❌ License error: {data.get('error', 'Unknown error')}")
                    return False
            else:
                print(f"❌ API error: HTTP {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Offline mode: {e}")
            print("📝 License file exists but cannot verify with server")
            return True
    
    def upgrade(self):
        """Show upgrade information"""
        print("🚀 Upgrade to FileBridge Pro")
        print("=" * 40)
        print("✨ Unlimited MCP calls")
        print("📁 Multiple project support")
        print("⚡ Real-time file watching")
        print("🔧 Git integration")
        print("📧 Priority email support")
        print()
        print("💰 Only $19/month")
        print("🌐 Visit: https://filebridge.dev/pricing")
        print()
        
        # Show current usage if on free plan
        license_key = self.config.get('license_key')
        if license_key:
            try:
                response = requests.get(
                    f"{self.api_base_url}/usage/check",
                    params={"license_key": license_key},
                    timeout=5
                )
                
                if response.status_code == 200:
                    data = response.json()
                    usage = data.get("usage", {})
                    
                    if usage != "unlimited":
                        used = usage.get("usage", 0)
                        limit = usage.get("limit", 50)
                        remaining = usage.get("remaining", 0)
                        
                        print(f"📊 Current usage: {used}/{limit} calls ({remaining} remaining)")
                        
                        if remaining < 10:
                            print("⚠️  You're running low on free calls!")
                        elif remaining == 0:
                            print("🚫 Daily limit reached - upgrade for unlimited access!")
            except:
                pass
    
    def deactivate(self):
        """Deactivate current license"""
        if not self.config.get('license_key'):
            print("❌ No license to deactivate")
            return False
        
        try:
            # Remove config file
            if self.config_file.exists():
                self.config_file.unlink()
            
            # Clear environment variable if set
            if 'FILEBRIDGE_LICENSE_KEY' in os.environ:
                print("💡 Note: FILEBRIDGE_LICENSE_KEY environment variable is still set")
            
            print("✅ License deactivated successfully")
            return True
            
        except Exception as e:
            print(f"❌ Error deactivating license: {e}")
            return False


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="FileBridge License Management CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  filebridge activate FILEBRIDGE-FREE-ABC12345    # Activate license
  filebridge status                                # Check license status
  filebridge upgrade                               # Show upgrade info
  filebridge deactivate                           # Remove license

Get your free license at: https://filebridge.dev/free
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Activate command
    activate_parser = subparsers.add_parser('activate', help='Activate a license key')
    activate_parser.add_argument('license_key', help='Your FileBridge license key')
    
    # Status command
    subparsers.add_parser('status', help='Show license and usage status')
    
    # Upgrade command
    subparsers.add_parser('upgrade', help='Show upgrade information')
    
    # Deactivate command
    subparsers.add_parser('deactivate', help='Remove current license')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    cli = FileBridgeCLI()
    
    try:
        if args.command == 'activate':
            success = cli.activate(args.license_key)
            sys.exit(0 if success else 1)
        
        elif args.command == 'status':
            success = cli.status()
            sys.exit(0 if success else 1)
        
        elif args.command == 'upgrade':
            cli.upgrade()
        
        elif args.command == 'deactivate':
            success = cli.deactivate()
            sys.exit(0 if success else 1)
    
    except KeyboardInterrupt:
        print("\n[CANCELLED] Operation cancelled")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
