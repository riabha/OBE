# 🐳 Docker Deployment Guide - QUEST OBE Portal

## 📋 Overview

This guide will help you deploy the QUEST OBE Portal using Docker on your VPS server.

### Architecture:
```
┌─────────────────────────────────────────┐
│         Docker Host (VPS)               │
│                                         │
│  ┌──────────────┐    ┌──────────────┐ │
│  │  obe-portal  │───▶│ obe-mongodb  │ │
│  │  (Node.js)   │    │  (MongoDB)   │ │
│  │  Port: 3000  │    │  Port: 27017 │ │
│  └──────────────┘    └──────────────┘ │
│         │                    │         │
│         └────────┬───────────┘         │
│                  │                     │
│         ┌────────▼────────┐           │
│         │  Docker Network │           │
│         │  (obe-network)  │           │
│         └─────────────────┘           │
│                                         │
│  Volumes:                              │
│  • mongodb_data (Database files)       │
│  • app_uploads (User uploads)          │
└─────────────────────────────────────────┘
```

---

## 🚀 Quick Start (On Your VPS)

### Prerequisites on VPS:
```bash
# Check if Docker is installed
docker --version
docker-compose --version

# If not installed, install Docker:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 1: Upload Files to VPS

```bash
# On your local machine, create a deployment package
# (Or push to GitHub and clone on VPS)

# Option A: Using Git (Recommended)
ssh user@your-vps-ip
cd /opt
git clone https://github.com/yourusername/OBE.git
cd OBE

# Option B: Using SCP
# From your local machine:
scp -r /path/to/OBE user@your-vps-ip:/opt/
```

### Step 2: Configure Environment

```bash
# On VPS, in the project directory
cd /opt/OBE

# Copy environment template
cp .env.docker .env

# Edit with secure values
nano .env
```

**Update these values in .env:**
```env
# MongoDB Credentials (IMPORTANT: Change these!)
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=YourSecurePassword123!@#

# JWT Secrets (Generate random strings)
JWT_SECRET=your-random-jwt-secret-min-32-characters-long
SESSION_SECRET=your-random-session-secret-min-32-characters

# Application Port (default 3000)
APP_PORT=3000

# Optional: Mongo Express (Database GUI)
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=SecureGuiPassword123
```

### Step 3: Deploy

```bash
# Build and start all services
docker-compose up -d

# Check if containers are running
docker-compose ps

# View logs
docker-compose logs -f

# Check application logs specifically
docker-compose logs -f obe-app
```

### Step 4: Verify Deployment

```bash
# Check if MongoDB is running
docker exec obe-mongodb mongosh --eval "db.adminCommand('ping')"

# Check if application is responding
curl http://localhost:3000

# Check application health
curl http://localhost:3000/api/health
```

---

## 📊 Database Information

### MongoDB in Docker:

**Connection Details:**
- **Host**: mongodb (internal) or localhost:27017 (external)
- **Database**: obe_platform (main platform database)
- **Authentication**: Enabled with credentials from .env

**Multi-Database Architecture:**
```
MongoDB Container
├── obe_platform (Platform database)
│   ├── platformusers
│   ├── universities
│   └── subscriptions
├── obe_university_quest (Auto-created for QUEST)
├── obe_university_uok (Auto-created for UOK)
└── ... (More universities as registered)
```

**Data Persistence:**
- All data stored in Docker volume: `mongodb_data`
- Survives container restarts
- Located at: `/var/lib/docker/volumes/obe_mongodb_data/_data`

---

## 🔧 Common Commands

### Container Management:

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart obe-app

# View logs
docker-compose logs -f obe-app
docker-compose logs -f mongodb

# Execute commands in container
docker exec -it obe-portal sh
docker exec -it obe-mongodb mongosh
```

### Database Operations:

```bash
# Connect to MongoDB shell
docker exec -it obe-mongodb mongosh -u admin -p

# Backup database
docker exec obe-mongodb mongodump --uri="mongodb://admin:password@localhost:27017" --out=/backup
docker cp obe-mongodb:/backup ./mongodb-backup-$(date +%Y%m%d)

# Restore database
docker cp ./mongodb-backup obe-mongodb:/restore
docker exec obe-mongodb mongorestore --uri="mongodb://admin:password@localhost:27017" /restore

# View database size
docker exec obe-mongodb mongosh -u admin -p --eval "db.adminCommand('listDatabases')"
```

