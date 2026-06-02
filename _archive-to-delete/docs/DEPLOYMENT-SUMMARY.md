# 🚀 Docker Deployment Summary - QUEST OBE Portal

## 📊 What We've Set Up

Your QUEST OBE Portal is now ready for Docker deployment with:

### ✅ Created Files:

1. **Dockerfile** - Builds your Node.js application container
2. **docker-compose.yml** - Orchestrates all services (app + MongoDB)
3. **docker-compose.prod.yml** - Production version with enhanced security
4. **.env.docker** - Environment variables template
5. **.dockerignore** - Excludes unnecessary files from Docker build
6. **mongo-init.js** - Initializes MongoDB with proper collections
7. **docker-commands.sh** - Interactive management script
8. **DOCKER-DEPLOYMENT-GUIDE.md** - Complete deployment documentation
9. **QUICK-START.md** - Fast deployment guide

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host (VPS)                     │
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐    │
│  │   obe-portal     │────────▶│   obe-mongodb    │    │
│  │   (Node.js 22)   │         │   (MongoDB 7.0)  │    │
│  │   Port: 3000     │         │   Port: 27017    │    │
│  └──────────────────┘         └──────────────────┘    │
│          │                             │               │
│          └─────────────┬───────────────┘               │
│                        │                               │
│              ┌─────────▼─────────┐                    │
│              │  Docker Network   │                    │
│              │  (obe-network)    │                    │
│              └───────────────────┘                    │
│                                                        │
│  Persistent Volumes:                                  │
│  • mongodb_data (Database files)                      │
│  • app_uploads (User uploaded files)                  │
└────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Architecture

### MongoDB Multi-Tenant Setup:

```
MongoDB Container (obe-mongodb)
│
├── 🏛️ obe_platform (Platform Database)
│   ├── platformusers (Pro Super Admin + University Admins)
│   ├── universities (All registered universities)
│   └── subscriptions (Billing & subscription info)
│
├── 🎓 obe_university_quest (QUEST University - Auto-created)
│   ├── _metadata
│   ├── departments
│   ├── users (Students, Teachers, Staff)
│   ├── courses
│   ├── sections
│   ├── enrollments
│   ├── assessments
│   ├── results
│   ├── clos (Course Learning Outcomes)
│   ├── plos (Program Learning Outcomes)
│   ├── attainments
│   └── reports
│
├── 🎓 obe_university_uok (UOK University - Auto-created)
│   └── ... (same structure)
│
└── 🎓 obe_university_xxx (More universities...)
    └── ... (same structure)
```

**Key Features:**
- ✅ Each university gets its own isolated database
- ✅ Automatic database creation when university registers
- ✅ Complete data isolation between universities
- ✅ Flexible and scalable architecture
- ✅ All collections auto-created with proper schemas

---

## 🚀 Deployment Steps (On Your VPS)

### 1. Prerequisites Check

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Check Docker installation
docker --version
docker-compose --version

# If not installed:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Upload Project Files

**Option A: Git (Recommended)**
```bash
cd /opt
git clone https://github.com/yourusername/OBE.git
cd OBE
```

**Option B: SCP from Windows**
```powershell
# From your Windows machine
scp -r D:\Kiro\OBE\OBE user@your-vps-ip:/opt/OBE
```

### 3. Configure Environment

```bash
cd /opt/OBE

# Copy environment template
cp .env.docker .env

# Generate secure secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For SESSION_SECRET

# Edit .env file
nano .env
```

**Required values in .env:**
```env
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=YourSecurePassword123!@#
JWT_SECRET=<generated-secret-from-above>
SESSION_SECRET=<generated-secret-from-above>
APP_PORT=3000
```

### 4. Deploy

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 5. Verify

```bash
# Check application health
curl http://localhost:3000/api/health

# Expected response:
# {"status":"OK","message":"QUEST OBE Portal - Production Version","database":"connected"}

# Check MongoDB
docker exec obe-mongodb mongosh --eval "db.adminCommand('ping')"
```

