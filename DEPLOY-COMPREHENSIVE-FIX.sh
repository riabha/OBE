#!/bin/bash

echo "🔧 DEPLOYING COMPREHENSIVE OBE PORTAL FIXES"
echo "============================================"

cd /www/wwwroot/obe-portal

echo "1. 🛑 Stopping current containers..."
docker-compose down

echo ""
echo "2. 📝 Backing up current files..."
cp public/university-super-admin-dashboard.html public/university-super-admin-dashboard.html.backup.$(date +%Y%m%d_%H%M%S)
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)

echo ""
echo "3. 🔄 Pulling latest fixes from GitHub..."
git pull origin main

echo ""
echo "4. 🔨 Rebuilding containers with fixes..."
docker-compose build --no-cache

echo ""
echo "5. 🚀 Starting containers..."
docker-compose up -d

echo ""
echo "6. ⏳ Waiting 20 seconds for startup..."
sleep 20

echo ""
echo "7. 📊 Container Status:"
docker-compose ps

echo ""
echo "8. 📋 Application Logs:"
docker-compose logs --tail=15 obe-app

echo ""
echo "9. 🧪 Testing Application:"
echo "   Testing main application..."
curl -I http://localhost:3200 2>/dev/null && echo "   ✅ Main app OK" || echo "   ❌ Main app failed"

echo ""
echo "10. 🔍 Testing University Creation:"
echo "    You can now test university creation and login functionality"

echo ""
echo "🎯 COMPREHENSIVE FIX DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "🌐 **Application URLs:**"
echo "   Main Portal: http://194.60.87.212:3200"
echo "   Database GUI: http://194.60.87.212:8081"
echo ""
echo "🔑 **Test Credentials:**"
echo "   Pro Admin: pro@obe.org.pk / proadmin123"
echo ""
echo "📋 **What's Fixed:**"
echo "   ✅ User creation form (firstName/lastName fields)"
echo "   ✅ University-specific API endpoints added"
echo "   ✅ Logo display functionality"
echo "   ✅ Database connection handling"
echo "   ✅ Error handling and validation"
echo ""
echo "🧪 **Testing Steps:**"
echo "   1. Login as Pro Admin"
echo "   2. Create a test university"
echo "   3. Login as university super admin"
echo "   4. Try creating users, departments, etc."
echo "   5. Verify logo displays correctly"
echo ""
echo "📞 **If Issues Persist:**"
echo "   Check logs: docker-compose logs -f obe-app"
echo "   Check database: http://194.60.87.212:8081"