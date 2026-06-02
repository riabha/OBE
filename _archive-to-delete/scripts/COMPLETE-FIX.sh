#!/bin/bash

# 🚀 COMPLETE FIX: All Commands in One Script
# Run this on your VPS to fix the MongoDB connection issue

echo "🔧 QUEST OBE Portal - Complete Fix"
echo "=================================="

# Navigate to project directory
cd /www/wwwroot/obe-portal

# Stop any running containers
echo "🛑 Stopping containers..."
docker-compose down

# Create .env file with correct MongoDB connection
echo "📝 Creating .env file with correct settings..."
cat > .env << 'EOF'
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

# Start containers
echo "🚀 Starting containers..."
docker-compose up -d

# Wait for startup
echo "⏳ Waiting 15 seconds for containers to initialize..."
sleep 15

# Show status
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "📋 Recent Application Logs:"
docker-compose logs --tail=15 obe-app

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
echo "🌐 Application: http://YOUR_VPS_IP:3200"
echo "📧 Login: pro@obe.org.pk"
echo "🔑 Password: proadmin123"
echo ""
echo "🔍 Monitor: docker-compose logs -f obe-app"
echo "📊 Status: docker-compose ps"
echo "🔄 Restart: docker-compose restart obe-app"