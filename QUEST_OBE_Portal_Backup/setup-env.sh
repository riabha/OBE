# Environment Variables for QUEST OBE Portal
# Run these commands one by one to set up your Vercel environment variables

echo "Setting up environment variables for QUEST OBE Portal..."

# Database Configuration
vercel env add DB_HOST production <<< "mysql.gb.stackcp.com"
vercel env add DB_PORT production <<< "39558"
vercel env add DB_NAME production <<< "questobe-35313139c836"
vercel env add DB_USER production <<< "questobe"
vercel env add DB_PASSWORD production <<< "Quest123@"

# JWT Configuration
vercel env add JWT_SECRET production <<< "quest_obe_jwt_secret_key_2024"
vercel env add SESSION_SECRET production <<< "quest_obe_session_secret_key_2024"

# CORS Configuration
vercel env add CORS_ORIGIN production <<< "https://quest-obe-portal-nvzbog8e8-riaz-bhanbhros-projects-a49e0ad5.vercel.app"

# Other Configuration
vercel env add NODE_ENV production <<< "production"
vercel env add PORT production <<< "3000"

echo "Environment variables set successfully!"
echo "Now redeploying the application..."

vercel --prod --yes
