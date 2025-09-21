@echo off
REM setup_free_tier.bat
REM Complete setup script for FileBridge Free Tier on Windows

echo 🚀 Setting up FileBridge Free Tier...
echo ======================================

REM Step 1: Generate Prisma client with new schema
echo 📊 Step 1: Updating database schema...
call npm run db:generate

REM Step 2: Create and run migration
echo 🔄 Step 2: Running database migration...
call npm run db:migrate

REM Step 3: Install Python dependencies
echo 🐍 Step 3: Installing Python dependencies...
pip install requests >nul 2>&1

REM Step 4: Test the CLI tool
echo 🔧 Step 4: Testing FileBridge CLI...
python filebridge_cli.py status

echo.
echo ✅ Free Tier Setup Complete!
echo.
echo Next steps:
echo 1. Start your Next.js server: npm run dev
echo 2. Test free tier registration at: http://localhost:3000
echo 3. Activate a license: python filebridge_cli.py activate YOUR_LICENSE_KEY
echo 4. Check status: python filebridge_cli.py status
echo.
echo 🌐 Get your free license at: https://filebridge.dev/free

pause
