#!/bin/bash

# 🚀 COMPREHENSIVE FIX DEPLOYMENT
echo "🚀 DEPLOYING COMPREHENSIVE FIXES"
echo "================================"

echo "1. 📥 Pulling latest changes..."
cd /www/wwwroot/obe-portal
git stash
git pull origin main

echo "2. 🔧 Fixing database issues..."
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;

print('=== FIXING DATABASE ISSUES ===');

// Fix database names
db.universities.find().forEach(function(uni) {
    var expectedDbName = 'obe_university_' + uni.universityCode.toLowerCase();
    if (uni.databaseName !== expectedDbName) {
        print('Fixing database name for ' + uni.universityName + ': ' + uni.databaseName + ' -> ' + expectedDbName);
        db.universities.updateOne(
            {_id: uni._id},
            {\$set: {databaseName: expectedDbName}}
        );
    }
});

// Create missing databases
db.universities.find().forEach(function(uni) {
    var dbExists = db.adminCommand('listDatabases').databases.some(function(db) {
        return db.name === uni.databaseName;
    });
    
    if (!dbExists) {
        print('Creating missing database: ' + uni.databaseName);
        var uniDb = db.getSiblingDB(uni.databaseName);
        uniDb.createCollection('_metadata');
        uniDb._metadata.insertOne({
            universityName: uni.universityName,
            universityCode: uni.universityCode,
            createdAt: new Date(),
            version: '1.0'
        });
    }
});

// Fix user references
db.platformusers.find().forEach(function(user) {
    if (user.universityCode && !user.university) {
        var university = db.universities.findOne({universityCode: user.universityCode});
        if (university) {
            db.platformusers.updateOne(
                {_id: user._id},
                {\$set: {university: university._id}}
            );
            print('Fixed user reference: ' + user.email);
        }
    }
});

print('=== DATABASE FIXES COMPLETE ===');
"

echo "3. 🔄 Rebuilding containers..."
docker-compose down
docker-compose up -d --build

echo "4. ⏳ Waiting for startup..."
sleep 15

echo "5. ✅ DEPLOYMENT COMPLETE!"
echo "========================="
echo "🌐 Application: http://194.60.87.212:3200"
echo "🔑 Login: pro@obe.org.pk / proadmin123"
echo ""
echo "🧪 Test the following:"
echo "- University super admin login"
echo "- University name/logo display"
echo "- User creation functionality"
echo "- Password change functionality"