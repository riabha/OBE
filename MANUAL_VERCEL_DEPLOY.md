# 🚀 Manual Vercel Deployment Guide

## Problem: Vercel Not Auto-Deploying from GitHub

If Vercel is not automatically deploying when you push to GitHub, follow these steps:

---

## ✅ SOLUTION 1: Check GitHub Integration (Easiest)

### Step 1: Go to Vercel Dashboard
https://vercel.com/dashboard

### Step 2: Click Your OBE Project

### Step 3: Go to Settings → Git
Look for:
- **Connected Git Repository**: Should show `github.com/riabha/OBE`
- **Production Branch**: Should be `main`

### If NOT Connected:
1. Click "Connect Git Repository"
2. Select GitHub
3. Find `riabha/OBE`
4. Click "Connect"
5. Select branch: `main`
6. Click "Deploy"

---

## ✅ SOLUTION 2: Manual Deploy with Vercel CLI

### Step 1: Install Vercel CLI

Open PowerShell in your project folder and run:

```powershell
npm install -g vercel
```

### Step 2: Login to Vercel

```powershell
vercel login
```

This will open a browser - login with your Vercel account.

### Step 3: Link Your Project

```powershell
vercel link
```

Answer the questions:
- Set up and deploy? **N** (No, just link)
- Which scope? Select your Vercel account
- Link to existing project? **Y** (Yes)
- Project name? Select your OBE project

### Step 4: Deploy to Production

```powershell
vercel --prod
```

This will:
- Build your project
- Deploy to production
- Show you the URL when done

**Wait 2-3 minutes for deployment to complete.**

---

## ✅ SOLUTION 3: Check Which Version is Deployed

### Before Manual Deploy:

Go to your Vercel URL and add `/check-version.html`:

**`https://your-project.vercel.app/check-version.html`**

This will show:
- ✅ Green if you have the latest version (commit 25cfe7b)
- ❌ Red if you have an old version

### If it shows old version or error:
**You MUST redeploy using Solution 1 or 2 above!**

---

## ✅ SOLUTION 4: Force Redeploy from Vercel Dashboard

### Step 1: Go to Deployments Tab

In your Vercel project, click "Deployments" (left sidebar)

### Step 2: Find Latest Deployment

Look for the most recent deployment

### Step 3: Check the Commit

Look at "Source" - it should show:
- **Commit**: 25cfe7b
- **Message**: "CRITICAL FIX: Remove Vercel Secrets..."

### If it shows old commit (like 34684f2):

1. Click the "..." menu on any deployment
2. Click "Redeploy"
3. **IMPORTANT**: UNCHECK "Use existing Build Cache"
4. Click "Redeploy" button
5. Wait 2-3 minutes

---

## 🔍 Verify Environment Variables Are Set

While you're in Vercel Dashboard:

### Go to: Settings → Environment Variables

Make sure these exist:

```
✓ DB_HOST = mysql.gb.stackcp.com
✓ DB_PORT = 40063
✓ DB_NAME = vercel_db-31383355e3
✓ DB_USER = obe
✓ DB_PASSWORD = quest-db
✓ JWT_SECRET = quest_obe_jwt_secret_key_2024
✓ NODE_ENV = production
```

**For EACH variable:**
- Check all 3 boxes: Production ✓ Preview ✓ Development ✓
- Click "Save"

**After adding/changing variables:**
- You MUST redeploy for them to take effect
- Go to Deployments → ... → Redeploy

---

## 🧪 Test After Deployment

### Test 1: Check Version
`https://your-url.vercel.app/check-version.html`

Should show: ✅ Commit 25cfe7b

### Test 2: Test API
`https://your-url.vercel.app/api/test`

Should show: `{"message": "API is working!"}`

### Test 3: Run Diagnostics
`https://your-url.vercel.app/vercel-diagnostic.html`

All 4 tests should show ✅

### Test 4: Login
`https://your-url.vercel.app/login.html`

Login with: `student@quest.edu.pk` / `pass`

Should redirect to dashboard!

---

## 🆘 Troubleshooting

### Issue: "vercel: command not found"

**Solution:**
```powershell
# Use npx instead
npx vercel --prod
```

### Issue: Vercel asks too many questions

**Solution:**
```powershell
# Use this to skip questions
npx vercel --prod --yes
```

### Issue: Build fails during deployment

**Solution:**
1. Look at the error in Vercel logs
2. Usually means:
   - Missing package in package.json
   - Syntax error in code
   - Environment variables not set
3. Share the error message for help

### Issue: Deployment succeeds but login still doesn't work

**Solution:**
1. Check `/check-version.html` - make sure it shows 25cfe7b
2. Check `/vercel-diagnostic.html` - run all 4 tests
3. Look at test 2 (Environment Variables) - all should be "true"
4. If any are "false", add them in Vercel dashboard and redeploy

### Issue: Can't find Vercel URL

**Solution:**
1. Go to Vercel Dashboard
2. Click your project
3. Look at top right - shows your URL
4. Usually: `obe-[random].vercel.app` or `[your-username]-obe.vercel.app`
5. Or click "Visit" button

---

## 📊 Expected Results After Successful Deployment

### 1. Version Check ✅
- Shows commit: 25cfe7b
- Green success message
- All features listed

### 2. API Test ✅
```json
{
  "message": "API is working!",
  "environment": "production"
}
```

### 3. Diagnostic Tests ✅
- Test 1: API Connectivity ✅
- Test 2: Environment Variables ✅ (all "true")
- Test 3: Database Connection ✅ (7 users)
- Test 4: Login API ✅ (returns token)

### 4. Login Works ✅
- Enter credentials
- Shows "Login successful! Redirecting..."
- Redirects to dashboard
- Shows "Welcome, Ahmad Ali"

---

## 💡 Pro Tips

### Tip 1: Use Vercel CLI for Faster Deploys

Once set up, deploying is just:
```powershell
vercel --prod
```

Much faster than waiting for GitHub auto-deploy!

### Tip 2: Check Logs

If something goes wrong:
1. Vercel Dashboard → Your Project
2. Click "Logs" tab
3. Look for red errors
4. Shows real-time what's happening

### Tip 3: Enable Auto-Deploy

To ensure future pushes auto-deploy:
1. Settings → Git
2. Make sure "Automatically deploy when you push to ..."  is checked
3. Branch should be "main"

---

## 📞 Quick Command Reference

```powershell
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Link project (one time)
vercel link

# Deploy to production
vercel --prod

# Or use npx (no install needed)
npx vercel --prod --yes
```

---

## ✅ Success Checklist

Before testing login:

- [ ] Latest code (25cfe7b) is deployed on Vercel
- [ ] `/check-version.html` shows ✅ green
- [ ] All 7 environment variables are set
- [ ] `/vercel-diagnostic.html` all tests pass ✅
- [ ] No errors in Vercel deployment logs
- [ ] Deployment status is "Ready" (green)

---

**Generated**: ${new Date().toLocaleString()}

**Next**: Deploy using Solution 1 or 2, then test!

