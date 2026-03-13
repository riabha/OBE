#!/bin/bash

echo "🚀 QUICK ACCESS FIX"
echo "==================="

cd /www/wwwroot/obe-portal

# Stop containers
echo "🛑 Stopping containers..."
docker-compose down

# Check if .env exists and has correct port
echo "📝 Checking .env file..."
if [ ! -f .env ]; then
    echo "❌ .env file missing! Creating it..."
    cat > .env << 'EOF'
APP_PORT=3200
NODE_ENV=production
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=SecureOBE2025!MongoDB@Quest
MONGODB_URI=mongodb://admin:SecureOBE2025!MongoDB@Quest@mongodb:27017/obe_platform?authSource=admin
JWT_SECRET=OBE2025SecureJWTSecretForQuestUniversityPortal123456789
SESSION_SECRET=QuestOBESessionSecret2025SecureRandomString987654321
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=SecureOBE2025!MongoExpress@Quest
EOF
fi

# Show current port configuration
echo "🔍 Current port configuration:"
grep APP_PORT .env || echo "❌ APP_PORT not found"

# Update docker-compose.yml to ensure correct port mapping
echo "📝 Updating docker-compose.yml port mapping..."
sed -i 's/- ".*:3000"/- "3200:3000"/' docker-compose.yml

# Open firewall port
echo "🔥 Opening firewall port 3200..."
ufw allow 3200/tcp 2>/dev/null || echo "⚠️ UFW not available, trying iptables..."
iptables -I INPUT -p tcp --dport 3200 -j ACCEPT 2>/dev/null || echo "⚠️ Firewall configuration may need manual setup"

# Start containers
echo "🚀 Starting containers..."
docker-compose up -d

# Wait for startup
echo "⏳ Waiting 20 seconds for startup..."
sleep 20

# Show status
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "🔌 Port Check:"
netstat -tlnp | grep :3200 || echo "❌ Port 3200 not listening"

echo ""
echo "🧪 Connection Test:"
curl -I http://localhost:3200 2>/dev/null && echo "✅ Local connection OK" || echo "❌ Local connection failed"

echo ""
echo "📋 Application Logs:"
docker-compose logs --tail=10 obe-app

echo ""
echo "🎉 ACCESS FIX COMPLETE!"
echo "======================"
echo "🌐 Try: http://194.60.87.212:3200"
echo "📧 Login: pro@obe.org.pk"
echo "🔑 Password: proadmin123"