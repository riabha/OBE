#!/bin/bash

# 🔄 Auto-Deployment Webhook - Quick Setup Script
# Run this script on your VPS to setup auto-deployment

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🔄 Setting Up Auto-Deployment Webhook                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Set variables
PROJECT_DIR="/www/wwwroot/obe"
WEBHOOK_PORT=9000
PM2_APP_NAME="obe-webhook"

# Navigate to project directory
echo "📁 Navigating to project directory..."
cd $PROJECT_DIR || exit 1

# Pull latest code (to get webhook files)
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Check if webhook files exist
if [ ! -f "deploy-webhook.js" ]; then
    echo "❌ Error: deploy-webhook.js not found!"
    echo "💡 Make sure you pushed the webhook files to GitHub first"
    exit 1
fi

# Open firewall port
echo "🔥 Opening firewall port $WEBHOOK_PORT..."
ufw allow $WEBHOOK_PORT
ufw reload

# Stop old webhook if exists
echo "🛑 Stopping old webhook (if exists)..."
pm2 delete $PM2_APP_NAME 2>/dev/null || true

# Start webhook server
echo "🚀 Starting webhook server..."
pm2 start deploy-webhook.js --name $PM2_APP_NAME

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Check status
echo ""
echo "📊 PM2 Status:"
pm2 status

# Test webhook
echo ""
echo "🧪 Testing webhook server..."
sleep 2
curl -s http://localhost:$WEBHOOK_PORT/webhook/health | python3 -m json.tool || curl -s http://localhost:$WEBHOOK_PORT/webhook/health

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ Webhook Setup Complete!                             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Webhook URL: http://194.60.87.212:$WEBHOOK_PORT/webhook/deploy"
echo ""
echo "📋 Next Steps:"
echo "   1. Go to: https://github.com/riabha/OBE/settings/hooks"
echo "   2. Click 'Add webhook'"
echo "   3. Payload URL: http://194.60.87.212:$WEBHOOK_PORT/webhook/deploy"
echo "   4. Content type: application/json"
echo "   5. Secret: (leave empty for now, or set in config.webhook.env)"
echo "   6. Events: Just the push event"
echo "   7. Click 'Add webhook'"
echo ""
echo "🔍 Monitor deployments: pm2 logs $PM2_APP_NAME"
echo ""

