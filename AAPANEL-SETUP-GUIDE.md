# 🎯 aaPanel Setup Guide - QUEST OBE Portal

## 📋 Prerequisites

✅ VPS with aaPanel installed  
✅ Files uploaded to VPS  
✅ SSH access (optional, can use aaPanel terminal)  

---

## 🚀 Step-by-Step Setup in aaPanel

### **Step 1: Access aaPanel**

1. Open your browser
2. Go to: `http://YOUR_VPS_IP:7800` or `http://YOUR_VPS_IP:8888`
3. Login with your aaPanel credentials

---

### **Step 2: Install Node.js via aaPanel**

1. **Click on "App Store"** (left sidebar)
2. **Search for "PM2"** or **"Node.js"**
3. **Install "PM2 Manager"** (this will install Node.js automatically)
4. Select **Node.js version 22.x** (or latest available)
5. Click **Install** and wait for completion

**Alternative via Terminal:**
```bash
# In aaPanel Terminal or SSH
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

---

### **Step 3: Upload/Locate Your Project Files**

**Option A: Via aaPanel File Manager**
1. Click **"Files"** in left sidebar
2. Navigate to `/www/wwwroot/`
3. Create new folder: `quest-obe`
4. Upload your project files to `/www/wwwroot/quest-obe/`

**Option B: Via SSH/Git**
```bash
cd /www/wwwroot/
git clone https://github.com/riabha/OBE.git quest-obe
cd quest-obe
```

Your project should be at: `/www/wwwroot/quest-obe/`

---

### **Step 4: Install Project Dependencies**

**Via aaPanel Terminal:**
1. Click **"Terminal"** button (top right in aaPanel)
2. Run these commands:

```bash
cd /www/wwwroot/quest-obe
npm install
```

Wait for all dependencies to install (this may take 2-3 minutes).

---

### **Step 5: Configure Environment**

**Via aaPanel File Manager:**
1. Navigate to `/www/wwwroot/quest-obe/`
2. Find `config.env.vps` file
3. Click **"Edit"**
4. Copy the contents
5. Create new file named `config.env`
6. Paste the contents
7. **Update the PORT if needed** (default is 3000)
8. Save the file

**Or via Terminal:**
```bash
cd /www/wwwroot/quest-obe
cp config.env.vps config.env
```

---

### **Step 6: Open Firewall Port**

**Via aaPanel Security:**
1. Click **"Security"** in left sidebar
2. Scroll to **"Firewall"** section
3. Add new rule:
   - **Port**: `3000`
   - **Protocol**: `TCP`
   - **Note**: `QUEST OBE Portal`
4. Click **"Release"** or **"Add"**

**Or via Terminal:**
```bash
sudo ufw allow 3000
sudo ufw reload
```

---

### **Step 7: Start Application with PM2**

**Option A: Via PM2 Manager (Recommended)**

1. Click **"App Store"** → **"PM2 Manager"** → **"Settings"**
2. Click **"Add Project"**
3. Fill in details:
   - **Project Name**: `quest-obe`
   - **Project Directory**: `/www/wwwroot/quest-obe`
   - **Startup File**: `server-production.js`
   - **Run Mode**: `Production`
   - **Number of Instances**: `1`
4. Click **"Submit"**
5. Your app will start automatically!

**Option B: Via Terminal**

```bash
cd /www/wwwroot/quest-obe
pm2 start server-production.js --name quest-obe
pm2 save
pm2 startup
```

---

### **Step 8: Verify Installation**

**Check PM2 Status:**
```bash
pm2 status
```

You should see:
```
┌─────┬────────────┬─────────┬─────────┬──────────┐
│ id  │ name       │ mode    │ status  │ cpu      │
├─────┼────────────┼─────────┼─────────┼──────────┤
│ 0   │ quest-obe  │ fork    │ online  │ 0%       │
└─────┴────────────┴─────────┴─────────┴──────────┘
```

**Access Your Portal:**
- **Homepage**: `http://YOUR_VPS_IP:3000`
- **Login Page**: `http://YOUR_VPS_IP:3000/login.html`
- **Health Check**: `http://YOUR_VPS_IP:3000/api/health`

---

### **Step 9: Setup Domain (Optional)**

If you have a domain name:

1. **Add Website in aaPanel:**
   - Click **"Website"** → **"Add Site"**
   - Domain: `yourdomain.com`
   - Project Directory: `/www/wwwroot/quest-obe/public`
   - PHP Version: **Pure Static** (we're using Node.js)
   - Submit

2. **Setup Reverse Proxy:**
   - Click on your domain in website list
   - Go to **"Reverse Proxy"** tab
   - Enable Reverse Proxy
   - Target URL: `http://127.0.0.1:3000`
   - Click **"Save"**

3. **Enable SSL (Optional):**
   - Go to **"SSL"** tab
   - Select **"Let's Encrypt"**
   - Enter your email
   - Click **"Apply"**

Now access: `https://yourdomain.com`

---

## 🔐 Demo Login Credentials

```
📧 Email:    pro@obe.org.pk
🔑 Password: proadmin123
👑 Role:     Pro Super Admin
```

---

## 📊 PM2 Management Commands

**View Logs:**
```bash
pm2 logs quest-obe
```

**Restart Application:**
```bash
pm2 restart quest-obe
```

**Stop Application:**
```bash
pm2 stop quest-obe
```

**Start Application:**
```bash
pm2 start quest-obe
```

**Delete Application:**
```bash
pm2 delete quest-obe
```

**Monitor in Real-time:**
```bash
pm2 monit
```

---

## 🔧 Troubleshooting

### ❌ "Cannot find module 'express'"
**Solution:** Install dependencies
```bash
cd /www/wwwroot/quest-obe
npm install
```

### ❌ "Port 3000 is already in use"
**Solution:** Stop the conflicting process
```bash
pm2 stop all
pm2 delete quest-obe
pm2 start server-production.js --name quest-obe
```

Or change PORT in `config.env`:
```
PORT=3001
```

### ❌ "Cannot access http://YOUR_IP:3000"
**Solutions:**
1. Check if app is running: `pm2 status`
2. Check firewall: `sudo ufw status`
3. Open port 3000: `sudo ufw allow 3000`
4. Check logs: `pm2 logs quest-obe`

### ❌ "502 Bad Gateway" (when using domain)
**Solution:** Check reverse proxy settings
- Target URL should be: `http://127.0.0.1:3000`
- Make sure PM2 app is running: `pm2 status`

### ❌ Node.js version issues
**Solution:** Install correct version
```bash
# Check current version
node --version

# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 🔄 Update/Redeploy Application

```bash
cd /www/wwwroot/quest-obe
git pull origin main
npm install
pm2 restart quest-obe
```

Or via aaPanel:
1. Upload new files via File Manager
2. Go to PM2 Manager
3. Click **"Restart"** on `quest-obe` project

---

## 📁 Important File Paths

```
/www/wwwroot/quest-obe/              # Project root
/www/wwwroot/quest-obe/public/       # Static files (HTML, CSS, JS)
/www/wwwroot/quest-obe/config.env    # Environment configuration
/www/wwwroot/quest-obe/server-production.js  # Production server
~/.pm2/logs/quest-obe-out.log        # Application logs
~/.pm2/logs/quest-obe-error.log      # Error logs
```

---

## 🛡️ Security Recommendations

1. **Change default credentials** (after testing)
2. **Enable firewall** and only open necessary ports
3. **Setup SSL certificate** for domain (free with Let's Encrypt)
4. **Regular backups** via aaPanel backup feature
5. **Keep Node.js and dependencies updated**

---

## 📞 Quick Reference

| Action | Command/Location |
|--------|-----------------|
| Access aaPanel | `http://YOUR_IP:7800` or `:8888` |
| Project Directory | `/www/wwwroot/quest-obe/` |
| Check Status | `pm2 status` |
| View Logs | `pm2 logs quest-obe` |
| Restart App | `pm2 restart quest-obe` |
| Access Portal | `http://YOUR_IP:3000` |
| Login Page | `http://YOUR_IP:3000/login.html` |

---

## ✅ Post-Installation Checklist

- [ ] Node.js installed (version 22.x)
- [ ] PM2 installed globally
- [ ] Project files in `/www/wwwroot/quest-obe/`
- [ ] Dependencies installed (`npm install`)
- [ ] `config.env` file created
- [ ] Port 3000 opened in firewall
- [ ] Application started with PM2
- [ ] Can access `http://YOUR_IP:3000`
- [ ] Can login with demo credentials
- [ ] PM2 set to auto-start on reboot

---

## 🎉 Success!

If you can:
1. ✅ Access `http://YOUR_IP:3000/api/health` and see `"status": "OK"`
2. ✅ Login with `pro@obe.org.pk` / `proadmin123`
3. ✅ See PM2 status as `online`

**Your QUEST OBE Portal is successfully deployed!** 🚀

---

## 🆘 Need Help?

1. Check PM2 logs: `pm2 logs quest-obe`
2. Check application health: `http://YOUR_IP:3000/api/health`
3. Verify firewall rules in aaPanel Security
4. Check Node.js version: `node --version`

---

**Made with ❤️ for QUEST University**
**Deployed via aaPanel**

