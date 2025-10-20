# 🚀 VPS Deployment Guide - QUEST OBE Portal

## 📋 Prerequisites

- Contabo VPS with Ubuntu/Debian
- SSH access to your VPS
- Git installed on VPS

## 🎯 Quick Deployment Steps

### 1. Connect to Your VPS
```bash
ssh root@your-vps-ip
```

### 2. Clone Repository
```bash
git clone https://github.com/riabha/OBE.git
cd OBE
```

### 3. Run Deployment Script
```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

### 4. Access Your Portal
- **Homepage**: http://your-vps-ip:3000
- **Login**: http://your-vps-ip:3000/login.html
- **Health Check**: http://your-vps-ip:3000/api/health

## 🔐 Demo Login Credentials
```
Email: pro@obe.org.pk
Password: proadmin123
Role: Pro Super Admin
```

## 📊 PM2 Management Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs quest-obe

# Restart application
pm2 restart quest-obe

# Stop application
pm2 stop quest-obe

# Start application
pm2 start quest-obe

# Delete application
pm2 delete quest-obe
```

## 🔧 Manual Deployment (Alternative)

If the deployment script doesn't work, follow these manual steps:

### 1. Install Node.js 22.x
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PM2
```bash
sudo npm install -g pm2
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment
```bash
cp config.env.production config.env
# Edit config.env with your VPS IP
```

### 5. Start Application
```bash
pm2 start server-production.js --name quest-obe --env production
pm2 save
pm2 startup
```

## 🌐 Firewall Configuration

Make sure port 3000 is open:

```bash
# Ubuntu/Debian
sudo ufw allow 3000
sudo ufw reload

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

## 🔍 Troubleshooting

### Check if application is running:
```bash
pm2 status
curl http://localhost:3000/api/health
```

### View application logs:
```bash
pm2 logs quest-obe
```

### Check if port is open:
```bash
netstat -tlnp | grep :3000
```

### Restart if needed:
```bash
pm2 restart quest-obe
```

## 📁 File Structure
```
OBE/
├── server-production.js    # Production server
├── config.env.production   # Production config template
├── deploy-vps.sh          # Deployment script
├── public/                # Static files
└── package.json           # Dependencies
```

## 🔄 Updates

To update your deployment:

```bash
cd OBE
git pull origin main
pm2 restart quest-obe
```

## 🆘 Support

If you encounter issues:
1. Check PM2 status: `pm2 status`
2. View logs: `pm2 logs quest-obe`
3. Restart: `pm2 restart quest-obe`
4. Check firewall: `sudo ufw status`

---

**Made with ❤️ for QUEST University**