### 6. Access Application

**Default Login:**
- URL: `http://your-vps-ip:3000`
- Email: `pro@obe.org.pk`
- Password: `proadmin123`

**⚠️ IMPORTANT: Change this password immediately!**

---

## 🔧 Management

### Using Interactive Script (Easiest)

```bash
# Make executable
chmod +x docker-commands.sh

# Run menu
./docker-commands.sh
```

**Available options:**
1. Start/Stop/Restart services
2. View logs (app, MongoDB, all)
3. Backup/Restore database
4. Connect to MongoDB shell
5. Update application
6. Check health and status
7. View resource usage
8. And more...

### Using Docker Compose Directly

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f obe-app

# Check status
docker-compose ps

# Update application
git pull
docker-compose down
docker-compose build --no-cache obe-app
docker-compose up -d
```

---

## 🌐 Domain Setup (Optional but Recommended)

### 1. Point Domain to VPS

In your domain registrar:
```
A Record: @ → your-vps-ip
A Record: www → your-vps-ip
```

### 2. Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### 3. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/obe-portal
```

Paste:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 10M;
}
```

### 4. Enable and Get SSL

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/obe-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 🔐 Security Checklist

### Immediate Actions:

- [ ] Change MongoDB root password in .env
- [ ] Generate and set strong JWT_SECRET
- [ ] Generate and set strong SESSION_SECRET
- [ ] Change default admin password (pro@obe.org.pk)
- [ ] Configure firewall

### Firewall Setup:

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Verify
sudo ufw status
```

**Important:** MongoDB port (27017) should NOT be exposed publicly. It's only accessible within Docker network.

### Regular Maintenance:

- [ ] Set up automated backups (daily recommended)
- [ ] Monitor disk space
- [ ] Review logs regularly
- [ ] Keep Docker images updated
- [ ] Rotate secrets periodically

---

## 💾 Backup Strategy

### Automated Daily Backups

Create backup script:
```bash
sudo nano /opt/backup-obe.sh
```

Paste:
```bash
#!/bin/bash
cd /opt/OBE
source .env
BACKUP_DIR="/opt/backups/obe"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup MongoDB
docker exec obe-mongodb mongodump \
  --uri="mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@localhost:27017" \
  --out=/backup/$DATE

docker cp obe-mongodb:/backup/$DATE $BACKUP_DIR/

# Compress
tar -czf $BACKUP_DIR/obe-backup-$DATE.tar.gz -C $BACKUP_DIR $DATE
rm -rf $BACKUP_DIR/$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make executable and schedule:
```bash
chmod +x /opt/backup-obe.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup-obe.sh") | crontab -
```

---

## 📊 Monitoring

### Check Container Health

```bash
# Container status
docker-compose ps

# Resource usage
docker stats --no-stream

# Disk usage
docker system df

# Application health
curl http://localhost:3000/api/health
```

### View Logs

```bash
# All logs
docker-compose logs -f

# Application only
docker-compose logs -f obe-app

# MongoDB only
docker-compose logs -f mongodb

# Last 100 lines
docker-compose logs --tail=100 obe-app
```

---

## 🐛 Troubleshooting

### Application Won't Start

```bash
# Check logs
docker-compose logs obe-app

# Common issues:
# 1. MongoDB not ready - wait 30 seconds
# 2. Missing .env file - copy from .env.docker
# 3. Port 3000 in use - change APP_PORT in .env
```

### MongoDB Connection Failed

```bash
# Check MongoDB is running
docker-compose ps mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Test connection
docker exec obe-mongodb mongosh --eval "db.adminCommand('ping')"

# Verify credentials in .env
cat .env | grep MONGO_ROOT
```

### Can't Access from Browser

```bash
# Check if port is open
sudo netstat -tlnp | grep 3000

# Check firewall
sudo ufw status

