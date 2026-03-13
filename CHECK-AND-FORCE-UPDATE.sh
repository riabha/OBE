#!/bin/bash

# 🔍 CHECK AND FORCE UPDATE - See what's actually happening on the server
# This script will show you exactly what's running and force updates

echo "🔍 CHECKING CURRENT SERVER STATE"
echo "================================"

echo "1. 📋 Current Git status..."
git status
echo ""
git log --oneline -5

echo ""
echo "2. 🐳 Current Docker containers..."
docker-compose ps

echo ""
echo "3. 🌐 Testing current application..."
echo "Main app (port 3200):"
curl -I http://194.60.87.212:3200 2>/dev/null | head -1 || echo "❌ Not responding"

echo "Pro admin dashboard:"
curl -I http://194.60.87.212:3200/pro-super-admin-dashboard.html 2>/dev/null | head -1 || echo "❌ Not responding"

echo ""
echo "4. 🔧 Testing database API..."
echo "Testing /api/databases endpoint:"
curl -s http://194.60.87.212:3200/api/databases | head -3 || echo "❌ API not responding"

echo ""
echo "5. 📊 Checking MongoDB directly..."
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
print('=== MONGODB STATUS ===');
try {
    var databases = db.adminCommand('listDatabases').databases;
    print('✅ MongoDB is working - Found ' + databases.length + ' databases:');
    databases.forEach(function(db) {
        print('  - ' + db.name + ' (' + (db.sizeOnDisk / 1024 / 1024).toFixed(2) + ' MB)');
    });
} catch (e) {
    print('❌ MongoDB error: ' + e);
}
"

echo ""
echo "6. 🔄 FORCING COMPLETE UPDATE..."
echo "Pulling latest changes..."
git pull origin main

echo ""
echo "Stopping all containers..."
docker-compose down

echo ""
echo "Rebuilding application container..."
docker-compose build --no-cache obe-app

echo ""
echo "Starting all services..."
docker-compose up -d

echo ""
echo "7. ⏳ Waiting for services to start..."
sleep 30

echo ""
echo "8. 🧪 Testing after update..."
echo "Main application:"
curl -I http://194.60.87.212:3200 2>/dev/null | head -1 || echo "❌ Still not responding"

echo ""
echo "Database API:"
curl -s http://194.60.87.212:3200/api/databases 2>/dev/null | head -5 || echo "❌ API still not working"

echo ""
echo "9. 📋 Final container status..."
docker-compose ps

echo ""
echo "10. 📄 Application logs (last 20 lines)..."
docker logs obe-portal --tail 20

echo ""
echo "✅ UPDATE COMPLETE!"
echo "=================="
echo ""
echo "🧪 NOW TEST THESE URLs:"
echo "======================"
echo "1. Main app: http://194.60.87.212:3200"
echo "2. Pro admin: http://194.60.87.212:3200/pro-super-admin-dashboard.html"
echo "3. Database section: http://194.60.87.212:3200/pro-super-admin-dashboard.html#databases"
echo ""
echo "🔍 IF STILL NOT WORKING:"
echo "======================="
echo "1. Check application logs: docker logs obe-portal"
echo "2. Check MongoDB logs: docker logs obe-mongodb"
echo "3. Check if containers are running: docker-compose ps"
echo "4. Try accessing MongoDB directly: docker exec -it obe-mongodb mongosh"