# 🚀 Vercel Deployment Checklist

## ✅ Completed (Already Done)
- [x] Fixed login.html to use correct API endpoint
- [x] Created vercel.json configuration
- [x] Added database connection test endpoint
- [x] Created test-connection.html page
- [x] Added fallback authentication
- [x] Created deployment documentation

## 📋 TODO (You Need to Do)

### 1️⃣ Set Environment Variables in Vercel (CRITICAL)
Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

Add these **7 variables**:

| Variable Name | Value |
|--------------|-------|
| `DB_HOST` | `mysql.gb.stackcp.com` |
| `DB_PORT` | `39558` |
| `DB_NAME` | `questobe-35313139c836` |
| `DB_USER` | `questobe` |
| `DB_PASSWORD` | `Quest123@` |
| `JWT_SECRET` | `quest_obe_jwt_secret_key_2024` |
| `NODE_ENV` | `production` |

⚠️ **Without these, the database won't connect!**

### 2️⃣ Redeploy Your Project
After adding environment variables:
1. Go to Vercel → Your Project → Deployments
2. Click the **⋮** (three dots) on latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete

### 3️⃣ Test Your Deployment
Visit: `https://YOUR-DOMAIN.vercel.app/test-connection.html`

Click **"Run All Tests"** and check:
- ✅ API Test should show "successful"
- ✅ Database Test should show "successful" (or fallback mode)
- ✅ Login Test should work

### 4️⃣ Try Logging In
Visit: `https://YOUR-DOMAIN.vercel.app/login.html`

Try these credentials:
- Email: `student@quest.edu.pk`
- Password: `pass`

Should redirect to student dashboard!

## 🔧 If Database Connection Fails

### Option A: Fix IP Restrictions (Recommended for production)
1. Login to your StackCP database panel
2. Check IP whitelist settings
3. Contact StackCP support to whitelist Vercel IP ranges
4. Redeploy after IP is whitelisted

### Option B: Use Fallback Mode (Works immediately)
The system will automatically use fallback authentication if database fails.
All demo accounts will work:
- student@quest.edu.pk / pass
- teacher@quest.edu.pk / pass
- admin@quest.edu.pk / admin123
- etc.

## 🐛 Troubleshooting

### Problem: "Network error" on login
**Check**: Is `/api/auth/login` accessible?
**Test**: Visit `https://YOUR-DOMAIN.vercel.app/api/test`
**Should show**: `{"message": "API is working!", ...}`

### Problem: "Invalid credentials"
**Check**: Did you set environment variables?
**Test**: Visit test-connection.html
**Solution**: Add env vars and redeploy

### Problem: Database connection fails
**Check**: test-connection.html shows database status
**Options**: 
1. Fix IP restrictions (contact StackCP)
2. Use fallback mode (already configured)

## 📊 Test Locally (Optional)

Before deploying, test database connection:

```bash
npm run test-db
```

This shows:
- ✅ Can connect to database
- ✅ Database has tables
- ✅ Users exist
- ✅ Credentials work

## 🎯 Expected Results

### Success Scenario 1: Database Connected
- test-connection.html shows all green ✅
- Login works with database users
- Full functionality available

### Success Scenario 2: Fallback Mode
- test-connection.html shows database error but login works
- Login works with demo accounts
- Limited to fallback users

**Both scenarios allow you to login and use the system!**

## 📞 Need Help?

1. Check `FIXES_APPLIED.md` for detailed explanation
2. Check `VERCEL_DEPLOYMENT_GUIDE.md` for full guide
3. Run `npm run test-db` to test locally
4. Check Vercel deployment logs for errors

---

## Quick Commands

```bash
# Test database locally
npm run test-db

# Run development server locally
npm run dev

# Visit local test page
# http://localhost:3000/test-connection.html
```

---

**Remember**: The #1 reason for login failure is missing environment variables in Vercel! ⚠️

