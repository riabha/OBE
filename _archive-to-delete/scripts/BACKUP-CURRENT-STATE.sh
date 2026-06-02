#!/bin/bash

# 💾 BACKUP CURRENT STATE - Save everything before closing
# This creates a complete backup of your current setup

echo "💾 BACKING UP CURRENT STATE"
echo "==========================="

# Create backup directory with timestamp
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

echo "1. 📁 Backing up configuration files..."
cp config.env $BACKUP_DIR/ 2>/dev/null || echo "config.env not found"
cp docker-compose.yml $BACKUP_DIR/
cp .env $BACKUP_DIR/ 2>/dev/null || echo ".env not found"
cp Dockerfile $BACKUP_DIR/
cp server.js $BACKUP_DIR/

echo "2. 📋 Saving current container status..."
docker-compose ps > $BACKUP_DIR/container-status.txt
docker images > $BACKUP_DIR/docker-images.txt

echo "3. 📊 Backing up database structure..."
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
print('=== DATABASE BACKUP INFO ===');
var databases = db.adminCommand('listDatabases').databases;
print('Total databases: ' + databases.length);
databases.forEach(function(database) {
    print('Database: ' + database.name + ' (' + (database.sizeOnDisk / 1024 / 1024).toFixed(2) + ' MB)');
});

use obe_platform;
print('=== PLATFORM DATABASE ===');
print('Universities: ' + db.universities.countDocuments());
print('Platform Users: ' + db.platformusers.countDocuments());

var universities = db.universities.find().toArray();
universities.forEach(function(uni) {
    print('University: ' + uni.universityName + ' (' + uni.universityCode + ') -> ' + uni.databaseName);
});
" > $BACKUP_DIR/database-info.txt 2>/dev/null || echo "Could not connect to MongoDB"

echo "4. 📝 Saving application logs..."
docker logs obe-portal --tail 100 > $BACKUP_DIR/app-logs.txt 2>/dev/null || echo "No app logs"
docker logs obe-mongodb --tail 50 > $BACKUP_DIR/mongodb-logs.txt 2>/dev/null || echo "No MongoDB logs"

echo "5. 🌐 Testing current URLs..."
echo "=== URL TESTS ===" > $BACKUP_DIR/url-tests.txt
echo "Main app (3200):" >> $BACKUP_DIR/url-tests.txt
curl -I http://194.60.87.212:3200 2>/dev/null | head -1 >> $BACKUP_DIR/url-tests.txt || echo "❌ Not responding" >> $BACKUP_DIR/url-tests.txt

echo "Pro admin dashboard:" >> $BACKUP_DIR/url-tests.txt
curl -I http://194.60.87.212:3200/pro-super-admin-dashboard.html 2>/dev/null | head -1 >> $BACKUP_DIR/url-tests.txt || echo "❌ Not responding" >> $BACKUP_DIR/url-tests.txt

echo "MongoDB web (8081):" >> $BACKUP_DIR/url-tests.txt
curl -I http://194.60.87.212:8081 2>/dev/null | head -1 >> $BACKUP_DIR/url-tests.txt || echo "❌ Not responding" >> $BACKUP_DIR/url-tests.txt

echo "6. 🔧 Saving fix scripts..."
cp *.sh $BACKUP_DIR/ 2>/dev/null || echo "No shell scripts found"
cp *.md $BACKUP_DIR/ 2>/dev/null || echo "No markdown files found"

echo "7. 📦 Creating archive..."
tar -czf ${BACKUP_DIR}.tar.gz $BACKUP_DIR/
rm -rf $BACKUP_DIR

echo "8. 💾 Creating database dump..."
docker exec obe-mongodb mongodump -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --out /tmp/backup 2>/dev/null && \
docker cp obe-mongodb:/tmp/backup ./database-backup-$(date +%Y%m%d-%H%M%S) || \
echo "Could not create database dump"

echo ""
echo "✅ BACKUP COMPLETE!"
echo "=================="
echo ""
echo "📁 Files created:"
echo "- ${BACKUP_DIR}.tar.gz (configuration and logs)"
echo "- database-backup-* (database dump)"
echo ""
echo "📋 Backup contains:"
echo "- Configuration files (config.env, docker-compose.yml, etc.)"
echo "- Current container status"
echo "- Database structure and info"
echo "- Application and MongoDB logs"
echo "- URL test results"
echo "- All fix scripts and documentation"
echo "- Complete database dump"
echo ""
echo "🔄 TO RESTORE LATER:"
echo "==================="
echo "1. Extract: tar -xzf ${BACKUP_DIR}.tar.gz"
echo "2. Copy config files back to project"
echo "3. Run: docker-compose up -d"
echo "4. Restore database: mongorestore"
echo ""
echo "💡 IMPORTANT: Keep these backup files safe!"
echo "You can use them to restore your exact current setup."