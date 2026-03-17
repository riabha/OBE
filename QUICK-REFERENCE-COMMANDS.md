# 🚀 OBE PORTAL - QUICK REFERENCE COMMANDS

## 🌐 ESSENTIAL URLs
```
Main App: http://194.60.87.212:3200
Pro Admin: http://194.60.87.212:3200/pro-super-admin-dashboard.html
MongoDB Web: http://194.60.87.212:8081
```

## 🔐 LOGIN CREDENTIALS
```
Pro Super Admin: pro@obe.org.pk / proadmin123
MongoDB: admin / SecureOBE2025MongoDBQuest
```

## 🚀 DEPLOYMENT COMMANDS

### Update and Restart
```bash
cd /www/wwwroot/obe-portal
git pull origin main
docker-compose restart
```

### Complete Rebuild
```bash
cd /www/wwwroot/obe-portal
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Force All Fixes
```bash
cd /www/wwwroot/obe-portal
git pull origin main
chmod +x CHECK-AND-FORCE-UPDATE.sh
./CHECK-AND-FORCE-UPDATE.sh
```

## 🔧 TROUBLESHOOTING

### Check Status
```bash
docker-compose ps
docker logs obe-portal
docker logs obe-mongodb
curl -I http://194.60.87.212:3200
```

### Fix Database Issues
```bash
chmod +x FIX-DATABASE-ARCHITECTURE.sh
./FIX-DATABASE-ARCHITECTURE.sh
```

### Fix MongoDB Settings
```bash
chmod +x FIX-MONGODB-SETTINGS.sh
./FIX-MONGODB-SETTINGS.sh
```

### Create Demo Data
```bash
chmod +x POPULATE-DEMO-DATABASE.sh
./POPULATE-DEMO-DATABASE.sh
```

## 🗄️ DATABASE ACCESS

### External Connection
```
Host: 194.60.87.212
Port: 27018
Username: admin
Password: SecureOBE2025MongoDBQuest
Auth DB: admin
```

### Connection String
```
mongodb://admin:SecureOBE2025MongoDBQuest@194.60.87.212:27018/DATABASE_NAME?authSource=admin
```

## 🚨 EMERGENCY FIXES

### If Nothing Works
```bash
cd /www/wwwroot/obe-portal
git pull origin main
docker-compose down
docker system prune -f
docker-compose build --no-cache
docker-compose up -d
```

### If Database Lost
```bash
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin
```

## 📁 KEY FILES
- `server.js` - Main application
- `docker-compose.yml` - Docker config
- `config.env` - Environment variables
- `COMPLETE-PROJECT-DOCUMENTATION.md` - Full documentation