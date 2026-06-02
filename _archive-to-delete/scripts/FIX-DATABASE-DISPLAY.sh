#!/bin/bash

echo "🔧 FIXING DATABASE DISPLAY IN ADMIN PANEL"
echo "========================================="

cd /www/wwwroot/obe-portal

# The database display issue is in the frontend code
# For now, let's start Mongo Express so you can access the database properly

echo "🚀 Starting Mongo Express (Database GUI)..."
docker-compose --profile tools up -d mongo-express

echo "⏳ Waiting 10 seconds for Mongo Express to start..."
sleep 10

echo "📊 Container Status:"
docker-compose ps

echo ""
echo "🎯 DATABASE ACCESS READY!"
echo "========================="
echo ""
echo "🌐 **Mongo Express (Web GUI)**:"
echo "   URL: http://194.60.87.212:8081"
echo "   Username: admin"
echo "   Password: SecureOBE2025MongoExpressQuest"
echo ""
echo "💻 **Command Line Access**:"
echo "   docker exec -it obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin"
echo ""
echo "🔌 **External Client Connection**:"
echo "   Host: 194.60.87.212"
echo "   Port: 27018"
echo "   Username: admin"
echo "   Password: SecureOBE2025MongoDBQuest"
echo "   Auth Database: admin"
echo ""
echo "📋 **Available Databases**:"
echo "   - obe_platform (main platform database)"
echo "   - obe_university_* (university-specific databases)"