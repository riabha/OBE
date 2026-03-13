#!/bin/bash

# 🔗 INTEGRATE WEB DATABASE MANAGER - Connect app settings with web interface
# This integrates the MongoDB web interface with your application settings

echo "🔗 INTEGRATING WEB DATABASE MANAGER"
echo "==================================="

echo "1. 🌐 Enabling MongoDB web interface..."
docker-compose --profile tools up -d mongo-express

echo ""
echo "2. 🔄 Restarting main application..."
docker-compose restart obe-app

echo ""
echo "3. ⏳ Waiting for services to start..."
sleep 15

echo ""
echo "4. 🧪 Testing all services..."

echo "Testing main application..."
if curl -I http://194.60.87.212:3200 2>/dev/null | head -1 | grep -q "200\|302"; then
    echo "✅ Main application: RUNNING"
else
    echo "⚠️ Main application: STARTING"
fi

echo "Testing MongoDB web interface..."
if curl -I http://194.60.87.212:8081 2>/dev/null | head -1 | grep -q "200\|401"; then
    echo "✅ MongoDB web interface: RUNNING"
else
    echo "⚠️ MongoDB web interface: STARTING"
fi

echo ""
echo "5. 📊 Checking database structure..."

# Check database structure through MongoDB
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
print('=== DATABASE STRUCTURE CHECK ===');

var databases = db.adminCommand('listDatabases').databases;
print('Available databases: ' + databases.length);
databases.forEach(function(database) {
    print('📁 ' + database.name + ' (' + (database.sizeOnDisk / 1024 / 1024).toFixed(2) + ' MB)');
});

print('');
print('=== PLATFORM DATABASE CONTENT ===');
use obe_platform;
var collections = db.getCollectionNames();
collections.forEach(function(collection) {
    var count = db.getCollection(collection).countDocuments();
    print('📄 ' + collection + ': ' + count + ' documents');
});

print('');
print('=== UNIVERSITIES ===');
var universities = db.universities.find().toArray();
if (universities.length > 0) {
    universities.forEach(function(uni) {
        print('🏛️ ' + uni.universityName + ' (' + uni.universityCode + ')');
        print('   Database: ' + uni.databaseName);
        print('   Status: ' + (uni.isActive ? 'Active' : 'Inactive'));
    });
} else {
    print('❌ No universities found');
}
"

echo ""
echo "6. 🔐 Setting up database access credentials..."

# Create a comprehensive credentials file
cat > database-access-info.txt << EOF
=== MONGODB ACCESS INFORMATION ===

🌐 WEB INTERFACE ACCESS:
URL: http://194.60.87.212:8081
Username: admin
Password: Check .env file (MONGO_EXPRESS_PASSWORD)

🔧 DIRECT DATABASE ACCESS:
Host: 194.60.87.212
Port: 27018 (external) or 27017 (internal)
Username: admin
Password: SecureOBE2025MongoDBQuest
Auth Database: admin

📱 APPLICATION SETTINGS:
Host: mongodb (for Docker internal)
Port: 27017
Database: obe_platform
Username: admin
Password: SecureOBE2025MongoDBQuest
Auth Source: admin

🗂️ KEY DATABASES:
- obe_platform: Universities, platform users, system settings
- obe_demo: Demo university data (users, courses, etc.)
- admin: MongoDB system database

🔗 CONNECTION STRINGS:
Internal (Docker): mongodb://admin:SecureOBE2025MongoDBQuest@mongodb:27017/obe_platform?authSource=admin
External: mongodb://admin:SecureOBE2025MongoDBQuest@194.60.87.212:27018/obe_platform?authSource=admin
EOF

echo "✅ Database access information saved to: database-access-info.txt"

echo ""
echo "✅ WEB DATABASE MANAGER INTEGRATION COMPLETE!"
echo "============================================="
echo ""
echo "🌐 ACCESS OPTIONS:"
echo "=================="
echo "1. 📱 Application Settings: http://194.60.87.212:3200/pro-super-admin-dashboard.html#settings"
echo "2. 🌐 Web Database Manager: http://194.60.87.212:8081"
echo "3. 🔧 Direct MongoDB Access: 194.60.87.212:27018"
echo ""
echo "🎯 RECOMMENDED WORKFLOW:"
echo "======================="
echo "1. Use WEB INTERFACE (port 8081) for:"
echo "   • Visual database browsing"
echo "   • Creating/managing databases"
echo "   • Viewing data structure"
echo "   • Importing/exporting data"
echo ""
echo "2. Use APPLICATION SETTINGS (port 3200) for:"
echo "   • Testing connections"
echo "   • Assigning databases to universities"
echo "   • Managing platform settings"
echo ""
echo "🔍 TROUBLESHOOTING:"
echo "=================="
echo "• If web interface shows login page: Use admin + password from .env"
echo "• If connection fails: Check docker-compose ps"
echo "• If databases empty: Run database population scripts"
echo ""
echo "📄 All access details saved in: database-access-info.txt"