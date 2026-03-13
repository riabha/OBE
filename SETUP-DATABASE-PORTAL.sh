#!/bin/bash

echo "🗄️ SETTING UP DATABASE MONITORING PORTAL"
echo "========================================"

cd /www/wwwroot/obe-portal

echo "1. 🛑 Stopping current containers..."
docker-compose down

echo ""
echo "2. 📝 Updating .env with Mongo Express settings..."
# Ensure all Mongo Express variables are set
cat >> .env << 'EOF'

# Mongo Express Configuration
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=SecureOBE2025MongoExpressQuest
EOF

echo ""
echo "3. 🔥 Opening firewall port 8081..."
ufw allow 8081/tcp

echo ""
echo "4. 🚀 Starting all containers including Mongo Express..."
docker-compose --profile tools up -d

echo ""
echo "5. ⏳ Waiting 20 seconds for all services to start..."
sleep 20

echo ""
echo "6. 📊 Container Status:"
docker-compose ps

echo ""
echo "7. 🔍 Mongo Express Logs:"
docker-compose logs --tail=15 mongo-express

echo ""
echo "8. 🌐 Network Port Check:"
netstat -tlnp | grep -E "(3200|8081|27018)"

echo ""
echo "9. 🧪 Testing Connections:"
echo "   Testing Application (port 3200)..."
curl -I http://localhost:3200 2>/dev/null && echo "   ✅ Application OK" || echo "   ❌ Application failed"

echo "   Testing Mongo Express (port 8081)..."
curl -I http://localhost:8081 2>/dev/null && echo "   ✅ Mongo Express OK" || echo "   ❌ Mongo Express failed"

echo ""
echo "🎯 DATABASE PORTAL SETUP COMPLETE!"
echo "=================================="
echo ""
echo "🌐 **Application Portal**:"
echo "   URL: http://194.60.87.212:3200"
echo "   Login: pro@obe.org.pk / proadmin123"
echo ""
echo "🗄️ **Database Monitoring Portal**:"
echo "   URL: http://194.60.87.212:8081"
echo "   Username: admin"
echo "   Password: SecureOBE2025MongoExpressQuest"
echo ""
echo "💻 **Direct MongoDB Access**:"
echo "   Host: 194.60.87.212:27018"
echo "   Username: admin"
echo "   Password: SecureOBE2025MongoDBQuest"
echo "   Auth Database: admin"
echo ""
echo "📋 **Available Databases to Monitor**:"
echo "   - obe_platform (main platform)"
echo "   - obe_university_* (university databases)"