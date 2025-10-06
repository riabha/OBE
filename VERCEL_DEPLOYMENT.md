# QUEST OBE Portal - Vercel Deployment Guide

## Environment Variables Required for Vercel

Add these environment variables in your Vercel dashboard:

### Database Configuration
- `DB_HOST` = mysql.gb.stackcp.com
- `DB_PORT` = 39558
- `DB_NAME` = questobe-35313139c836
- `DB_USER` = questobe
- `DB_PASSWORD` = Quest123@

### JWT Configuration
- `JWT_SECRET` = quest_obe_jwt_secret_key_2024
- `JWT_EXPIRE` = 24h

### Session Configuration
- `SESSION_SECRET` = quest_obe_session_secret_key_2024

### CORS Configuration
- `CORS_ORIGIN` = https://your-vercel-app.vercel.app (replace with your actual Vercel URL)

### Other Configuration
- `NODE_ENV` = production
- `PORT` = 3000

## How to Add Environment Variables in Vercel:

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Add each variable listed above
5. Make sure to set them for Production, Preview, and Development environments

## Deployment Steps:

1. Install Vercel CLI: `npm i -g vercel`
2. Login to Vercel: `vercel login`
3. Deploy: `vercel --prod`
4. Set environment variables in Vercel dashboard
5. Redeploy if needed: `vercel --prod`
