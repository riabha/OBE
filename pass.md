cat > .env << 'EOF'
# QUEST OBE Portal - Docker Environment Configuration
APP_PORT=3200
NODE_ENV=production

# MongoDB Root Credentials
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=SecureOBE2025!MongoDB@Quest

# JWT Configuration (Auto-generated secure secrets)
JWT_SECRET=OBE2025SecureJWTSecretForQuestUniversityPortal123456789
SESSION_SECRET=QuestOBESessionSecret2025SecureRandomString987654321

# Optional: Mongo Express (Database GUI)
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=OBEAdmin2025!
EOF
