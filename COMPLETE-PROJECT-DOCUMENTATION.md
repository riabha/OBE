# 🚀 OBE PORTAL - COMPLETE PROJECT DOCUMENTATION

## 📋 PROJECT OVERVIEW

**Project Name**: OBE Portal (Outcome-Based Education Management System)
**Repository**: https://github.com/riabha/OBE
**Server**: VPS at 194.60.87.212
**Technology Stack**: Node.js, MongoDB, Docker, Bootstrap

---

## 🌐 DEPLOYMENT INFORMATION

### **Server Details**
- **IP Address**: 194.60.87.212
- **Main Application Port**: 3200
- **MongoDB External Port**: 27018
- **MongoDB Web Interface Port**: 8081
- **Operating System**: Linux (VPS)

### **Application URLs**
- **Main Application**: http://194.60.87.212:3200
- **Pro Super Admin**: http://194.60.87.212:3200/pro-super-admin-dashboard.html
- **University Super Admin**: http://194.60.87.212:3200/university-super-admin-dashboard.html
- **MongoDB Web Interface**: http://194.60.87.212:8081

### **Docker Configuration**
```yaml
# Main services in docker-compose.yml
services:
  - obe-app (Node.js application on port 3200)
  - mongodb (MongoDB database on port 27017 internal, 27018 external)
  - mongo-express (Web interface on port 8081)
```

---

## 🔐 CREDENTIALS AND ACCESS

### **Database Credentials**
```
MongoDB Admin:
- Username: admin
- Password: SecureOBE2025MongoDBQuest
- Auth Database: admin
- Internal Host: mongodb:27017 (Docker)
- External Host: 194.60.87.212:27018 (Direct access)
```

### **Application Credentials**
```
Pro Super Admin:
- Email: pro@obe.org.pk
- Password: proadmin123

University Super Admin:
- Email: (created when university is set up)
- Password: Admin@UNIVERSITYCODE2025
```

### **MongoDB Web Interface**
```
URL: http://194.60.87.212:8081
Username: admin
Password: (check .env file for MONGO_EXPRESS_PASSWORD)
```

---

## 🗄️ DATABASE ARCHITECTURE

### **Platform Database (obe_platform)**
**Purpose**: Stores system-wide information
**Collections**:
- `universities` - University information and settings
- `platformusers` - Platform administrators and university super admins
- `settings` - System configuration

### **University Databases (obe_demo, etc.)**
**Purpose**: Stores university-specific data
**Collections**:
- `users` - University users (teachers, students, staff)
- `departments` - Academic departments
- `courses` - Course information
- `programs` - Degree programs
- `assessments` - Assessments and evaluations
- `enrollments` - Student enrollments
- `results` - Assessment results

### **Database Connection Strings**
```bash
# Internal (Docker containers)
mongodb://admin:SecureOBE2025MongoDBQuest@mongodb:27017/DATABASE_NAME?authSource=admin

# External (direct access)
mongodb://admin:SecureOBE2025MongoDBQuest@194.60.87.212:27018/DATABASE_NAME?authSource=admin
```

---

## 🚀 DEPLOYMENT COMMANDS

### **Initial Deployment**
```bash
# Clone repository
git clone https://github.com/riabha/OBE.git
cd OBE

# Set up environment
cp config.env.example config.env
# Edit config.env with your settings

# Deploy with Docker
docker-compose up -d
```

### **Update Deployment**
```bash
cd /www/wwwroot/obe-portal
git pull origin main
docker-compose restart
```

### **Complete Rebuild**
```bash
cd /www/wwwroot/obe-portal
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 🔧 TROUBLESHOOTING SCRIPTS

### **Available Fix Scripts**
1. `CHECK-AND-FORCE-UPDATE.sh` - Complete diagnostic and force update
2. `FIX-DATABASE-ARCHITECTURE.sh` - Fix database connection issues
3. `FIX-MONGODB-SETTINGS.sh` - Fix MongoDB connection in settings
4. `POPULATE-DEMO-DATABASE.sh` - Create demo data
5. `ENABLE-MONGODB-WEB-INTERFACE.sh` - Enable web database management

### **Quick Diagnostic Commands**
```bash
# Check container status
docker-compose ps

# Check application logs
docker logs obe-portal

# Check MongoDB logs
docker logs obe-mongodb

# Test MongoDB connection
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin

