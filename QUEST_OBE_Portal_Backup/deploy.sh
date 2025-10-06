#!/bin/bash

# QUEST OBE Portal - Vercel Deployment Script

echo "🚀 Starting Vercel deployment for QUEST OBE Portal..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed. Installing..."
    npm install -g vercel
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "🔑 Please login to Vercel first:"
    vercel login
fi

echo "📦 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment completed!"
echo "📝 Don't forget to set environment variables in Vercel dashboard:"
echo "   - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD"
echo "   - JWT_SECRET, SESSION_SECRET"
echo "   - CORS_ORIGIN (your Vercel app URL)"
