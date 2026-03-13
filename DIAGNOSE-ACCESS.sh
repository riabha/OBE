#!/bin/bash

echo "🔍 DIAGNOSING ACCESS ISSUE"
echo "=========================="

cd /www/wwwroot/obe-portal

echo "1. 📊 Container Status:"
docker-compose ps

echo ""
echo "2. 🔌 Port Bindings:"
docker port obe-portal 2>/dev/null || echo "❌ obe-portal container not found"

echo ""
echo "3. 🌐 Network Listening Ports:"
netstat -tlnp | grep :3200 || echo "❌ Port 3200 not listening"

echo ""
echo "4. 📋 Application Logs (last 20 lines):"
docker-compose logs --tail=20 obe-app

echo ""
echo "5. 🔥 Firewall Status:"
ufw status || iptables -L INPUT | grep 3200 || echo "⚠️ Firewall check failed"

echo ""
echo "6. 🧪 Local Connection Test:"
curl -I http://localhost:3200 2>/dev/null || echo "❌ Local connection failed"

echo ""
echo "7. 📁 Environment File:"
cat .env | grep APP_PORT || echo "❌ APP_PORT not found in .env"

echo ""
echo "8. 🐳 Docker Compose Config:"
docker-compose config | grep -A5 -B5 "3200" || echo "❌ Port 3200 not in config"