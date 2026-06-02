#!/bin/bash

echo "🔧 FIXING MONGO EXPRESS ACCESS"
echo "=============================="

cd /www/wwwroot/obe-portal

echo "1. 📊 Checking current container status..."
docker-compose ps

echo ""
echo "2. 🔍 Checking Mongo Express logs..."
docker-compose logs --tail=20 mongo-express

echo ""
echo "3. 🌐 Checking if port 8081 is accessible..."
netstat -tlnp | grep :8081 || echo "❌ Port 8081 not listening"

echo ""
echo "4. 🔥 Checking firewall for port 8081..."
ufw status | grep 8081 || echo "⚠️ Port 8081 not in firewall rules"

echo ""
echo "5. 🔧 Opening firewall port 8081..."
ufw allow 8081/tcp

echo ""
echo "6. 🔄 Restarting Mongo Express..."
docker-compose restart mongo-express

echo ""
echo "7. ⏳ Waiting 15 seconds for restart..."
sleep 15

echo ""
echo "8. 📋 Mongo Express logs after restart..."
docker-compose logs --tail=10 mongo-express

echo ""
echo "9. 🧪 Testing local connection..."
curl -I http://localhost:8081 2>/dev/null && echo "✅ Local connection OK" || echo "❌ Local connection failed"

echo ""
echo "10. 📊 Final container status..."
docker-compose ps

echo ""
echo "🎯 MONGO EXPRESS FIX COMPLETE!"
echo "Try accessing: http://194.60.87.212:8081"
echo "Username: admin"
echo "Password: SecureOBE2025MongoExpressQuest"