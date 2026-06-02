# 🔄 Migration Guide - From Existing Setup to Docker

## Overview

This guide helps you migrate your existing QUEST OBE Portal deployment to Docker while preserving all data.

---

## 📋 Pre-Migration Checklist

### 1. Understand Your Current Setup

Run these commands on your VPS to document current setup:

```bash
# Check if MongoDB is running
systemctl status mongod
ps aux | grep mongo

# Find MongoDB data directory
mongod --version
cat /etc/mongod.conf | grep dbPath

# Check current databases
mongo --eval "db.adminCommand('listDatabases')"

# Check application process
ps aux | grep node
pm2 list  # If using PM2
```

### 2. Backup Current Data

**CRITICAL: Always backup before migration!**

```bash
# Create backup directory
mkdir -p ~/obe-migration-backup
cd ~/obe-migration-backup

# Backup MongoDB (all databases)
mongodump --out=./mongodb-backup-$(date +%Y%m%d)

# Backup application files
cp -r /path/to/your/obe/app ./app-backup

# Backup environment config
cp /path/to/your/config.env ./config.env.backup

# Create archive
tar -czf obe-complete-backup-$(date +%Y%m%d).tar.gz ./*

# Verify backup
ls -lh obe-complete-backup-*.tar.gz
```

---

## 🔄 Migration Scenarios

### Scenario A: Fresh VPS with Existing Data

**Best for:** Clean Docker deployment with data import

1. **Set up Docker environment** (follow QUICK-START.md)
2. **Import data after deployment** (see Data Import section below)

### Scenario B: Same VPS Migration

**Best for:** Migrating on the same server

1. **Stop current application**
2. **Backup data**
3. **Deploy Docker**
4. **Import data**
5. **Verify and switch**

### Scenario C: Parallel Deployment

**Best for:** Zero-downtime migration

1. **Deploy Docker on different port**
2. **Import data**
3. **Test thoroughly**
4. **Switch traffic**
5. **Decommission old setup**

---

## 🚀 Step-by-Step Migration

### Step 1: Stop Current Application

```bash
# If using PM2
pm2 stop all
pm2 delete all

# If using systemd
sudo systemctl stop obe-portal

# If running directly
pkill -f "node server.js"

# Verify nothing is running
ps aux | grep node
```

### Step 2: Backup Everything

```bash
# Backup MongoDB
mongodump --out=/backup/mongodb-$(date +%Y%m%d)

# Backup application
tar -czf /backup/app-$(date +%Y%m%d).tar.gz /path/to/obe/app

# Backup configs
cp /path/to/config.env /backup/
```

### Step 3: Deploy Docker

```bash
# Navigate to project directory
cd /opt/OBE

# Configure environment
cp .env.docker .env
nano .env  # Set your passwords and secrets

# Start Docker services
docker-compose up -d

# Wait for services to be ready (30 seconds)
sleep 30

# Check status
docker-compose ps
```

### Step 4: Import Data to Docker MongoDB

```bash
# Copy backup to Docker container
docker cp /backup/mongodb-20250313 obe-mongodb:/restore

# Import data
docker exec obe-mongodb mongorestore \
  --uri="mongodb://admin:YOUR_PASSWORD@localhost:27017" \
  --authenticationDatabase=admin \
  /restore/mongodb-20250313

# Verify import
docker exec obe-mongodb mongosh -u admin -p \
  --eval "db.adminCommand('listDatabases')"
```

### Step 5: Verify Migration

```bash
# Check application health
curl http://localhost:3000/api/health

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@obe.org.pk","password":"proadmin123"}'

# Check databases
docker exec obe-mongodb mongosh -u admin -p \
  --eval "show dbs"

# Check platform users
docker exec obe-mongodb mongosh -u admin -p obe_platform \
  --eval "db.platformusers.find().pretty()"

# Check universities
docker exec obe-mongodb mongosh -u admin -p obe_platform \
  --eval "db.universities.find().pretty()"
```

---

## 📊 Data Import Methods

### Method 1: Full Database Restore (Recommended)

```bash
# If you have mongodump backup
docker cp /backup/mongodb-backup obe-mongodb:/restore

# Restore all databases
docker exec obe-mongodb mongorestore \
  --uri="mongodb://admin:PASSWORD@localhost:27017" \
  --authenticationDatabase=admin \
  /restore/mongodb-backup
```

### Method 2: Selective Database Import

```bash
# Import only specific database
docker exec obe-mongodb mongorestore \
  --uri="mongodb://admin:PASSWORD@localhost:27017/obe_platform" \
  --authenticationDatabase=admin \
  /restore/mongodb-backup/obe_platform
```

### Method 3: JSON Import (if you have JSON exports)

