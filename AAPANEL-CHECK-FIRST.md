# ✅ aaPanel - Check Installed Services First

Before installing anything, let's check what's already available on your VPS!

---

## 🔍 Step 1: Check Currently Installed Services

### **Via aaPanel Dashboard**

1. **Login to aaPanel**
   - Go to: `http://YOUR_VPS_IP:7800` or `http://YOUR_VPS_IP:8888`
   - Login with your credentials

2. **Check App Store**
   - Click **"App Store"** in left sidebar
   - Look at the **"Installed"** tab
   - Make note of what's installed:
     - ✅ **Node.js** (check version)
     - ✅ **PM2 Manager**
     - ✅ **MongoDB**
     - ✅ **Nginx**
     - ✅ **Any other services**

3. **Check Dashboard**
   - On main dashboard, you'll see installed services/software
   - Take a screenshot or write down what you see

---

## 🖥️ Step 2: Check via Terminal

### **Open aaPanel Terminal**
Click **"Terminal"** button (top right corner in aaPanel)

### **Run These Checks:**

```bash
# Check Node.js
echo "=== Node.js ==="
node --version
npm --version
echo ""

# Check PM2
echo "=== PM2 ==="
pm2 --version
pm2 list
echo ""

# Check MongoDB
echo "=== MongoDB ==="
mongod --version
systemctl status mongod
echo ""

# Check Nginx
echo "=== Nginx ==="
nginx -v
systemctl status nginx
echo ""

# Check running services
echo "=== Running Services ==="
systemctl list-units --type=service --state=running | grep -E 'node|mongo|nginx|pm2'
echo ""

# Check open ports
echo "=== Open Ports ==="
netstat -tlnp | grep -E '3000|27017|80|443'
echo ""

# Check if our project exists
echo "=== Project Directory ==="
ls -la /www/wwwroot/ | grep -i quest || echo "No quest-obe folder found"
ls -la /www/wwwroot/quest-obe/ 2>/dev/null || echo "Project not uploaded yet"
echo ""

# Check system info
echo "=== System Info ==="
uname -a
cat /etc/os-release | grep PRETTY_NAME
free -h
df -h /
```

---

## 📋 Step 3: Report Your Findings

After running the checks, tell me what you found:

### **Checklist:**

- [ ] **Node.js installed?** (Version: ______)
- [ ] **PM2 installed?** (Version: ______)
- [ ] **MongoDB installed?** (Version: ______)
- [ ] **Nginx installed?** (Version: ______)
- [ ] **Project files uploaded?** (Location: ______)
- [ ] **Port 3000 open?** (Yes/No)
- [ ] **Any apps already running in PM2?** (List: ______)

---

## 🎯 What to Look For:

### ✅ **BEST CASE - Everything Ready:**
```
Node.js: v22.x.x ✅
PM2: 5.x.x ✅
MongoDB: 7.x.x ✅
Nginx: 1.x.x ✅
Project: /www/wwwroot/quest-obe ✅
```
➡️ **Next Step:** Just configure and start your app!

### ⚠️ **PARTIAL - Some Missing:**
```
Node.js: v18.x.x ⚠️ (need v22.x)
PM2: Not found ❌
MongoDB: 7.0.8 ✅
Project: Uploaded ✅
```
➡️ **Next Step:** Install/upgrade missing components

### ❌ **FRESH - Nothing Installed:**
```
Node.js: Not found ❌
PM2: Not found ❌
MongoDB: Not found ❌
Project: Not uploaded ❌
```
➡️ **Next Step:** Fresh installation guide

---

## 🔍 Quick Check Script

Copy and paste this **one-liner** in terminal to check everything:

```bash
echo "=== QUEST OBE - System Check ===" && \
echo "Node: $(node --version 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "NPM: $(npm --version 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "PM2: $(pm2 --version 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "MongoDB: $(mongod --version 2>/dev/null | head -1 || echo 'NOT INSTALLED')" && \
echo "Nginx: $(nginx -v 2>&1 || echo 'NOT INSTALLED')" && \
echo "PM2 Apps: $(pm2 list 2>/dev/null | grep -c online || echo '0')" && \
echo "Port 3000: $(netstat -tlnp 2>/dev/null | grep :3000 || echo 'Not in use')" && \
echo "Project: $([ -d /www/wwwroot/quest-obe ] && echo 'EXISTS' || echo 'NOT FOUND')" && \
echo "================================"
```

---

## 📸 Alternative: Screenshot Method

If you prefer visual confirmation:

1. Take screenshots of:
   - aaPanel **App Store → Installed** tab
   - aaPanel **Dashboard** (main page)
   - Terminal output from checks above

2. Share what you see

---

## 🎬 What Happens Next?

Based on your findings, I'll provide:

✅ **If everything is installed:** Quick start commands only  
⚠️ **If some things missing:** Install only what's needed  
❌ **If nothing installed:** Complete installation guide  

---

## 💡 Why Check First?

- ✅ **Save time** - Don't reinstall what's already there
- ✅ **Avoid conflicts** - Prevent version conflicts
- ✅ **Troubleshoot** - See what might be blocking our app
- ✅ **Optimize** - Use existing services instead of duplicating

---

## 🚀 Quick Commands Reference

```bash
# Check if app is already running
pm2 list

# Check what's using port 3000
lsof -i :3000
# OR
netstat -tlnp | grep 3000

# Check if project files exist
ls -la /www/wwwroot/quest-obe/

# Check Node.js version
node --version

# Check system resources
free -h
df -h
```

---

**👉 Run the checks above and share what you find!** 

Then I'll give you the exact steps you need - no more, no less! 🎯

