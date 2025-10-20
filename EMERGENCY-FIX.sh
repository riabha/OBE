#!/bin/bash

# 🚑 EMERGENCY FIX - Restore Working State
# Run this on VPS to fix login and all issues

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🚑 EMERGENCY FIX - Restoring Working State            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd /www/wwwroot/obe || exit 1

echo "1️⃣ Pulling latest code..."
git pull origin main
echo ""

echo "2️⃣ Stopping current app..."
pm2 stop obe
pm2 delete obe
echo ""

echo "3️⃣ Updating config..."
cat > config.env << 'EOF'
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://127.0.0.1:27017/obe_platform
JWT_SECRET=quest_obe_jwt_secret_key_2024_very_secure_random_string
JWT_EXPIRE=7d
SESSION_SECRET=quest_obe_session_secret_key_2024_another_random_string
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./public/uploads
BCRYPT_ROUNDS=12
EOF
echo "✅ Config updated"
echo ""

echo "4️⃣ Starting with CLEAN server..."
pm2 start server-clean.js --name obe
pm2 save
echo ""

echo "5️⃣ Checking status..."
sleep 3
pm2 status
echo ""

echo "6️⃣ Testing login..."
sleep 2
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@obe.org.pk","password":"proadmin123"}' \
  | python3 -m json.tool 2>/dev/null || curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@obe.org.pk","password":"proadmin123"}'
echo ""
echo ""

echo "7️⃣ Testing health..."
curl -s http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/api/health
echo ""
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ FIX COMPLETE!                                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Your website: http://obe.org.pk"
echo "🔐 Login: pro@obe.org.pk / proadmin123"
echo ""
echo "📊 Check status: pm2 status"
echo "📋 View logs: pm2 logs obe"
echo ""

