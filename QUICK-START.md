# 🚀 Quick Start Guide - Docker Deployment

## For Your VPS Server

### Step 1: Connect to Your VPS

```bash
ssh user@your-vps-ip
```

### Step 2: Check Your Existing Docker Setup

Run these commands to understand your current Docker environment:

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# List Docker networks
docker network ls

# List Docker volumes
docker volume ls

# Check which ports are in use
sudo netstat -tlnp | grep LISTEN
```

**Send me the output of these commands so I can help you integrate with your existing setup!**

---

### Step 3: Upload OBE Portal Files

**Option A: Using Git (Recommended)**
```bash
cd /opt
git clone https://github.com/yourusername/OBE.git
cd OBE
```

**Option B: Using SCP from your local machine**
```bash
# From your Windows machine (in PowerShell)
scp -r D:\Kiro\OBE\OBE user@your-vps-ip:/opt/OBE
```

---

### Step 4: Configure Environment

```bash
cd /opt/OBE

# Copy environment template
cp .env.docker .env

# Edit with your secure values
nano .env
```

**Important: Change these values!**
```env
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=YourSecurePassword123!@#
JWT_SECRET=your-random-jwt-secret-min-32-characters-long
SESSION_SECRET=your-random-session-secret-min-32-characters
APP_PORT=3000
```

**Generate secure secrets:**
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate session secret
openssl rand -base64 32
```

---

### Step 5: Deploy

```bash
# Make sure you're in the project directory
cd /opt/OBE

# Start all services
docker-compose up -d

# Check if containers are running
docker-compose ps

# View logs
docker-compose logs -f
```

**Expected output:**
```
✅ obe-mongodb    - Running (healthy)
✅ obe-portal     - Running (healthy)
```

---

### Step 6: Verify Deployment

```bash
# Check application health
curl http://localhost:3000/api/health

# Expected response:
# {"status":"OK","message":"QUEST OBE Portal - Production Version","database":"connected"}

# Check MongoDB
docker exec obe-mongodb mongosh --eval "db.adminCommand('ping')"

# Expected response:
# { ok: 1 }
```

---

### Step 7: Access Your Application

**If using domain:**
```
https://your-domain.com
```

**If using IP:**
```
http://your-vps-ip:3000
```

**Default Login:**
- Email: `pro@obe.org.pk`
- Password: `proadmin123`

**⚠️ Change this password immediately after first login!**

---

## 🔧 Management Commands

### Use the Helper Script

```bash
# Make script executable
chmod +x docker-commands.sh

# Run interactive menu
./docker-commands.sh
```

### Or Use Docker Compose Directly

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
```

---

## 🌐 Setting Up Domain Access (Optional)

If you want to access via domain name with SSL:

### 1. Point your domain to VPS IP

In your domain registrar (e.g., Namecheap, GoDaddy):
```
A Record: @ → your-vps-ip
A Record: www → your-vps-ip
```

### 2. Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### 3. Create Nginx config

```bash
sudo nano /etc/nginx/sites-available/obe-portal
```

Paste this:
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

### 4. Enable site

```bash
sudo ln -s /etc/nginx/sites-available/obe-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Get SSL certificate

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 🔐 Security Checklist

- [ ] Changed default MongoDB password
- [ ] Changed JWT_SECRET and SESSION_SECRET
- [ ] Changed default admin password (pro@obe.org.pk)
- [ ] Configured firewall (allow only 22, 80, 443)
- [ ] Set up SSL certificate
- [ ] Configured regular backups
- [ ] MongoDB port (27017) NOT exposed publicly

---

## 📊 Database Information

### Multi-Database Architecture

Your application uses MongoDB with automatic database creation:

```
MongoDB Container
├── obe_platform (Main platform database)
│   ├── platformusers (All admin accounts)
│   ├── universities (University registrations)
│   └── subscriptions (Billing info)
│
├── obe_university_quest (Auto-created for QUEST)
│   ├── users (Students, teachers)
│   ├── departments
│   ├── courses
│   └── ... (all university data)
│
└── obe_university_xxx (Auto-created for each university)
```

### Access MongoDB Shell

```bash
# Connect to MongoDB
docker exec -it obe-mongodb mongosh -u admin -p

# List all databases
show dbs

# Use platform database
use obe_platform

# List collections
show collections

# View platform users
db.platformusers.find().pretty()

# View universities
db.universities.find().pretty()
```

---

## 🔄 Backup and Restore

### Create Backup

```bash
# Using helper script
./docker-commands.sh
# Select option 8

# Or manually
docker exec obe-mongodb mongodump \
  --uri="mongodb://admin:password@localhost:27017" \
  --out=/backup/$(date +%Y%m%d)

docker cp obe-mongodb:/backup/$(date +%Y%m%d) ./backups/
```

### Restore Backup

```bash
# Using helper script
./docker-commands.sh
# Select option 9

# Or manually
docker cp ./backups/20250313 obe-mongodb:/restore
docker exec obe-mongodb mongorestore \
  --uri="mongodb://admin:password@localhost:27017" \
  /restore
```

---

## 🐛 Troubleshooting

### Application won't start

```bash
# Check logs
docker-compose logs obe-app

# Common fixes:
# 1. Wait 30 seconds for MongoDB to be ready
# 2. Check .env file exists and has correct values
# 3. Check port 3000 is not in use: sudo netstat -tlnp | grep 3000
```

### MongoDB connection failed

```bash
# Check MongoDB is running
docker-compose ps mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Test connection
docker exec obe-mongodb mongosh --eval "db.adminCommand('ping')"
```

### Can't access from browser

```bash
# Check if port is open
sudo ufw status
sudo ufw allow 3000/tcp

# Check application is listening
curl http://localhost:3000/api/health

# If using Nginx, check config
sudo nginx -t
sudo systemctl status nginx
```

---

## 📞 Next Steps

1. ✅ Deploy application
2. ✅ Login and change default password
3. ✅ Create your first university
4. ✅ Set up domain and SSL (optional)
5. ✅ Configure automated backups
6. ✅ Set up monitoring

---

## 🆘 Need Help?

**Before asking for help, run these diagnostic commands:**

```bash
# Check container status
docker-compose ps

# Check application logs
docker-compose logs --tail=50 obe-app

# Check MongoDB logs
docker-compose logs --tail=50 mongodb

# Check application health
curl http://localhost:3000/api/health

# Check system resources
docker stats --no-stream
```

**Send the output of these commands for faster support!**

---

**Made with ❤️ for QUEST University**