# Test locally
curl http://localhost:3000/api/health

# If using Nginx
sudo nginx -t
sudo systemctl status nginx
```

### Database Issues

```bash
# Connect to MongoDB shell
docker exec -it obe-mongodb mongosh -u admin -p

# List databases
show dbs

# Use platform database
use obe_platform

# Check collections
show collections

# View platform users
db.platformusers.find().pretty()
```

---

## 🔄 Updates and Maintenance

### Update Application Code

```bash
cd /opt/OBE

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache obe-app
docker-compose up -d

# Check logs
docker-compose logs -f obe-app
```

### Update Docker Images

```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Clean old images
docker image prune -a
```

---

## 📈 Scaling Considerations

### Current Setup:
- Single VPS deployment
- MongoDB and App on same host
- Suitable for small to medium deployments

### Future Scaling Options:
1. **Separate MongoDB Server**: Move MongoDB to dedicated server
2. **Load Balancer**: Add multiple app containers behind load balancer
3. **MongoDB Replica Set**: For high availability
4. **CDN**: For static assets
5. **Redis**: For session management and caching

---

## 📞 Support and Resources

### Documentation Files:
- `DOCKER-DEPLOYMENT-GUIDE.md` - Complete deployment guide
- `QUICK-START.md` - Fast deployment steps
- `README.md` - Application overview
- `DATABASE-SETUP.md` - Database architecture details
- `MONGODB-ARCHITECTURE-EXPLAINED.md` - Multi-tenant architecture

### Useful Commands Reference:
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Backup database
./docker-commands.sh  # Select option 8

# Restore database
./docker-commands.sh  # Select option 9

# Connect to MongoDB
docker exec -it obe-mongodb mongosh -u admin -p

# Check health
curl http://localhost:3000/api/health
```

---

## ✅ Final Checklist

### Before Going Live:

- [ ] Docker and Docker Compose installed
- [ ] Project files uploaded to VPS
- [ ] .env file configured with secure values
- [ ] Containers started successfully
- [ ] Application accessible via browser
- [ ] Default admin password changed
- [ ] Domain configured (if using)
- [ ] SSL certificate installed (if using domain)
- [ ] Firewall configured
- [ ] Automated backups set up
- [ ] Monitoring in place
- [ ] Test university creation
- [ ] Test user login
- [ ] Test database operations

### Post-Deployment:

- [ ] Monitor logs for first 24 hours
- [ ] Test all major features
- [ ] Create first university
- [ ] Add test users
- [ ] Verify data isolation between universities
- [ ] Test backup and restore
- [ ] Document any custom configurations

---

## 🎯 Next Steps

1. **Deploy to VPS** using the steps above
2. **Test thoroughly** with sample data
3. **Configure domain and SSL** for production
4. **Set up monitoring** and alerts
5. **Train users** on the system
6. **Plan for scaling** as usage grows

---

## 🆘 Getting Help

**Before asking for help, collect this information:**

```bash
# System info
docker --version
docker-compose --version
uname -a

# Container status
docker-compose ps

# Recent logs
docker-compose logs --tail=50 obe-app
docker-compose logs --tail=50 mongodb

# Health check
curl http://localhost:3000/api/health

# Resource usage
docker stats --no-stream
df -h
```

**Contact:**
- GitHub Issues: [Your Repository]
- Email: support@quest.edu.pk

---

## 🎉 Success Indicators

You'll know deployment is successful when:

✅ `docker-compose ps` shows all containers as "Up" and "healthy"
✅ `curl http://localhost:3000/api/health` returns `{"status":"OK"}`
✅ You can login at `http://your-domain.com/login.html`
✅ You can create a new university
✅ University database is auto-created
✅ University super admin can login
✅ Data is isolated between universities

---

**Made with ❤️ for QUEST University**
**Docker Deployment Ready** 🐳

**Version:** 1.0.0
**Last Updated:** March 13, 2025
