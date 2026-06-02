#!/bin/bash
# Pull latest code and rebuild app on VPS
# Usage: ./update-server.sh

set -e

APP_DIR="/www/wwwroot/obe-portal"

echo "=== OBE Portal — Update Server ==="

cd "$APP_DIR"

echo ">> Git pull..."
git pull origin main

echo ">> Rebuild and restart app..."
docker-compose up -d --build obe-app

echo ">> Waiting for app..."
sleep 10

echo ">> Container status:"
docker-compose ps

echo ">> Health check:"
curl -s http://localhost:3200/api/health || echo "Health check failed — check: docker logs obe-portal"

echo ""
echo "Done. Open: http://194.60.87.212:3200"
