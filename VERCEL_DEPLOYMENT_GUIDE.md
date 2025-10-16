# 🚀 Deploy QUEST OBE Portal to Vercel - Complete Guide

## Step-by-Step Deployment Instructions

Follow these steps exactly to deploy your application to Vercel.

---

## 📋 Prerequisites

- ✅ GitHub account (you have this)
- ✅ Code pushed to GitHub at: https://github.com/riabha/OBE
- ✅ Vercel account (free) - https://vercel.com

---

## 🎯 STEP 1: Create Vercel Account (if you don't have one)

1. Go to **https://vercel.com/signup**
2. Click **"Continue with GitHub"**
3. Authorize Vercel to access your GitHub
4. Complete the signup

**Skip this step if you already have a Vercel account.**

---

## 🔗 STEP 2: Import Your Project from GitHub

### 2.1 Go to Vercel Dashboard

Open: **https://vercel.com/dashboard**

### 2.2 Create New Project

Click the **"Add New..."** button → Select **"Project"**

### 2.3 Import Git Repository

1. You'll see "Import Git Repository"
2. Find **"riabha/OBE"** in the list
3. If you don't see it, click **"Adjust GitHub App Permissions"**
   - Select your repositories
   - Choose "All repositories" or select "OBE" specifically
   - Click "Save"

### 2.4 Click "Import" on riabha/OBE

---

## ⚙️ STEP 3: Configure Project Settings

You'll see a configuration screen:

### 3.1 Project Name
- Leave as: **OBE** (or change to your preference)
- This will be your URL: `obe-[random].vercel.app`

### 3.2 Framework Preset
- Select: **Other** (or leave as detected)

