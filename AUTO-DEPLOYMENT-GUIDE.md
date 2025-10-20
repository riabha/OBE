# 🔄 Auto-Deployment from GitHub - Setup Guide

This guide will help you set up automatic deployment whenever you push to GitHub.

---

## 📋 How It Works

```
Developer pushes code to GitHub
        ↓
GitHub sends webhook to your VPS
        ↓
Webhook server receives notification
        ↓
Automatically runs:
  1. git pull origin main
  2. npm install
  3. pm2 restart obe
        ↓
Your website is updated! ✅
```

---

## 🚀 Setup Instructions

### **Step 1: Upload Webhook Files to VPS**

Make sure these files are in `/www/wwwroot/obe/`:
- ✅ `deploy-webhook.js`
- ✅ `config.webhook.env`

```bash
cd /www/wwwroot/obe
ls -la deploy-webhook.js config.webhook.env
```

---

### **Step 2: Configure Webhook Settings**

Edit the webhook config:

```bash
cd /www/wwwroot/obe
nano config.webhook.env
```

Update these values:
```bash
WEBHOOK_PORT=9000
WEBHOOK_SECRET=MySecureWebhookSecret123!
PROJECT_PATH=/www/wwwroot/obe
PM2_APP_NAME=obe
```

**Save:** `Ctrl+X`, then `Y`, then `Enter`

---

### **Step 3: Open Firewall Port 9000**

#### **Via aaPanel:**
1. Go to **Security**
2. Add port **9000**
3. Protocol: **TCP**
4. Click **"Release"**

#### **Via Terminal:**
```bash
ufw allow 9000
ufw reload
```

---

### **Step 4: Start Webhook Server with PM2**

```bash
cd /www/wwwroot/obe

# Start webhook server
pm2 start deploy-webhook.js --name obe-webhook --env production

# Save PM2 configuration
pm2 save

# Check status
pm2 status
```

You should see:
```
┌────┬──────────────┬─────────┬─────────┐
│ id │ name         │ status  │ restart │
├────┼──────────────┼─────────┼─────────┤
│ 0  │ obe          │ online  │ 0       │
│ 1  │ obe-webhook  │ online  │ 0       │
└────┴──────────────┴─────────┴─────────┘
```

---

### **Step 5: Test Webhook Server**

```bash
# Test health endpoint
curl http://localhost:9000/webhook/health

# Should return:
# {"status":"OK","service":"GitHub Webhook Handler",...}
```

---

### **Step 6: Setup GitHub Webhook**

1. **Go to your GitHub repository**
   - https://github.com/riabha/OBE

2. **Click "Settings"** tab

3. **Click "Webhooks"** in left sidebar

4. **Click "Add webhook"**

5. **Fill in webhook details:**
   ```
   Payload URL: http://194.60.87.212:9000/webhook/deploy
   
   Content type: application/json
   
   Secret: MySecureWebhookSecret123!
   (Same as in config.webhook.env)
   
   Which events: Just the push event
   
   Active: ✅ Check this
   ```

6. **Click "Add webhook"**

---

### **Step 7: Test Deployment**

Make a small change in your local repository:

```bash
# On your local machine
cd D:\Cursor\gitobe\OBE

# Make a small change
echo "# Auto-deployment test" >> README.md

# Commit and push
git add .
git commit -m "Test auto-deployment"
git push origin main
```

**Watch deployment happen:**

```bash
# On VPS - watch logs
pm2 logs obe-webhook --lines 50
```

You should see:
```
📥 Webhook received
📊 Branch: main
🚀 Starting deployment...
📥 Pulling latest code...
📦 Installing dependencies...
🔄 Restarting PM2 app...
✅ Deployment completed successfully!
```

---

## 🎯 Alternative: aaPanel PM2 Manager Setup

If you prefer using aaPanel interface:

1. **Go to aaPanel → PM2 Manager**
2. **Click "Add Project"**
3. Fill in:
   ```
   Path: /www/wwwroot/obe
   Name: obe-webhook
   Run opt: Custom command → node deploy-webhook.js
   Port: 9000
   User: www
   Node: v22.20.0
   ```
4. Click **"Submit"**

---

## 📊 PM2 Management Commands

```bash
# View webhook logs
pm2 logs obe-webhook

# Restart webhook server
pm2 restart obe-webhook

# Stop webhook server
pm2 stop obe-webhook

# Check status
pm2 status

# Monitor in real-time
pm2 monit
```

---

## 🔍 Troubleshooting

### ❌ Webhook not triggering

**Check 1: Is webhook server running?**
```bash
pm2 status
curl http://localhost:9000/webhook/health
```

**Check 2: Is port 9000 open?**
```bash
netstat -tlnp | grep 9000
ufw status | grep 9000
```

**Check 3: Check GitHub webhook deliveries**
- Go to GitHub → Settings → Webhooks
- Click on your webhook
- Check "Recent Deliveries"
- Look for errors

**Check 4: View webhook logs**
```bash
pm2 logs obe-webhook --lines 100
```

---

### ❌ Deployment fails

**Check git credentials:**
```bash
cd /www/wwwroot/obe
git pull origin main
# If asks for password, setup SSH key or token
```

**Check permissions:**
```bash
chown -R www:www /www/wwwroot/obe
```

---

## 🔐 Security Best Practices

1. **Use a strong webhook secret**
   ```bash
   # Generate random secret
   openssl rand -hex 32
   ```

2. **Uncomment signature verification in deploy-webhook.js**
   ```javascript
   // Uncomment these lines:
   if (!verifySignature(req)) {
       console.log('❌ Invalid signature');
       return res.status(401).json({ error: 'Invalid signature' });
   }
   ```

3. **Use GitHub deploy keys** (instead of password)
   ```bash
   # Generate SSH key on VPS
   ssh-keygen -t ed25519 -C "deploy@obe.org.pk"
   
   # Add public key to GitHub
   cat ~/.ssh/id_ed25519.pub
   # Copy and add to: GitHub → Settings → Deploy keys
   ```

---

## 🎉 Success Checklist

- [x] Webhook files uploaded
- [x] Config file updated with secret
- [x] Port 9000 open in firewall
- [x] Webhook server running in PM2
- [x] GitHub webhook configured
- [x] Test push successful
- [x] Auto-deployment working!

---

## 🚀 Workflow After Setup

**Your development workflow:**

```bash
# 1. Make changes locally
code .

# 2. Test locally
npm start

# 3. Commit changes
git add .
git commit -m "Add new feature"

# 4. Push to GitHub
git push origin main

# 5. Website updates automatically! ✨
# (Check: pm2 logs obe-webhook)
```

---

## 📝 Webhook Endpoint Reference

```
Health Check:
GET http://194.60.87.212:9000/webhook/health

Deployment Webhook:
POST http://194.60.87.212:9000/webhook/deploy
(Only GitHub should call this)
```

---

## 🔄 Update Webhook Server

If you need to update the webhook server itself:

```bash
cd /www/wwwroot/obe
# Edit deploy-webhook.js
nano deploy-webhook.js

# Restart webhook server
pm2 restart obe-webhook
```

---

**Made with ❤️ for QUEST University OBE Portal**
**Auto-deployment makes development faster and easier!** 🚀

