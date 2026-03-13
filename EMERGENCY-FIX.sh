#!/bin/bash

# 🚀 EMERGENCY FIX: MongoDB Connection Issue
# This script fixes the "getaddrinfo ENOTFOUND quest" error

echo "🔧 EMERGENCY FIX: MongoDB Connection Issue"
echo "=========================================="

# Navigate to project directory
cd /www/wwwroot/obe-portal || { echo "❌ Directory not found"; exit 1; }

echo "📍 Current directory: $(pwd)"

# Stop containers
echo "🛑 Stopping containers..."
docker-compose down

# Create .env file with correct settings
echo "📝 Creating .env file..."
cat > .env << 'EOF'
# QUEST OBE Portal - Docker Environment Configuration
APP_PORT=3200
NODE_ENV=production
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=SecureOBE2025!MongoDB@Quest
MONGODB_URI=mongodb://admin:SecureOBE2025!MongoDB@Quest@mongodb:27017/obe_platform?authSource=admin
JWT_SECRET=OBE2025SecureJWTSecretForQuestUniversityPortal123456789
SESSION_SECRET=QuestOBESessionSecret2025SecureRandomString987654321
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=SecureOBE2025!MongoExpress@Quest
EOF

echo "✅ .env file created"

# Start containers
echo "🚀 Starting containers..."
docker-compose up -d

# Wait for containers to start
echo "⏳ Waiting for containers to start..."
sleep 10

# Check status
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "📋 Application Logs (last 10 lines):"
docker-compose logs --tail=10 obe-app

echo ""
echo "🎉 FIX COMPLETE!"
echo "==============="
echo "🌐 Application URL: http://YOUR_VPS_IP:3200"
echo "📧 Login: pro@obe.org.pk"
echo "🔑 Password: proadmin123"
echo ""
echo "📊 Monitor logs: docker-compose logs -f obe-app"
echo "🔍 Check status: docker-compose ps"