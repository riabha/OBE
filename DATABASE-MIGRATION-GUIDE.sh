#!/bin/bash

echo "🔄 DATABASE MIGRATION GUIDE"
echo "==========================="

echo "This script helps you migrate to a new MongoDB database"
echo ""

read -p "Enter new MongoDB host (default: mongodb): " NEW_HOST
NEW_HOST=${NEW_HOST:-mongodb}

read -p "Enter new MongoDB port (default: 27017): " NEW_PORT
NEW_PORT=${NEW_PORT:-27017}

read -p "Enter new MongoDB username: " NEW_USER
read -s -p "Enter new MongoDB password: " NEW_PASS
echo ""

read -p "Enter new database name: " NEW_DB
read -p "Enter auth source (default: admin): " NEW_AUTH
NEW_AUTH=${NEW_AUTH:-admin}

echo ""
echo "🔍 Testing new connection..."

# Test the new connection
docker exec obe-mongodb mongosh "mongodb://$NEW_USER:$NEW_PASS@$NEW_HOST:$NEW_PORT/$NEW_DB?authSource=$NEW_AUTH" --eval "db.runCommand('ping')" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Connection test successful!"
    
    echo ""
    echo "🔄 Updating configuration..."
    
    # Backup current config
    cp config.env config.env.backup.$(date +%Y%m%d_%H%M%S)
    
    # Update config.env
    NEW_URI="mongodb://$NEW_USER:$NEW_PASS@$NEW_HOST:$NEW_PORT/$NEW_DB?authSource=$NEW_AUTH"
    sed -i "s|MONGODB_URI=.*|MONGODB_URI=$NEW_URI|g" config.env
    
    echo "✅ Configuration updated!"
    echo ""
    echo "🔄 Restarting application..."
    docker-compose restart obe-app
    
    echo ""
    echo "⏳ Waiting 15 seconds for restart..."
    sleep 15
    
    echo ""
    echo "📊 Application status:"
    docker-compose logs --tail=10 obe-app
    
    echo ""
    echo "🎯 MIGRATION COMPLETE!"
    echo "New database connection: $NEW_HOST:$NEW_PORT/$NEW_DB"
    
else
    echo "❌ Connection test failed!"
    echo "Please check your database settings and try again."
fi