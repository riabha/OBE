#!/bin/bash

echo "🔍 DEBUGGING CONNECTION TEST FAILURE"
echo "===================================="

cd /www/wwwroot/obe-portal

echo "1. 📋 Current application logs (looking for connection test errors):"
docker-compose logs --tail=50 obe-app | grep -i "mongodb\|connection\|test\|error" || echo "No recent connection test logs found"

echo ""
echo "2. 🧪 Manual connection test from inside container:"
echo "Testing the exact same connection the API uses..."

# Test the connection manually using the same parameters
docker exec obe-portal node -e "
const mongoose = require('mongoose');
const testUri = 'mongodb://admin:SecureOBE2025MongoDBQuest@mongodb:27017/obe_platform?authSource=admin';
console.log('Testing URI:', testUri.replace(/\/\/.*:.*@/, '//***:***@'));

mongoose.createConnection(testUri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000
}).then(conn => {
    console.log('✅ Manual test successful - Connection state:', conn.readyState);
    conn.close();
    process.exit(0);
}).catch(err => {
    console.log('❌ Manual test failed:', err.message);
    process.exit(1);
});
"

echo ""
echo "3. 🔍 Testing API endpoint directly:"
curl -X POST http://localhost:3000/api/mongodb-settings/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(docker exec obe-portal node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({userId: 'test'}, process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024');
console.log(token);
")" \
  -d '{
    "host": "mongodb",
    "port": "27017", 
    "username": "admin",
    "password": "SecureOBE2025MongoDBQuest",
    "database": "obe_platform",
    "authSource": "admin"
  }' 2>/dev/null | jq . || echo "API test failed"

echo ""
echo "4. 📊 Container network connectivity:"
docker exec obe-portal ping -c 2 mongodb 2>/dev/null || echo "❌ Cannot ping mongodb"
docker exec obe-portal nc -zv mongodb 27017 2>/dev/null || echo "❌ Cannot connect to mongodb:27017"

echo ""
echo "🎯 DEBUGGING COMPLETE!"
echo "Check the results above to see exactly why the connection test is failing."