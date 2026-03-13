# 🚀 CRITICAL FIX: MongoDB Connection Issue

## Problem Identified
The application container is failing with `getaddrinfo ENOTFOUND quest` error because:
1. Missing `.env` file with proper environment variables
2. Application trying to connect to hostname "quest" instead of Docker service "mongodb"

## ✅ COMPLETE FIX COMMANDS

Run these commands on your VPS to fix the issue:

```bash
# Navigate to project directory
cd /www/wwwroot/obe-portal

# Stop current containers
docker-compose down

# Verify .env file exists with correct settings
cat .env

# If .env is missing or incorrect, create it:
cat > .env << 'EOF'
# QUEST OBE Portal - Docker Environment Configuration
# Auto-generated secure credentials

# Application Configuration
APP_PORT=3200
NODE_ENV=production

# MongoDB Root Credentials
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=SecureOBE2025!MongoDB@Quest

# Application Database Connection (Docker service name)
MONGODB_URI=mongodb://admin:SecureOBE2025!MongoDB@Quest@mongodb:27017/obe_platform?authSource=admin

# JWT Configuration (Auto-generated secure secrets)
JWT_SECRET=OBE2025SecureJWTSecretForQuestUniversityPortal123456789
SESSION_SECRET=QuestOBESessionSecret2025SecureRandomString987654321

# Mongo Express (Database GUI) - Optional
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=SecureOBE2025!MongoExpress@Quest
EOF

# Start containers with proper environment
docker-compose up -d

# Check container status
docker-compose ps

# Monitor application logs
docker-compose logs -f obe-app

# Test application
curl -f http://localhost:3200 || echo "Application not ready yet"
```

## 🔐 Your Credentials

**Application Access:**
- URL: `http://YOUR_VPS_IP:3200`
- Login: `pro@obe.org.pk`
- Password: `proadmin123`

**MongoDB Access:**
- Username: `admin`
- Password: `SecureOBE2025!MongoDB@Quest`
- Connection: `mongodb://admin:SecureOBE2025!MongoDB@Quest@localhost:27018/obe_platform?authSource=admin`

**Database GUI (Optional):**
- URL: `http://YOUR_VPS_IP:8081`
- Username: `admin`
- Password: `SecureOBE2025!MongoExpress@Quest`

## 🔍 Verification Steps

1. **Check containers are running:**
   ```bash
   docker-compose ps
   ```

2. **Verify MongoDB connection:**
   ```bash
   docker-compose logs mongodb | tail -10
   ```

3. **Check application logs:**
   ```bash
   docker-compose logs obe-app | tail -20
   ```

4. **Test application health:**
   ```bash
   curl -f http://localhost:3200
   ```

5. **Access application:**
   - Open browser: `http://YOUR_VPS_IP:3200`
   - Should see login page
   - Login with: `pro@obe.org.pk` / `proadmin123`

## 🚨 If Still Not Working

Run this diagnostic command:
```bash
cd /www/wwwroot/obe-portal
echo "=== ENVIRONMENT CHECK ==="
cat .env | grep MONGODB_URI
echo ""
echo "=== CONTAINER STATUS ==="
docker-compose ps
echo ""
echo "=== APPLICATION LOGS ==="
docker-compose logs --tail=10 obe-app
echo ""
echo "=== MONGODB LOGS ==="
docker-compose logs --tail=10 mongodb
```

The key fix was creating the `.env` file with the correct `MONGODB_URI` that uses the Docker service name `mongodb` instead of `quest`.