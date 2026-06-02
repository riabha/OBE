#!/bin/bash

echo "🔄 REBUILDING CONTAINER - Complete Reset"
echo "========================================"

cd /www/wwwroot/obe-portal

# Stop and remove all containers
echo "🛑 Stopping and removing containers..."
docker-compose down --volumes --remove-orphans

# Remove all images to force rebuild
echo "🗑️ Removing Docker images..."
docker rmi obe-portal-obe-app 2>/dev/null || echo "Image not found"
docker rmi $(docker images -q --filter "dangling=true") 2>/dev/null || echo "No dangling images"

# Clean Docker cache
echo "🧹 Cleaning Docker cache..."
docker system prune -f

# Show current config.env
echo "📋 Current config.env:"
cat config.env | grep MONGODB_URI

# Rebuild and start
echo "🔨 Rebuilding containers..."
docker-compose build --no-cache

echo "🚀 Starting containers..."
docker-compose up -d

# Wait for startup
echo "⏳ Waiting 20 seconds for startup..."
sleep 20

# Check status
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "📋 Application Logs:"
docker-compose logs --tail=15 obe-app

echo ""
echo "🧪 Connection Test:"
curl -I http://localhost:3200 2>/dev/null && echo "✅ Connection OK" || echo "❌ Connection failed"

echo ""
echo "🎯 REBUILD COMPLETE!"
echo "Try: http://194.60.87.212:3200"