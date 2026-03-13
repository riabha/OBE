#!/bin/bash

# 🔧 FIX MONGODB SETTINGS - Direct fix for the settings page
# This fixes the MongoDB connection test and database management

echo "🔧 FIXING MONGODB SETTINGS PAGE"
echo "==============================="

echo "1. 🔄 Restarting application to apply server.js changes..."
docker-compose restart

echo ""
echo "2. ⏳ Waiting for application to start..."
sleep 15

echo ""
echo "3. 🧪 Testing MongoDB connection directly..."

# Test MongoDB connection from inside the container
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
print('=== MONGODB CONNECTION TEST ===');

try {
    var result = db.adminCommand('ping');
    print('✅ MongoDB ping: SUCCESS');
    
    var databases = db.adminCommand('listDatabases').databases;
    print('✅ Available databases: ' + databases.length);
    databases.forEach(function(db) {
        print('   - ' + db.name + ' (' + (db.sizeOnDisk / 1024 / 1024).toFixed(2) + ' MB)');
    });
    
    use obe_platform;
    var universities = db.universities.countDocuments();
    print('✅ Platform database access: SUCCESS (' + universities + ' universities)');
    
} catch (e) {
    print('❌ MongoDB test failed: ' + e);
}
"

echo ""
echo "4. 🌐 Testing application response..."

# Test if application is responding
if curl -I http://194.60.87.212:3200 2>/dev/null | head -1 | grep -q "200\|302"; then
    echo "✅ Application is responding"
else
    echo "⚠️ Application may still be starting"
fi

echo ""
echo "5. 🔧 Testing MongoDB settings API..."

# Test the MongoDB settings API
curl -s -X GET "http://194.60.87.212:3200/api/mongodb-settings" \
  -H "Authorization: Bearer $(echo 'test')" \
  -H "Content-Type: application/json" | head -5

echo ""
echo ""
echo "✅ MONGODB SETTINGS FIX COMPLETE!"
echo "================================="
echo ""
echo "🧪 NOW TEST THE SETTINGS PAGE:"
echo "=============================="
echo "1. Go to: http://194.60.87.212:3200/pro-super-admin-dashboard.html#settings"
echo "2. Scroll down to 'MongoDB Connection Settings'"
echo "3. Click 'Test Connection' - should now work"
echo "4. Should show:"
echo "   - Host: mongodb"
echo "   - Port: 27017"
echo "   - Username: admin"
echo "   - Database: obe_platform"
echo "   - Status: Connected"
echo ""
echo "🔧 WHAT WAS FIXED:"
echo "=================="
echo "• Fixed default host from 'localhost' to 'mongodb' (Docker container name)"
echo "• Added proper credentials in MongoDB settings API"
echo "• Enhanced connection test with better error messages"
echo "• Added database listing functionality"
echo "• Improved connection timeout and retry logic"
echo ""
echo "If connection still fails, check Docker containers:"
echo "docker-compose ps"