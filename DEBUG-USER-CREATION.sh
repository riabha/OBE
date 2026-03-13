#!/bin/bash

# 🔍 DEBUG USER CREATION ISSUE
# This script helps diagnose why user creation is failing

echo "🔍 DEBUGGING USER CREATION ISSUE"
echo "================================"

echo "1. 📋 Checking Docker containers..."
docker ps --filter "name=obe-portal"

echo ""
echo "2. 📊 Checking application logs..."
echo "Recent application logs:"
docker logs obe-portal --tail 20

echo ""
echo "3. 🔍 Checking MongoDB connection..."
echo "Testing MongoDB connection:"
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "db.adminCommand('ping')"

echo ""
echo "4. 📋 Checking university databases..."
echo "Listing all databases:"
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "show dbs"

echo ""
echo "5. 🔍 Checking if university database exists..."
echo "Looking for university databases (should start with university name):"
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "db.adminCommand('listDatabases').databases.forEach(function(db) { if(db.name !== 'admin' && db.name !== 'config' && db.name !== 'local' && db.name !== 'obe_platform') { print('University DB: ' + db.name); } })"

echo ""
echo "6. 🔍 Checking platform users (university super admins)..."
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;
print('Platform users:');
db.platformusers.find({}, {email: 1, universityCode: 1, role: 1}).forEach(function(user) {
    print('Email: ' + user.email + ', University: ' + user.universityCode + ', Role: ' + user.role);
});
"

echo ""
echo "7. 🔍 Checking universities collection..."
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;
print('Universities:');
db.universities.find({}, {universityName: 1, universityCode: 1, databaseName: 1}).forEach(function(uni) {
    print('Name: ' + uni.universityName + ', Code: ' + uni.universityCode + ', DB: ' + uni.databaseName);
});
"

echo ""
echo "8. 🔧 COMMON ISSUES AND SOLUTIONS:"
echo "=================================="
echo "❌ Issue: 'No token' error"
echo "   ✅ Solution: Make sure you're logged in as university super admin"
echo ""
echo "❌ Issue: 'University database not found'"
echo "   ✅ Solution: University database should be created automatically"
echo ""
echo "❌ Issue: 'User model not found'"
echo "   ✅ Solution: Check if User model exists in models/User.js"
echo ""
echo "❌ Issue: 'Validation error'"
echo "   ✅ Solution: Check required fields in user creation form"

echo ""
echo "9. 🧪 TESTING USER CREATION API:"
echo "==============================="
echo "To test user creation manually, you can use this curl command:"
echo "(Replace TOKEN with actual JWT token from browser)"
echo ""
echo "curl -X POST http://194.60.87.212:3200/api/users \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \\"
echo "  -H 'X-User-Email: your-university-admin@email.com' \\"
echo "  -d '{"
echo "    \"firstName\": \"Test\","
echo "    \"lastName\": \"User\","
echo "    \"email\": \"test@university.edu\","
echo "    \"role\": \"student\","
echo "    \"department\": \"Computer Science\","
echo "    \"password\": \"password123\","
echo "    \"phone\": \"000-000-0000\""
echo "  }'"

echo ""
echo "🔍 DEBUGGING COMPLETE!"
echo "Check the output above for any errors or missing components."