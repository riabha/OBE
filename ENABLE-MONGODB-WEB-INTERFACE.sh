#!/bin/bash

# 🌐 ENABLE MONGODB WEB INTERFACE - Access MongoDB through web browser
# This enables Mongo Express for visual database management

echo "🌐 ENABLING MONGODB WEB INTERFACE"
echo "================================="

echo "1. 🔍 Checking current container status..."
docker-compose ps

echo ""
echo "2. 🚀 Starting Mongo Express (MongoDB Web Interface)..."

# Start Mongo Express with the tools profile
docker-compose --profile tools up -d mongo-express

echo ""
echo "3. ⏳ Waiting for Mongo Express to start..."
sleep 10

echo ""
echo "4. 🧪 Testing Mongo Express availability..."

# Check if Mongo Express is responding
if curl -I http://194.60.87.212:8081 2>/dev/null | head -1 | grep -q "200\|401"; then
    echo "✅ Mongo Express is running and accessible"
else
    echo "⚠️ Mongo Express may still be starting..."
fi

echo ""
echo "5. 📋 Container status after starting Mongo Express..."
docker-compose ps

echo ""
echo "6. 🔐 Getting MongoDB credentials..."

# Show the credentials needed
echo "MongoDB Web Interface Credentials:"
echo "=================================="
echo "URL: http://194.60.87.212:8081"
echo "Username: admin"
echo "Password: (from your .env file - MONGO_EXPRESS_PASSWORD)"
echo ""
echo "If you don't know the password, check your .env file:"
cat .env | grep MONGO_EXPRESS_PASSWORD || echo "MONGO_EXPRESS_PASSWORD not found in .env"

echo ""
echo "MongoDB Database Credentials (for reference):"
echo "============================================="
echo "Host: mongodb (container name) or 194.60.87.212:27018 (external)"
echo "Port: 27017 (internal) or 27018 (external)"
echo "Username: admin"
echo "Password: SecureOBE2025MongoDBQuest"
echo "Auth Database: admin"

echo ""
echo "✅ MONGODB WEB INTERFACE SETUP COMPLETE!"
echo "========================================"
echo ""
echo "🌐 ACCESS MONGODB WEB INTERFACE:"
echo "==============================="
echo "1. Open browser and go to: http://194.60.87.212:8081"
echo "2. Login with username: admin"
echo "3. Use password from your .env file (MONGO_EXPRESS_PASSWORD)"
echo ""
echo "🗂️ WHAT YOU CAN DO IN THE WEB INTERFACE:"
echo "========================================"
echo "• Browse all databases (obe_platform, obe_demo, etc.)"
echo "• View collections and documents"
echo "• Create/edit/delete databases"
echo "• Manage users and permissions"
echo "• Execute MongoDB queries"
echo "• Import/export data"
echo "• View database statistics"
echo ""
echo "📁 KEY DATABASES TO CHECK:"
echo "========================="
echo "• obe_platform - Contains universities and platform users"
echo "• obe_demo - Contains university-specific data"
echo "• admin - MongoDB system database"
echo ""
echo "🔧 IF WEB INTERFACE DOESN'T WORK:"
echo "================================"
echo "1. Check if container is running: docker-compose ps"
echo "2. Check logs: docker logs obe-mongo-express"
echo "3. Restart if needed: docker-compose restart mongo-express"