#!/bin/bash

# 🔧 DIRECT FIX FOR LOADING ISSUE
# This script directly fixes the "Loading..." problem

echo "🔧 DIRECT FIX FOR LOADING ISSUE"
echo "==============================="

echo "1. 🔍 Diagnosing the exact problem..."

# Check what's in the database
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;

print('=== CURRENT UNIVERSITIES ===');
db.universities.find().forEach(function(uni) {
    print('ID: ' + uni._id);
    print('Name: ' + uni.universityName);
    print('Code: ' + uni.universityCode);
    print('Database: ' + uni.databaseName);
    print('---');
});

print('=== CURRENT PLATFORM USERS ===');
db.platformusers.find().forEach(function(user) {
    print('Email: ' + user.email);
    print('Role: ' + user.role);
    print('University Code: ' + user.universityCode);
    print('University ID: ' + user.university);
    print('---');
});

print('=== AVAILABLE DATABASES ===');
db.adminCommand('listDatabases').databases.forEach(function(db) {
    if (db.name.includes('obe') || db.name.includes('demo')) {
        print('Database: ' + db.name);
    }
});
"

echo ""
echo "2. 🔧 Fixing the database mismatch..."

# Fix the database name mismatch
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;

print('=== FIXING DATABASE MISMATCH ===');

// Find the university with DEMO code
var demoUniversity = db.universities.findOne({universityCode: 'DEMO'});
if (demoUniversity) {
    print('Found DEMO university: ' + demoUniversity.universityName);
    print('Current database name: ' + demoUniversity.databaseName);
    
    // Check if obe_demo exists
    var databases = db.adminCommand('listDatabases').databases;
    var obeDemo = databases.find(function(db) { return db.name === 'obe_demo'; });
    var obeUniversityDemo = databases.find(function(db) { return db.name === 'obe_university_demo'; });
    
    if (obeDemo && !obeUniversityDemo) {
        print('obe_demo exists but obe_university_demo does not');
        print('Updating university to use obe_demo database');
        
        // Update the university to use the existing obe_demo database
        db.universities.updateOne(
            {_id: demoUniversity._id},
            {\$set: {databaseName: 'obe_demo'}}
        );
        
        print('✅ Updated university database name to: obe_demo');
    } else if (obeUniversityDemo && !obeDemo) {
        print('obe_university_demo exists, keeping current setting');
    } else if (obeDemo && obeUniversityDemo) {
        print('Both databases exist, using obe_demo');
        db.universities.updateOne(
            {_id: demoUniversity._id},
            {\$set: {databaseName: 'obe_demo'}}
        );
    } else {
        print('Neither database exists, creating obe_demo');
        var demoDB = db.getSiblingDB('obe_demo');
        demoDB.createCollection('_metadata');
        demoDB._metadata.insertOne({
            universityName: demoUniversity.universityName,
            universityCode: demoUniversity.universityCode,
            createdAt: new Date()
        });
        
        db.universities.updateOne(
            {_id: demoUniversity._id},
            {\$set: {databaseName: 'obe_demo'}}
        );
        print('✅ Created and linked obe_demo database');
    }
    
    // Ensure platform user has correct university reference
    var demoUser = db.platformusers.findOne({universityCode: 'DEMO'});
    if (demoUser && !demoUser.university) {
        db.platformusers.updateOne(
            {_id: demoUser._id},
            {\$set: {university: demoUniversity._id}}
        );
        print('✅ Fixed platform user university reference');
    }
} else {
    print('❌ No DEMO university found');
}

print('=== FIX COMPLETE ===');
"

echo ""
echo "3. 🔄 Restarting application..."
docker-compose restart

echo ""
echo "4. ⏳ Waiting for restart..."
sleep 10

echo ""
echo "5. 🧪 Testing the fix..."
echo "Checking if application is responding..."
curl -I http://194.60.87.212:3200 2>/dev/null | head -1 || echo "⚠️ Application may still be starting"

echo ""
echo "6. 📋 Final verification..."
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;
print('=== FINAL STATUS ===');
var uni = db.universities.findOne({universityCode: 'DEMO'});
if (uni) {
    print('University: ' + uni.universityName);
    print('Database: ' + uni.databaseName);
    
    var user = db.platformusers.findOne({universityCode: 'DEMO'});
    if (user) {
        print('User: ' + user.email);
        print('University Reference: ' + (user.university ? 'SET' : 'MISSING'));
    }
}
"

echo ""
echo "✅ DIRECT FIX COMPLETE!"
echo "======================"
echo ""
echo "🧪 NOW TEST:"
echo "1. Go to: http://194.60.87.212:3200"
echo "2. Login as university super admin"
echo "3. Check if university name shows instead of 'Loading...'"
echo ""
echo "If still not working, check browser console (F12) for JavaScript errors"