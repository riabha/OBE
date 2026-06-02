# 🔄 OBE PORTAL - RESTORATION GUIDE

## 📋 HOW TO RESTORE YOUR SETUP

If you need to restore your OBE Portal setup on a new server or after issues, follow these steps:

### 🚀 QUICK RESTORATION (Recommended)

1. **Clone the repository**:
```bash
git clone https://github.com/riabha/OBE.git
cd OBE
```

2. **Run the complete setup**:
```bash
chmod +x CHECK-AND-FORCE-UPDATE.sh
./CHECK-AND-FORCE-UPDATE.sh
```

3. **Access your application**:
- Main app: http://YOUR_SERVER_IP:3200
- Pro admin: http://YOUR_SERVER_IP:3200/pro-super-admin-dashboard.html

### 🔧 MANUAL RESTORATION

1. **Set up the environment**:
```bash
# Create config.env with these settings:
MONGODB_URI=mongodb://admin:SecureOBE2025MongoDBQuest@mongodb:27017/obe_platform?authSource=admin
JWT_SECRET=OBE2025SecureJWTSecretForQuestUniversityPortal123456789
SESSION_SECRET=QuestOBESessionSecret2025SecureRandomString987654321
APP_PORT=3200
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=SecureOBE2025MongoDBQuest
```

2. **Deploy with Docker**:
```bash
docker-compose up -d
```

3. **Wait for services to start** (about 2 minutes)

4. **Test the deployment**:
```bash
curl -I http://localhost:3200
```

### 💾 RESTORE FROM BACKUP

If you have backup files:

1. **Extract backup**:
```bash
tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz
```

2. **Copy configuration files**:
```bash
cp backup-*/config.env .
cp backup-*/docker-compose.yml .
```

3. **Start services**:
```bash
docker-compose up -d
```

4. **Restore database** (if you have database backup):
```bash
docker cp database-backup-* obe-mongodb:/tmp/
docker exec obe-mongodb mongorestore -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin /tmp/database-backup-*
```

### 🔐 DEFAULT CREDENTIALS

After restoration, use these credentials:

**Pro Super Admin**:
- Email: pro@obe.org.pk
- Password: proadmin123

**MongoDB**:
- Username: admin
- Password: SecureOBE2025MongoDBQuest
- Host: localhost:27018 (external) or mongodb:27017 (internal)

### 🧪 VERIFICATION STEPS

After restoration, verify everything works:

1. **Check containers**:
```bash
docker-compose ps
```

2. **Test main application**:
```bash
curl -I http://localhost:3200
```

3. **Test login**:
- Go to http://localhost:3200
- Login with pro@obe.org.pk / proadmin123

4. **Test database connection**:
- Go to Pro Admin → Settings
- Check MongoDB connection status

### 🚨 TROUBLESHOOTING

If something doesn't work:

1. **Check logs**:
```bash
docker logs obe-portal
docker logs obe-mongodb
```

2. **Restart services**:
```bash
docker-compose restart
```

3. **Rebuild if needed**:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

4. **Run diagnostic script**:
```bash
chmod +x CHECK-AND-FORCE-UPDATE.sh
./CHECK-AND-FORCE-UPDATE.sh
```

### 📞 SUPPORT

If you need help:
1. Check the logs first
2. Try the troubleshooting steps
3. Use the diagnostic script
4. Check the COMPLETE-PROJECT-DOCUMENTATION.md file

### 🎯 IMPORTANT NOTES

- Always use the latest code from GitHub: https://github.com/riabha/OBE
- The application runs on port 3200 (not 3000)
- MongoDB external access is on port 27018
- All passwords are in the documentation files
- Keep backup files safe for future restoration