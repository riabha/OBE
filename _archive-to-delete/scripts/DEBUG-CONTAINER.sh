#!/bin/bash

echo "🔍 DEBUGGING CONTAINER ENVIRONMENT"
echo "=================================="

cd /www/wwwroot/obe-portal

echo "1. 📋 Container Environment Variables:"
docker exec obe-portal env | grep -E "(MONGODB|NODE_ENV|PORT)" | sort

echo ""
echo "2. 📁 Config files in container:"
docker exec obe-portal ls -la | grep -E "(config|env)"

echo ""
echo "3. 📝 Config.env content in container:"
docker exec obe-portal cat config.env | grep MONGODB_URI

echo ""
echo "4. 📝 .env content in container (if exists):"
docker exec obe-portal cat .env 2>/dev/null | grep MONGODB_URI || echo "No .env file in container"

echo ""
echo "5. 🌐 Network connectivity test:"
docker exec obe-portal ping -c 2 mongodb 2>/dev/null || echo "❌ Cannot ping mongodb"

echo ""
echo "6. 🔌 Port connectivity test:"
docker exec obe-portal nc -zv mongodb 27017 2>/dev/null || echo "❌ Cannot connect to mongodb:27017"

echo ""
echo "7. 📊 Docker Compose environment:"
docker-compose config | grep -A5 -B5 MONGODB_URI

echo ""
echo "8. 🐳 Container process list:"
docker exec obe-portal ps aux | grep node

echo ""
echo "9. 📋 Application startup command:"
docker exec obe-portal cat package.json | grep -A5 -B5 scripts || echo "No package.json scripts found"