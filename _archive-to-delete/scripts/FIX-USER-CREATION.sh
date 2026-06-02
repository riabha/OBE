#!/bin/bash

# 🔧 FIX USER CREATION ISSUE
# This script fixes the user creation problem by updating server.js and restarting containers

echo "🔧 FIXING USER CREATION ISSUE"
echo "============================="

echo "1. 📋 Current status..."
echo "Checking if containers are running:"
docker ps --filter "name=obe-portal"

echo ""
echo "2. 🔄 Pulling latest changes from Git..."
git pull origin main

echo ""
echo "3. 🔄 Restarting containers to apply server.js fixes..."
docker-compose down
sleep 3
docker-compose up -d

echo ""
echo "4. ⏳ Waiting for containers to start..."
sleep 10

echo ""
echo "5. 📊 Checking container status..."
docker ps --filter "name=obe-portal"

echo ""
echo "6. 📋 Checking application logs..."
docker logs obe-portal --tail 15

echo ""
echo "7. 🧪 Testing application..."
curl -I http://194.60.87.212:3200 2>/dev/null | head -1 || echo "⚠️  Application may still be starting..."

echo ""
echo "🎯 FIXES APPLIED:"
echo "================"
echo "✅ Modified /api/users endpoint to handle department names"
echo "✅ Added automatic department creation if department doesn't exist"
echo "✅ Fixed /api/departments endpoint to return actual departments"
echo "✅ Added proper error handling for user creation"

echo ""
echo "📝 HOW TO TEST:"
echo "==============="
echo "1. Login as university super admin"
echo "2. Go to User Management section"
echo "3. Click 'Add User' button"
echo "4. Fill in the form with:"
echo "   - Name: Test User"
echo "   - Email: test@university.edu"
echo "   - Role: student"
echo "   - Department: Computer Science"
echo "   - Password: password123"
echo "   - Phone: 000-000-0000"
echo "5. Click 'Add User'"
echo "6. User should be created successfully"

echo ""
echo "🔍 IF STILL NOT WORKING:"
echo "========================"
echo "Check the browser console for errors:"
echo "1. Open browser developer tools (F12)"
echo "2. Go to Console tab"
echo "3. Try creating a user"
echo "4. Look for any error messages"

echo ""
echo "Or check server logs:"
echo "docker logs obe-portal --tail 50"

echo ""
echo "✅ FIX DEPLOYMENT COMPLETE!"
echo "The user creation issue should now be resolved."