#!/bin/bash

echo "🔧 FIXING UNIVERSITY LOGIN ISSUE"
echo "================================"

cd /www/wwwroot/obe-portal

echo "1. 📋 Checking created universities..."
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;
print('=== UNIVERSITIES ===');
db.universities.find({}, {universityName: 1, universityCode: 1, superAdminEmail: 1, isActive: 1}).forEach(printjson);
"

echo ""
echo "2. 📋 Checking platform users (university admins)..."
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;
print('=== PLATFORM USERS ===');
db.platformusers.find({role: 'university_superadmin'}, {email: 1, name: 1, role: 1, universityCode: 1, isActive: 1}).forEach(printjson);
"

echo ""
echo "3. 🔍 Checking if demo university database exists..."
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
show dbs;
" | grep -i demo || echo "No demo database found"

echo ""
echo "4. 📊 Application logs (looking for login attempts)..."
docker-compose logs --tail=20 obe-app | grep -i "login\|demo\|auth" || echo "No recent login logs found"

echo ""
echo "🎯 DIAGNOSIS COMPLETE!"
echo "====================="
echo ""
echo "📋 **Common University Login Issues:**"
echo "1. Wrong email format (should be the superAdminEmail from university creation)"
echo "2. Password was changed but not updated correctly"
echo "3. University account is inactive"
echo "4. University database wasn't created properly"
echo ""
echo "📧 **To reset university admin password:**"
echo "   Use the Pro Super Admin portal to manage university users"
echo ""
echo "🔑 **Default login credentials:**"
echo "   Pro Admin: pro@obe.org.pk / proadmin123"