#!/bin/bash

echo "🔑 RESET UNIVERSITY ADMIN PASSWORD"
echo "=================================="

cd /www/wwwroot/obe-portal

echo "Available universities:"
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;
db.universities.find({}, {universityName: 1, universityCode: 1, superAdminEmail: 1}).forEach(function(doc) {
    print('University: ' + doc.universityName + ' (' + doc.universityCode + ')');
    print('Admin Email: ' + doc.superAdminEmail);
    print('---');
});
"

echo ""
read -p "Enter the university code (e.g., DEMO): " UNIV_CODE
read -p "Enter the admin email: " ADMIN_EMAIL
read -s -p "Enter new password: " NEW_PASSWORD
echo ""

echo ""
echo "🔄 Resetting password for $ADMIN_EMAIL..."

# Hash the new password using bcrypt (same as the application)
HASHED_PASSWORD=$(docker exec obe-portal node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('$NEW_PASSWORD', 12);
console.log(hash);
")

# Update the password in the database
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;
const result = db.platformusers.updateOne(
    { email: '$ADMIN_EMAIL', universityCode: '$UNIV_CODE' },
    { 
        \$set: { 
            password: '$HASHED_PASSWORD',
            isActive: true,
            updatedAt: new Date()
        }
    }
);
print('Update result:', result.matchedCount, 'matched,', result.modifiedCount, 'modified');

if (result.matchedCount === 0) {
    print('❌ User not found! Check email and university code.');
} else if (result.modifiedCount > 0) {
    print('✅ Password updated successfully!');
} else {
    print('⚠️ User found but password not changed.');
}
"

echo ""
echo "🎯 PASSWORD RESET COMPLETE!"
echo "=========================="
echo ""
echo "🔑 **New Login Credentials:**"
echo "   Email: $ADMIN_EMAIL"
echo "   Password: $NEW_PASSWORD"
echo "   University: $UNIV_CODE"
echo ""
echo "🌐 **Login URL:** http://194.60.87.212:3200"