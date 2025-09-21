#!/bin/bash
# setup_free_tier.sh
# Complete setup script for FileBridge Free Tier

echo "🚀 Setting up FileBridge Free Tier..."
echo "======================================"

# Step 1: Generate Prisma client with new schema
echo "📊 Step 1: Updating database schema..."
npm run db:generate

# Step 2: Create and run migration
echo "🔄 Step 2: Running database migration..."
npm run db:migrate

# Step 3: Test the new API endpoints
echo "🧪 Step 3: Testing API endpoints..."

# Test free tier registration
echo "Testing free tier registration..."
curl -X POST http://localhost:3000/api/auth/register-free \
  -H "Content-Type: application/json" \
  -d '{"email": "test@filebridge.dev"}' \
  2>/dev/null | head -c 200

echo -e "\n"

# Test usage checking (this will fail until a license exists)
echo "Testing usage checking..."
curl -X GET "http://localhost:3000/api/usage/check?license_key=FILEBRIDGE-FREE-TEST1234" \
  2>/dev/null | head -c 200

echo -e "\n"

# Step 4: Install Python dependencies
echo "🐍 Step 4: Installing Python dependencies..."
pip install requests > /dev/null 2>&1

# Step 5: Test the CLI tool
echo "🔧 Step 5: Testing FileBridge CLI..."
python filebridge_cli.py status

echo ""
echo "✅ Free Tier Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Start your Next.js server: npm run dev"
echo "2. Test free tier registration at: http://localhost:3000"
echo "3. Activate a license: python filebridge_cli.py activate YOUR_LICENSE_KEY"
echo "4. Check status: python filebridge_cli.py status"
echo ""
echo "🌐 Get your free license at: https://filebridge.dev/free"
