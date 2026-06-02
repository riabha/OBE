#!/bin/bash

echo "🔄 RESETTING MONGODB WITH NEW PASSWORD"
echo "======================================"

cd /www/wwwroot/obe-portal

# Stop everything
echo "🛑 Stopping containers..."
docker-compose down --volumes --remove-orphans

# Remove MongoDB volumes to reset password
echo "🗑️ Removing MongoDB data volumes..."
docker volume rm obe-portal_mongodb_data 2>/dev/null || true
docker volume rm obe-portal_mongodb_config 2>/dev/null || true

# Clean up any orphaned volumes
docker volume prune -f

# Start fresh
echo "🚀 Starting fresh containers..."
docker-compose up -d

# Wait for MongoDB to initialize
echo "⏳ Waiting 30 seconds for MongoDB initialization..."
sleep 30

# Check status
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "📋 MongoDB Logs:"
docker-compose logs --tail=10 mongodb

echo ""
echo "📋 Application Logs:"
docker-compose logs --tail=10 obe-app

echo ""
echo "🧪 Connection Test:"
curl -I http://localhost:3200 2>/dev/null && echo "✅ Success!" || echo "❌ Still failing"

echo ""
echo "🎯 MONGODB RESET COMPLETE!"
echo "MongoDB Password: SecureOBE2025MongoDBQuest"
echo "Try: http://194.60.87.212:3200"