# Test application response
curl -I http://194.60.87.212:3200
```

---

## 🎯 CURRENT ISSUES AND SOLUTIONS

### **Issue 1: University Dashboard Loading**
**Problem**: Shows "Loading..." instead of university name
**Solution**: Run `FINAL-COMPLETE-FIX.sh`
**Status**: Fixed with enhanced loadUniversityInfo function

### **Issue 2: Database Connection Test Failing**
**Problem**: MongoDB settings page shows "Failed! Connection failed"
**Solution**: Run `FIX-MONGODB-SETTINGS.sh`
**Status**: Fixed with proper Docker container names

### **Issue 3: Database List Not Showing**
**Problem**: Can't see all databases for assignment
**Solution**: Updated `/api/databases` endpoint to show all databases
**Status**: Fixed - now shows Platform, University, and Other databases

### **Issue 4: Demo Data Missing**
**Problem**: No sample users or data for testing
**Solution**: Run `POPULATE-DEMO-DATABASE.sh`
**Status**: Creates comprehensive demo data

---

## 📁 FILE STRUCTURE

### **Key Application Files**
```
/www/wwwroot/obe-portal/
├── server.js                          # Main application server
├── docker-compose.yml                 # Docker configuration
├── Dockerfile                         # Application container config
├── config.env                         # Environment variables
├── public/
│   ├── pro-super-admin-dashboard.html # Pro admin interface
│   ├── university-super-admin-dashboard.html # University admin interface
│   └── js/dashboard-common.js         # Shared dashboard functions
├── models/                            # Database models
└── utils/                             # Utility functions
```

### **Fix Scripts Created**
```
├── CHECK-AND-FORCE-UPDATE.sh          # Complete diagnostic and update
├── FIX-DATABASE-ARCHITECTURE.sh       # Database connection fixes
├── FIX-MONGODB-SETTINGS.sh           # MongoDB settings fixes
├── POPULATE-DEMO-DATABASE.sh          # Demo data creation
├── ENABLE-MONGODB-WEB-INTERFACE.sh    # Web interface setup
├── INTEGRATE-WEB-DATABASE-MANAGER.sh  # Database management integration
└── FINAL-COMPLETE-FIX.sh             # Comprehensive fixes
```

---

## 🔄 MAINTENANCE PROCEDURES

### **Daily Checks**
1. Check application status: `curl -I http://194.60.87.212:3200`
2. Check container health: `docker-compose ps`
3. Monitor disk space: `df -h`

### **Weekly Maintenance**
1. Update system packages
2. Check Docker logs for errors
3. Backup databases
4. Review application performance

### **Database Backup**
```bash
# Backup all databases
docker exec obe-mongodb mongodump -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --out /backup

# Backup specific database
docker exec obe-mongodb mongodump -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin -d obe_platform --out /backup
```

---

## 🚨 EMERGENCY PROCEDURES

### **If Application Won't Start**
```bash
# 1. Check container status
docker-compose ps

# 2. Check logs
docker logs obe-portal
docker logs obe-mongodb

# 3. Restart services
docker-compose restart

# 4. If still failing, rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### **If Database Connection Lost**
```bash
# 1. Check MongoDB container
docker logs obe-mongodb

# 2. Restart MongoDB
docker-compose restart mongodb

# 3. Test connection
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin

# 4. If data lost, restore from backup
docker exec obe-mongodb mongorestore -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin /backup
```

---

## 📞 SUPPORT INFORMATION

### **Repository Information**
- **GitHub**: https://github.com/riabha/OBE
- **Branch**: main
- **Last Updated**: [Current Date]

### **Key Configuration Files**
- `config.env` - Environment variables
- `docker-compose.yml` - Docker services
- `server.js` - Main application logic

### **Important Environment Variables**
```bash
MONGODB_URI=mongodb://admin:SecureOBE2025MongoDBQuest@mongodb:27017/obe_platform?authSource=admin
JWT_SECRET=OBE2025SecureJWTSecretForQuestUniversityPortal123456789
SESSION_SECRET=QuestOBESessionSecret2025SecureRandomString987654321
APP_PORT=3200
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=SecureOBE2025MongoDBQuest
```

---

## 🎯 NEXT STEPS AND TODO

### **Immediate Actions Needed**
1. Run `CHECK-AND-FORCE-UPDATE.sh` to apply all pending fixes
2. Test all dashboard functionalities
3. Verify database connections and listings
4. Create proper backup procedures

### **Future Enhancements**
1. Set up automated backups
2. Implement SSL/HTTPS
3. Add monitoring and alerting
4. Optimize database performance
5. Add user documentation

---

## 📝 CHANGE LOG

### **Recent Changes**
- Fixed university dashboard loading issue
- Enhanced MongoDB connection handling
- Added comprehensive database listing
- Created demo data population scripts
- Improved error handling and diagnostics

### **Scripts Created for Fixes**
- Database architecture fixes
- MongoDB settings corrections
- Demo data population
- Web interface integration
- Complete diagnostic tools

---

**📅 Document Created**: [Current Date]
**📍 Server Location**: /www/wwwroot/obe-portal/
**🔄 Last Updated**: [Current Date]

**⚠️ IMPORTANT**: Keep this documentation updated with any changes made to the system.