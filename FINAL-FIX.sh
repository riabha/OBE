#!/bin/bash

echo "🔧 FINAL FIX: URL Encoding Issue"
echo "================================"

cd /www/wwwroot/obe-portal

# Stop containers
docker-compose down

# The issue might be the password contains @ symbol which breaks URL parsing
# Let's use a simpler password without special characters that could break URL parsing

echo "📝 Creating new config.env with URL-safe password..."
cat > config.env << 'EOF'
# QUEST OBE Portal Environment Configuration

# Server Configuration
PORT=3000
NODE_ENV=production

# MongoDB Configuration
# 🔹 FOR DOCKER DEPLOYMENT - Use Docker service name with URL-safe password
MONGODB_URI=mongodb://admin:SecureOBE2025MongoDBQuest@mongodb:27017/obe_platform?authSource=admin

# 🔹 FOR LOCALHOST TESTING - Connect to VPS MongoDB remotely
# MONGODB_URI=mongodb://root:5PhYxwmq%40@194.60.87.212:27017/obe_platform?authSource=admin

# 🔹 ALTERNATIVE: Use local MongoDB (if installed on your PC)
# MONGODB_URI=mongodb://localhost:27017/obe_platform

# JWT Configuration
JWT_SECRET=quest_obe_jwt_secret_key_2024_very_secure_random_string
JWT_EXPIRE=7d

# Session Configuration
SESSION_SECRET=quest_obe_session_secret_key_2024_another_random_string

# Email Configuration (for future implementation)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@quest.edu.pk
EMAIL_PASS=your-email-password

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./public/uploads

# Security Configuration
BCRYPT_ROUNDS=12
EOF

# Also update .env to match
echo "📝 Creating matching .env file..."
cat > .env << 'EOF'
# QUEST OBE Portal - Docker Environment Configuration
APP_PORT=3200
NODE_ENV=production
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=SecureOBE2025MongoDBQuest
MONGODB_URI=mongodb://admin:SecureOBE2025MongoDBQuest@mongodb:27017/obe_platform?authSource=admin
JWT_SECRET=OBE2025SecureJWTSecretForQuestUniversityPortal123456789
SESSION_SECRET=QuestOBESessionSecret2025SecureRandomString987654321
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=SecureOBE2025MongoExpressQuest
EOF

echo "🔨 Rebuilding with new password..."
docker-compose build --no-cache
docker-compose up -d

echo "⏳ Waiting 20 seconds..."
sleep 20

echo "📊 Container Status:"
docker-compose ps

echo ""
echo "📋 Application Logs:"
docker-compose logs --tail=15 obe-app

echo ""
echo "🧪 Connection Test:"
curl -I http://localhost:3200 2>/dev/null && echo "✅ Success!" || echo "❌ Still failing"

echo ""
echo "🎯 FINAL FIX COMPLETE!"
echo "New MongoDB Password: SecureOBE2025MongoDBQuest"
echo "Try: http://194.60.87.212:3200"