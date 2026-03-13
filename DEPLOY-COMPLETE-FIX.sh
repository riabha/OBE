#!/bin/bash

# 🚀 COMPLETE FIX DEPLOYMENT SCRIPT
# This script fixes all university dashboard loading issues

echo "🚀 DEPLOYING COMPLETE FIX FOR UNIVERSITY DASHBOARD"
echo "=================================================="

echo "1. 🔧 Fixing database synchronization..."

# Fix the database mismatch and ensure proper linking
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;

print('=== FIXING DATABASE SYNCHRONIZATION ===');

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
    if (demoUser) {
        if (!demoUser.university) {
            db.platformusers.updateOne(
                {_id: demoUser._id},
                {\$set: {university: demoUniversity._id}}
            );
            print('✅ Fixed platform user university reference');
        } else {
            print('✅ Platform user university reference already set');
        }
    } else {
        print('❌ No DEMO platform user found');
    }
} else {
    print('❌ No DEMO university found');
}

print('=== DATABASE SYNC COMPLETE ===');
"

echo ""
echo "2. 🔄 Restarting application to apply server.js changes..."
docker-compose restart

echo ""
echo "3. ⏳ Waiting for application to start..."
sleep 15

echo ""
echo "4. 🧪 Testing the fixes..."

# Test if application is responding
echo "Checking application status..."
if curl -I http://194.60.87.212:3200 2>/dev/null | head -1 | grep -q "200\|302"; then
    echo "✅ Application is responding"
else
    echo "⚠️ Application may still be starting, please wait a moment"
fi

echo ""
echo "5. 📋 Final verification..."

# Verify the database fix
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;
print('=== FINAL VERIFICATION ===');
var uni = db.universities.findOne({universityCode: 'DEMO'});
if (uni) {
    print('✅ University: ' + uni.universityName);
    print('✅ Database: ' + uni.databaseName);
    
    var user = db.platformusers.findOne({universityCode: 'DEMO'});
    if (user) {
        print('✅ User: ' + user.email);
        print('✅ University Reference: ' + (user.university ? 'SET (' + user.university + ')' : 'MISSING'));
    }
} else {
    print('❌ University not found');
}
"

echo ""
echo "✅ COMPLETE FIX DEPLOYMENT FINISHED!"
echo "===================================="
echo ""
echo "🧪 NOW TEST THE FIXES:"
echo "1. Go to: http://194.60.87.212:3200"
echo "2. Login as university super admin"
echo "3. Check if university name shows instead of 'Loading...'"
echo "4. Check if database name shows correctly in sidebar"
echo ""
echo "📝 WHAT WAS FIXED:"
echo "• Enhanced /api/my-university endpoint with fallback logic"
echo "• Fixed duplicate API endpoints in server.js"
echo "• Enhanced loadUniversityInfo() function with better error handling"
echo "• Fixed database name mismatch (obe_demo vs obe_university_demo)"
echo "• Ensured platform user has proper university reference"
echo "• Added immediate fallback display to prevent 'Loading...' state"
echo ""
echo "If you still see 'Loading...', check browser console (F12) for any JavaScript errors"