### 3.3 Root Directory
- Leave as: **./** (root)

### 3.4 Build and Output Settings
- **Build Command**: Leave empty or use `npm install`
- **Output Directory**: Leave as `public`
- **Install Command**: `npm install`

---

## 🔐 STEP 4: Add Environment Variables (MOST IMPORTANT!)

**Before deploying**, you MUST add environment variables:

### Click "Environment Variables" section to expand it

Add these **7 variables** one by one:

```
Name: DB_HOST
Value: mysql.gb.stackcp.com

Name: DB_PORT
Value: 40063

Name: DB_NAME
Value: vercel_db-31383355e3

Name: DB_USER
Value: obe

Name: DB_PASSWORD
Value: quest-db

Name: JWT_SECRET
Value: quest_obe_jwt_secret_key_2024

Name: NODE_ENV
Value: production
```

### For EACH variable:
1. Enter the **Name** in the first box
2. Enter the **Value** in the second box
3. Make sure ALL THREE environments are checked:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **"Add"** to save that variable
5. Repeat for all 7 variables

**⚠️ CRITICAL:** All 7 variables must be added before deploying!

---

## 🚀 STEP 5: Deploy!

1. After adding all environment variables
2. Click the big **"Deploy"** button at the bottom
3. Wait 2-3 minutes for deployment to complete

You'll see:
- ✅ Building...
- ✅ Deploying...
- ✅ **Ready** (with a green checkmark)

---

## 🎉 STEP 6: Access Your Deployed Application

### 6.1 Get Your URL

After deployment completes:
- You'll see: **"Congratulations!"**
- Your URL will be something like: `https://obe-[random].vercel.app`
- Click **"Visit"** or copy the URL

### 6.2 Test Your Application

1. Go to: `https://your-url.vercel.app/login.html`
2. Login with:
   - **Email**: `student@quest.edu.pk`
   - **Password**: `pass`
3. Click **"Sign In"**
4. You should be redirected to the Student Dashboard!

---

## ✅ Verify Everything is Working

### Test 1: Homepage
Visit: `https://your-url.vercel.app`
- Should show the QUEST OBE Portal homepage

### Test 2: API
Visit: `https://your-url.vercel.app/api/test`
- Should show: `{"message": "API is working!"}`

### Test 3: Login
Visit: `https://your-url.vercel.app/login.html`
- Try logging in with any demo account
- All passwords are: `pass`

### Demo Accounts:
- student@quest.edu.pk
- teacher@quest.edu.pk
- focal@quest.edu.pk
- chairman@quest.edu.pk
- dean@quest.edu.pk
- controller@quest.edu.pk
- superadmin@quest.edu.pk

---

## 🔄 Automatic Deployments

After initial setup, every time you push to GitHub:
- Vercel will **automatically** deploy your changes
- You'll get a notification email
- Takes about 2-3 minutes per deployment

To push updates:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

---

## 🛠️ Manage Your Deployment

### View Deployments
1. Go to Vercel Dashboard
2. Click your "OBE" project
3. See all deployments and their status

### Update Environment Variables
1. Go to Project → **Settings**
2. Click **Environment Variables**
3. Edit any variable
4. **Must redeploy** after changing variables:
   - Go to **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**

### View Logs
1. Go to Project → **Logs** tab
2. See real-time logs
3. Useful for debugging

---

## 🐛 Troubleshooting

### Issue 1: "Build Failed"

**Check:**
- All environment variables are set correctly
- No typos in variable names
- All dependencies in package.json

**Solution:**
- Go to the failed deployment
- Read the error logs
- Fix the issue and push again

### Issue 2: "Cannot connect to database"

**Check:**
- All 7 environment variables are set
- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD are correct
- Database allows connections from Vercel

**Solution:**
- Verify environment variables in Settings
- Check if database host allows remote connections
- Contact your database provider to whitelist Vercel IPs

### Issue 3: "Login doesn't work"

**Check:**
- Environment variables are set
- JWT_SECRET is configured
- Database has users (should have 7 demo users)

**Solution:**
- Test API: `https://your-url.vercel.app/api/test`
- If API works but login doesn't, check database connection
- Make sure demo users exist in database

### Issue 4: "404 Not Found" on pages

**Check:**
- vercel.json is in your repository
- Routes are configured correctly

**Solution:**
- Make sure vercel.json exists (I've added it)
- Redeploy the project

---

## 📊 Expected Deployment Time

- **First deployment**: 2-3 minutes
- **Subsequent deployments**: 1-2 minutes
- **Build time**: ~30 seconds
- **Deploy time**: ~30 seconds

---

## 🔒 Security Recommendations

1. ✅ Change default demo passwords after first deployment
2. ✅ Use strong JWT_SECRET (already set)
3. ✅ Enable HTTPS (automatic on Vercel)
4. ✅ Regular database backups
5. ✅ Monitor access logs

---

## 📱 Custom Domain (Optional)

To use your own domain:

1. Go to Project → **Settings** → **Domains**
2. Click **"Add"**
3. Enter your domain
4. Follow DNS configuration instructions
5. Wait for verification

---

## 🎯 Quick Reference

**Vercel Dashboard**: https://vercel.com/dashboard

**Your GitHub**: https://github.com/riabha/OBE

**Environment Variables Needed**: 7 total
- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
- JWT_SECRET, NODE_ENV

**Demo Login**: student@quest.edu.pk / pass

---

## 💡 Pro Tips

1. **Bookmark your Vercel URL** for easy access
2. **Enable notifications** in Vercel settings for deployment updates
3. **Use Preview Deployments** - every branch push creates a preview URL
4. **Check logs regularly** to catch issues early
5. **Test locally first** before pushing to GitHub

---

## 🆘 Need Help?

If deployment fails:
1. Check the error logs in Vercel dashboard
2. Verify all environment variables are set
3. Make sure your GitHub repository is up to date
4. Try redeploying from Vercel dashboard

---

## ✅ Deployment Checklist

Before clicking Deploy:

- [ ] Vercel account created
- [ ] GitHub repository connected
- [ ] All 7 environment variables added
- [ ] All environments checked (Production, Preview, Development)
- [ ] Project name set
- [ ] Ready to deploy!

After deployment:

- [ ] Deployment shows "Ready" status
- [ ] Homepage loads successfully
- [ ] API test endpoint works
- [ ] Login page loads
- [ ] Can login with demo account
- [ ] Dashboard displays correctly

---

**You're all set! Follow these steps and your application will be live in minutes!** 🚀

**Generated**: ${new Date().toLocaleString()}