```bash
# Import collection from JSON
docker exec obe-mongodb mongoimport \
  --uri="mongodb://admin:PASSWORD@localhost:27017/obe_platform" \
  --collection=universities \
  --file=/restore/universities.json \
  --jsonArray
```

---

## 🔧 Configuration Migration

### Environment Variables Mapping

**Old config.env → New .env**

```bash
# Old format
MONGODB_URI=mongodb://localhost:27017/obe_platform

# New Docker format
MONGODB_URI=mongodb://admin:password@mongodb:27017/obe_platform?authSource=admin
```

**Key differences:**
- Host changes from `localhost` to `mongodb` (Docker service name)
- Must include authentication credentials
- Must specify `authSource=admin`

### Port Configuration

If your old setup used different port:

```bash
# In .env file
APP_PORT=3000  # Change if needed

# In docker-compose.yml
ports:
  - "YOUR_PORT:3000"
```

---

## 🌐 Network Configuration

### If Using Nginx (Existing)

Update your Nginx config to point to Docker:

```bash
# Edit existing config
sudo nano /etc/nginx/sites-available/obe-portal

# Change proxy_pass to:
proxy_pass http://localhost:3000;  # Docker container port

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### If Using Apache

```bash
# Update ProxyPass
ProxyPass / http://localhost:3000/
ProxyPassReverse / http://localhost:3000/
```

---

## ✅ Post-Migration Verification

### 1. Functional Tests

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@obe.org.pk","password":"proadmin123"}'

# Test database connection
docker exec obe-mongodb mongosh -u admin -p \
  --eval "db.adminCommand('ping')"
```

### 2. Data Integrity Checks

```bash
# Count documents in platform database
docker exec obe-mongodb mongosh -u admin -p obe_platform \
  --eval "db.platformusers.countDocuments()"

docker exec obe-mongodb mongosh -u admin -p obe_platform \
  --eval "db.universities.countDocuments()"

# Compare with old database counts
mongo obe_platform --eval "db.platformusers.countDocuments()"
```

### 3. Application Tests

- [ ] Login with existing users
- [ ] Create new university
- [ ] Upload files
- [ ] Generate reports
- [ ] Test all major features

---

## 🔄 Rollback Plan

If migration fails, rollback to previous setup:

```bash
# Stop Docker containers
docker-compose down

# Restore old MongoDB data
mongorestore /backup/mongodb-20250313

# Start old application
pm2 start server.js  # or your previous method

# Verify old setup works
curl http://localhost:3000/api/health
```

---

## 🐛 Common Migration Issues

### Issue 1: Authentication Failed

**Problem:** Can't connect to MongoDB in Docker

**Solution:**
```bash
# Check credentials in .env
cat .env | grep MONGO

# Verify MongoDB is running
docker-compose ps mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Test connection
docker exec obe-mongodb mongosh -u admin -p
```

### Issue 2: Data Not Visible

**Problem:** Imported data not showing in application

**Solution:**
```bash
# Check if data was imported
docker exec obe-mongodb mongosh -u admin -p \
  --eval "show dbs"

# Check specific database
docker exec obe-mongodb mongosh -u admin -p obe_platform \
  --eval "db.getCollectionNames()"

# Verify connection string in .env
cat .env | grep MONGODB_URI
```

### Issue 3: Port Conflicts

**Problem:** Port 3000 already in use

**Solution:**
```bash
# Find what's using the port
sudo netstat -tlnp | grep 3000

# Kill the process or change Docker port
# In .env:
APP_PORT=3001

# In docker-compose.yml:
ports:
  - "3001:3000"
```

---

## 📈 Performance Comparison

After migration, compare performance:

```bash
# Docker resource usage
docker stats --no-stream

# Response time test
time curl http://localhost:3000/api/health

# Database query performance
docker exec obe-mongodb mongosh -u admin -p obe_platform \
  --eval "db.universities.find().explain('executionStats')"
```

---

## 🔐 Security Improvements

Docker deployment adds these security benefits:

✅ **Isolated network** - MongoDB not exposed to internet
✅ **Container isolation** - App and DB in separate containers
✅ **Easy secrets management** - Environment variables in .env
✅ **Automatic restarts** - Containers restart on failure
✅ **Resource limits** - Can set CPU/memory limits

---

## 📞 Migration Support

If you encounter issues:

1. **Check logs:**
   ```bash
   docker-compose logs -f
   ```

2. **Verify data:**
   ```bash
   docker exec obe-mongodb mongosh -u admin -p
   ```

3. **Test connectivity:**
   ```bash
   curl http://localhost:3000/api/health
   ```

4. **Collect diagnostics:**
   ```bash
   docker-compose ps
   docker stats --no-stream
   df -h
   ```

---

**Made with ❤️ for QUEST University**
