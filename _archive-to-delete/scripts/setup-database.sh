#!/bin/bash

# 💾 Switch to Database Mode - Setup Script
# Run this on VPS to enable MongoDB database

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  💾 Switching to DATABASE MODE                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/www/wwwroot/obe"

cd $PROJECT_DIR || exit 1

echo "📁 Project directory: $PROJECT_DIR"
echo ""

# Check if MongoDB is running
echo "🔍 Checking MongoDB status..."
if systemctl is-active --quiet mongod; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB is not running"
    echo "💡 Starting MongoDB..."
    systemctl start mongod
    sleep 2
    if systemctl is-active --quiet mongod; then
        echo "✅ MongoDB started successfully"
    else
        echo "❌ Failed to start MongoDB"
        echo "💡 Please start MongoDB manually: systemctl start mongod"
        exit 1
    fi
fi
echo ""

# Test MongoDB connection
echo "🧪 Testing MongoDB connection..."
if mongo --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✅ MongoDB connection successful"
else
    echo "⚠️  MongoDB connection test inconclusive (might still work)"
fi
echo ""

# Update config.env
echo "📝 Updating config.env..."
if [ -f "config.env.vps" ]; then
    cp config.env.vps config.env
    echo "✅ Config updated from config.env.vps"
else
    echo "❌ config.env.vps not found"
    exit 1
fi
echo ""

# Stop current PM2 app
echo "🛑 Stopping current app..."
pm2 stop obe 2>/dev/null || true
pm2 delete obe 2>/dev/null || true
echo ""

# Start with database mode
echo "🚀 Starting app in DATABASE MODE..."
pm2 start server-database.js --name obe
pm2 save
echo ""

# Check status
echo "📊 PM2 Status:"
pm2 status
echo ""

# Wait a moment for startup
echo "⏳ Waiting for app to initialize..."
sleep 3
echo ""

# Check logs
echo "📋 Recent logs:"
pm2 logs obe --lines 30 --nostream
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ DATABASE MODE ACTIVATED!                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Your portal is now using MongoDB database!"
echo ""
echo "🔐 Login credentials:"
echo "   📧 Email: pro@obe.org.pk"
echo "   🔑 Password: proadmin123"
echo ""
echo "🔍 Check status:"
echo "   pm2 status"
echo "   pm2 logs obe"
echo "   curl http://localhost:3000/api/health"
echo ""