### Application Management:

```bash
# View application logs
docker-compose logs -f obe-app

# Restart application
docker-compose restart obe-app

# Update application (after code changes)
docker-compose down
docker-compose build --no-cache obe-app
docker-compose up -d

# Check application health
docker exec obe-portal node -e "console.log('App is running')"
```

---

## 🌐 Nginx Reverse Proxy Setup

To access your application via domain name with SSL:

### Step 1: Install Nginx (if not already installed)

```bash
sudo apt update
sudo apt install nginx
```

### Step 2: Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/obe-portal
```

**Add this configuration:**

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration (after getting certificates)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Docker container
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

    # Increase upload size limit
    client_max_body_size 10M;
}
```

### Step 3: Enable Site and Get SSL

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/obe-portal /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🔐 Security Best Practices

### 1. Firewall Configuration:

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# MongoDB port should NOT be exposed publicly
# It's only accessible within Docker network
```

### 2. Environment Variables:

- ✅ Never commit .env file to Git
- ✅ Use strong passwords (min 16 characters)
- ✅ Generate random JWT secrets
- ✅ Rotate secrets periodically

### 3. MongoDB Security:

```bash
# MongoDB is only accessible from Docker network
# External access is blocked by default

# To verify:
docker inspect obe-mongodb | grep IPAddress
# Should show internal Docker IP only
```

### 4. Regular Backups:

```bash
# Create backup script
cat > /opt/backup-obe.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/obe"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup MongoDB
docker exec obe-mongodb mongodump \
  --uri="mongodb://admin:${MONGO_ROOT_PASSWORD}@localhost:27017" \
  --out=/backup/$DATE

docker cp obe-mongodb:/backup/$DATE $BACKUP_DIR/

# Compress
tar -czf $BACKUP_DIR/obe-backup-$DATE.tar.gz $BACKUP_DIR/$DATE
rm -rf $BACKUP_DIR/$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/backup-obe.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup-obe.sh") | crontab -
```

---

## 📊 Monitoring

### View Resource Usage:

```bash
# Container stats
docker stats

# Disk usage
docker system df

# Volume size
docker volume inspect obe_mongodb_data
```

### Application Health:

```bash
# Check if app is responding
curl http://localhost:3000/api/health

# Check MongoDB connection
docker exec obe-mongodb mongosh --eval "db.serverStatus().connections"
```

---

## 🔄 Updates and Maintenance

### Update Application Code:

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

### Update Docker Images:

```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Clean old images
docker image prune -a
```

---

## 🐛 Troubleshooting

### Application won't start:

```bash
# Check logs
docker-compose logs obe-app

# Common issues:
# 1. MongoDB not ready - wait 30 seconds and check again
# 2. Environment variables missing - check .env file
# 3. Port already in use - change APP_PORT in .env
```

### MongoDB connection issues:

```bash
# Check if MongoDB is running
docker-compose ps mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Test connection
docker exec obe-mongodb mongosh -u admin -p --eval "db.adminCommand('ping')"
```

### Can't access from browser:

```bash
# Check if port is open
sudo netstat -tlnp | grep 3000

# Check firewall
sudo ufw status

# Check Nginx (if using)
sudo nginx -t
sudo systemctl status nginx
```

---

## 📞 Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Verify environment: `docker-compose config`
3. Check GitHub issues
4. Contact: support@quest.edu.pk

---

## ✅ Deployment Checklist

- [ ] Docker and Docker Compose installed on VPS
- [ ] Project files uploaded to VPS
- [ ] .env file configured with secure values
- [ ] Containers started: `docker-compose up -d`
- [ ] MongoDB accessible: `docker exec obe-mongodb mongosh`
- [ ] Application responding: `curl http://localhost:3000`
- [ ] Nginx configured (if using domain)
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Backup script set up
- [ ] Monitoring in place

---

**Made with ❤️ for QUEST University**
**Docker Deployment Ready** 🐳
