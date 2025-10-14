# QUEST OBE Portal - Vercel Deployment Guide

## 🚀 Deployment Steps

### 1. Environment Variables Setup

After deploying to Vercel, you **MUST** configure the following environment variables in your Vercel project settings:

Go to your Vercel project → **Settings** → **Environment Variables** and add:

```
DB_HOST=mysql.gb.stackcp.com
DB_PORT=39558
DB_NAME=questobe-35313139c836
DB_USER=questobe
DB_PASSWORD=Quest123@
JWT_SECRET=quest_obe_jwt_secret_key_2024
NODE_ENV=production
```

### 2. Testing the Deployment

After deployment, test your connection using these URLs:

1. **API Test**: `https://your-domain.vercel.app/api/test`
   - Should return: `{"message": "API is working!", ...}`

2. **Database Test**: `https://your-domain.vercel.app/api/db-test`
   - Should return database connection status

3. **Connection Test Page**: `https://your-domain.vercel.app/test-connection.html`
   - Interactive page to test all connections

4. **Login Page**: `https://your-domain.vercel.app/login.html`

### 3. Demo Accounts

If the database connection fails, the system will automatically use fallback authentication:

- **Super Admin**: admin@quest.edu.pk / admin123
- **Student**: student@quest.edu.pk / pass
- **Teacher**: teacher@quest.edu.pk / pass
- **Focal Person**: focal@quest.edu.pk / pass
- **Chairman**: chairman@quest.edu.pk / pass
- **Dean**: dean@quest.edu.pk / pass
- **Controller**: controller@quest.edu.pk / pass

### 4. Troubleshooting Database Connection

If you can't login, the issue is likely one of these:

#### A. Environment Variables Not Set
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add all the variables listed in step 1
- Redeploy the project

#### B. Database Server Restrictions
- Your database host `mysql.gb.stackcp.com` might have IP restrictions
- Check if the database allows connections from Vercel's IP ranges
- Contact your database hosting provider (StackCP) to whitelist Vercel IPs

#### C. Database Credentials
- Verify credentials in your StackCP database panel
- Test connection locally first using:
  ```bash
  mysql -h mysql.gb.stackcp.com -P 39558 -u questobe -p questobe-35313139c836
  ```

### 5. Vercel-Specific Notes

- Vercel uses serverless functions, not traditional servers
- The `api/index.js` file handles all API routes
- Static files are served from the `public/` directory
- The `vercel.json` file configures routing

### 6. File Structure for Vercel

```
OBE/
├── api/
│   └── index.js          # Serverless API handler
├── public/
│   ├── login.html        # Login page (uses /api/auth/login)
│   ├── test-connection.html  # Connection test page
│   └── ...
├── vercel.json           # Vercel configuration
└── package.json
```

### 7. Check Deployment Logs

If something isn't working:

1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click on the latest deployment
3. Go to **Functions** tab to see serverless function logs
4. Check for any errors in the logs

### 8. Database Connection Pool Settings

The API uses connection pooling with these settings:
- connectionLimit: 10
- waitForConnections: true
- queueLimit: 0

For Vercel's serverless environment, these should work well, but if you face timeout issues, you may need to adjust them.

### 9. Common Issues

#### "Cannot connect to database"
- **Solution**: Set environment variables in Vercel dashboard and redeploy

#### "Invalid credentials" on login
- **Solution**: If database is working, check the users table for existing accounts
- **Fallback**: Use demo accounts if database authentication fails

#### "Network error" on login
- **Solution**: Check browser console for API endpoint errors
- **Verify**: Make sure `/api/auth/login` endpoint is accessible

### 10. Next Steps After Successful Deployment

1. Visit `/test-connection.html` to verify all connections
2. Try logging in with a demo account
3. Check if dashboards load correctly
4. Test creating courses, users, etc.

## 🔒 Security Recommendations

1. **Change default passwords** for all demo accounts
2. **Use strong JWT secret** (change from default)
3. **Enable SSL** for database connections if supported
4. **Set proper CORS origins** (currently set to '*')
5. **Add rate limiting** for login endpoints

## 📞 Support

If you continue to face issues:
1. Check Vercel deployment logs
2. Test the `/api/db-test` endpoint
3. Verify environment variables are set correctly
4. Check database server firewall/IP restrictions

