#!/bin/bash

# QUEST OBE Portal - VPS Deployment Script
# Run this script on your Contabo VPS

echo "🎓 QUEST OBE Portal - VPS Deployment Script"
echo "============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Installing Node.js 22.x..."
    
    # Update package list
    sudo apt update
    
    # Install Node.js 22.x
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    echo "✅ Node.js installed successfully"
else
    echo "✅ Node.js is already installed: $(node --version)"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Installing npm..."
    sudo apt-get install -y npm
    echo "✅ npm installed successfully"
else
    echo "✅ npm is already installed: $(npm --version)"
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2..."
    sudo npm install -g pm2
    echo "✅ PM2 installed successfully"
else
    echo "✅ PM2 is already installed: $(pm2 --version)"
fi

# Navigate to OBE directory
if [ -d "OBE" ]; then
    echo "📁 Found OBE directory. Navigating to it..."
    cd OBE
else
    echo "❌ OBE directory not found. Please clone the repository first:"
    echo "   git clone https://github.com/riabha/OBE.git"
    echo "   cd OBE"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy production configuration
echo "⚙️  Setting up production configuration..."
cp config.env.production config.env

# Get VPS IP address
VPS_IP=$(curl -s ifconfig.me)
echo "🌐 Your VPS IP: $VPS_IP"

# Update configuration with actual IP
sed -i "s/your-vps-ip/$VPS_IP/g" config.env
sed -i "s/your-domain.com/$VPS_IP/g" config.env

echo "✅ Configuration updated with VPS IP: $VPS_IP"

# Create uploads directory
mkdir -p public/uploads
chmod 755 public/uploads

# Start the application with PM2
echo "🚀 Starting OBE Portal with PM2..."
pm2 stop quest-obe 2>/dev/null || true
pm2 delete quest-obe 2>/dev/null || true
pm2 start server-production.js --name quest-obe --env production

# Save PM2 configuration
pm2 save
pm2 startup

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🎉 QUEST OBE Portal Successfully Deployed!              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Access your portal at:"
echo "   📱 Homepage: http://$VPS_IP:3000"
echo "   🔐 Login: http://$VPS_IP:3000/login.html"
echo "   🏥 Health: http://$VPS_IP:3000/api/health"
echo ""
echo "🔐 Demo Login Credentials:"
echo "   📧 Email: pro@obe.org.pk"
echo "   🔑 Password: proadmin123"
echo ""
echo "📊 PM2 Status:"
pm2 status
echo ""
echo "🔧 Useful PM2 Commands:"
echo "   pm2 status          - Check application status"
echo "   pm2 logs quest-obe  - View application logs"
echo "   pm2 restart quest-obe - Restart application"
echo "   pm2 stop quest-obe  - Stop application"
echo ""
echo "✨ Your OBE Portal is now running on your VPS!"
