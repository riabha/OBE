# 🔧 Fix MongoDB Connection Settings in Pro Admin Portal

## The Problem
The "Edit MongoDB Connection" in your Pro Admin portal is failing because it's trying to connect using incorrect settings for your Docker deployment.

## ✅ Correct Settings for Your Docker Setup

When you see the "Edit MongoDB Connection" form in your Pro Admin portal, use these **EXACT** values:

### **MongoDB Connection Settings:**
- **MongoDB Host/IP**: `mongodb` (Docker service name, NOT localhost or IP)
- **Port**: `27017` (internal Docker port, NOT 27018)
- **Username**: `admin`
- **Password**: `SecureOBE2025MongoDBQuest`
- **Database Name**: `obe_platform`
- **Auth Source**: `admin`

## 🚨 Important Notes:

1. **Use `mongodb` as hostname** - This is the Docker service name, not `localhost` or `194.60.87.212`
2. **Use port `27017`** - This is the internal Docker port, not the external `27018`
3. **The application connects from INSIDE the Docker network**, so it uses internal addresses

## 🔍 Why This Happens:

- **External access** (from your computer): `194.60.87.212:27018`
- **Internal access** (from application): `mongodb:27017`
- **The Pro Admin portal runs inside the Docker container**, so it needs internal addresses

## 🎯 Test Connection Steps:

1. Go to your Pro Admin portal: `http://194.60.87.212:3200`
2. Navigate to "Edit MongoDB Connection"
3. Enter the settings above **EXACTLY**
4. Click "Test Connection"
5. Should show: ✅ "Connection successful!"

## 🗄️ For Database Monitoring Portal:

Instead of using the built-in connection test, use the dedicated database portal:
- **URL**: `http://194.60.87.212:8081`
- **Username**: `admin`
- **Password**: `SecureOBE2025MongoExpressQuest`

This gives you a much better database management interface!