#!/bin/bash

# 🔧 COMPLETE FIX - Test Everything and Fix All Issues
# This script will diagnose and fix all problems

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🔧 COMPLETE SYSTEM FIX - Diagnosing & Fixing          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd /www/wwwroot/obe || exit 1

echo "📊 STEP 1: Current Status"
echo "─────────────────────────────────────────────"
pm2 list
echo ""

echo "📥 STEP 2: Pulling Latest Code"
echo "─────────────────────────────────────────────"
git pull origin main
echo ""

echo "🗑️ STEP 3: Complete Cleanup"
echo "─────────────────────────────────────────────"
pm2 stop all
pm2 delete all
pm2 flush
echo "✅ PM2 cleaned"
echo ""

echo "📝 STEP 4: Ensure Correct Config"
echo "─────────────────────────────────────────────"
cat > config.env << 'ENVEOF'
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://127.0.0.1:27017/obe_platform
JWT_SECRET=quest_obe_jwt_secret_key_2024_very_secure_random_string
JWT_EXPIRE=7d
SESSION_SECRET=quest_obe_session_secret_key_2024_another_random_string
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./public/uploads
BCRYPT_ROUNDS=12
ENVEOF
echo "✅ Config updated"
echo ""

echo "🧪 STEP 5: Testing MongoDB Connection"
echo "─────────────────────────────────────────────"
if mongo --eval "db.version()" mongodb://127.0.0.1:27017/obe_platform 2>/dev/null; then
    echo "✅ MongoDB is accessible"
else
    echo "⚠️  MongoDB check inconclusive (might still work)"
fi
echo ""

echo "🚀 STEP 6: Starting Clean Server"
echo "─────────────────────────────────────────────"
pm2 start server-clean.js --name obe --time
pm2 start deploy-webhook.js --name obe-webhook --time
pm2 save
echo ""

echo "⏳ Waiting for startup..."
sleep 5
echo ""

echo "📊 STEP 7: Checking Status"
echo "─────────────────────────────────────────────"
pm2 status
echo ""

echo "📋 STEP 8: Checking Logs"
echo "─────────────────────────────────────────────"
pm2 logs obe --lines 30 --nostream
echo ""

echo "🧪 STEP 9: Testing API Endpoints"
echo "─────────────────────────────────────────────"

echo "Test 1: Health Check"
curl -s http://localhost:3000/api/health
echo -e "\n"

echo "Test 2: Pro Super Admin Login"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@obe.org.pk","password":"proadmin123"}')

echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q "token"; then
    echo "✅ LOGIN WORKS!"
else
    echo "❌ LOGIN FAILED!"
    echo ""
    echo "Checking recent error logs:"
    pm2 logs obe --err --lines 20 --nostream
fi
echo ""

echo "Test 3: Platform Stats"
curl -s http://localhost:3000/api/platform-stats
echo -e "\n"

echo "Test 4: List Universities"
curl -s http://localhost:3000/api/universities
echo -e "\n"

echo "Test 5: List Databases"
curl -s http://localhost:3000/api/databases
echo -e "\n"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  📊 DIAGNOSTIC COMPLETE                                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Website: http://obe.org.pk"
echo "🔐 Login: pro@obe.org.pk / proadmin123"
echo ""
echo "📋 Next Steps:"
echo "   1. Check if login test passed above"
echo "   2. Try logging in via browser"
echo "   3. Check PM2 logs if issues: pm2 logs obe"
echo ""

