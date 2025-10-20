# 🗄️ Database Setup Guide - MongoDB with aaPanel

## 📊 Database Architecture

```
MongoDB Server (aaPanel)
│
├── 🏛️ obe_platform (Platform Database)
│   │
│   ├── platformusers          # Pro Super Admins & Platform Staff
│   │   └── Documents: { email, password, name, role, permissions }
│   │
│   ├── universities           # All Registered Universities
│   │   └── Documents: { universityName, code, database, subscription, contact }
│   │
│   └── subscriptions         # University Subscriptions & Billing
│       └── Documents: { university, plan, status, limits, usage, payments }
│
├── 🎓 obe_university_quest (QUEST University Database - Auto-created)
│   ├── users                 # Students, Teachers, Staff
│   ├── departments          # CS, EE, ME, etc.
│   ├── courses              # Course information
│   ├── assessments          # Exams, assignments
│   ├── outcomes             # CLOs
│   └── ...
│
├── 🎓 obe_university_nust (Another University)
│   └── ... (same structure)
│
└── ... (More universities as they register)
```

---

## 🎯 Platform Database (`obe_platform`)

### **Purpose:**
- Stores platform-wide data
- University registrations
- Subscriptions & billing
- Platform administrators

### **Collections:**

#### **1. platformusers**
```javascript
{
  _id: ObjectId,
  email: "pro@obe.org.pk",
  password: "hashed_password",
  name: "Administrator Name",
  role: "pro_superadmin",  // or "platform_admin", "support"
  permissions: ["all"],
  isActive: true,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### **2. universities**
```javascript
{
  _id: ObjectId,
  universityName: "QUEST University",
  universityCode: "QUEST",
  databaseName: "obe_university_quest",
  logo: "/uploads/logo.png",
  primaryColor: "#2563eb",
  secondaryColor: "#7c3aed",
  address: "Street Address",
  city: "Nawabshah",
  country: "Pakistan",
  contactEmail: "admin@quest.edu.pk",
  contactPhone: "+92-123-4567890",
  website: "https://quest.edu.pk",
  superAdminEmail: "admin@quest.edu.pk",
  subscriptionPlan: "Premium",
  subscriptionStatus: "Active",
  maxUsers: 1500,
  maxCourses: 500,
  isActive: true,
  createdAt: Date,
  updatedAt: Date
}
```

#### **3. subscriptions**
```javascript
{
  _id: ObjectId,
  university: ObjectId,  // Reference to universities collection
  universityCode: "QUEST",
  
  // Plan Details
  planType: "Premium",
  planName: "Premium Plan",
  billingCycle: "Yearly",
  amount: 420000,  // PKR per year
  currency: "PKR",
  status: "Active",
  
  // Dates
  startDate: Date,
  endDate: Date,
  trialEndDate: null,
  lastBillingDate: Date,
  nextBillingDate: Date,
  
  // Limits
  limits: {
    maxUsers: 1500,
    maxCourses: 500,
    maxDepartments: 50,
    maxStorage: 100000  // MB
  },
  
  // Current Usage
  usage: {
    totalUsers: 245,
    totalCourses: 87,
    totalDepartments: 12,
    storageUsed: 5430  // MB
  },
  
  // Features
  features: {
    cloManagement: true,
    assessments: true,
    reports: true,
    advancedAnalytics: true,
    apiAccess: true,
    customBranding: true,
    prioritySupport: true
  },
  
  // Payment History
  payments: [
    {
      amount: 420000,
      currency: "PKR",
      paymentDate: Date,
      paymentMethod: "Bank Transfer",
      transactionId: "TXN123456",
      status: "Completed",
      invoice: "/invoices/INV-2025-001.pdf"
    }
  ],
  
  notes: "Annual subscription, custom contract",
  autoRenew: true,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 📋 Subscription Plans

| Plan | Users | Courses | Depts | Storage | Price (PKR/month) |
|------|-------|---------|-------|---------|-------------------|
| **Free Trial** | 50 | 10 | 3 | 500 MB | Free (30 days) |
| **Basic** | 200 | 50 | 10 | 5 GB | 5,000 |
| **Standard** | 500 | 150 | 25 | 20 GB | 15,000 |
| **Premium** | 1,500 | 500 | 50 | 100 GB | 35,000 |
| **Enterprise** | Unlimited | Unlimited | Unlimited | Unlimited | 75,000+ |

---

## 🚀 Setup Instructions

### **Step 1: Initialize Platform Database**

**On your VPS, run:**

```bash
cd /www/wwwroot/obe
node scripts/init-platform-database.js
```

**This will:**
- ✅ Create `obe_platform` database
- ✅ Create collections: `platformusers`, `universities`, `subscriptions`
- ✅ Create Pro Super Admin account
- ✅ Set up database indexes

**Output:**
```
🏛️  Platform Database Initialization
✅ Connected to platform database successfully!
✅ Pro Super Admin created
📧 Email: pro@obe.org.pk
🔑 Password: proadmin123
✅ Platform Database Initialized Successfully!
```

---

### **Step 2: View in aaPanel MongoDB GUI**

1. **Open aaPanel** → Click **"Databases"** → Select **"MongoDB"**

2. **You should see:**
   - 📂 Database: `obe_platform`
   - 📂 Collections:
     - `platformusers` (1 document - Pro Super Admin)
     - `universities` (empty - ready for registrations)
     - `subscriptions` (empty - will be created when universities register)

3. **Browse Data:**
   - Click on `obe_platform` database
   - Click on `platformusers` collection
   - You'll see the Pro Super Admin document

---

### **Step 3: Test Login**

```bash
# Test the API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@obe.org.pk","password":"proadmin123"}'
```

**Should return:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "email": "pro@obe.org.pk",
    "name": "OBE Portal Administrator",
    "role": "pro_superadmin"
  }
}
```

---

## 🎓 University Database Creation

When a university registers, the system automatically:

1. Creates entry in `obe_platform.universities`
2. Creates new database: `obe_university_<code>`
3. Creates subscription in `obe_platform.subscriptions`
4. Sets up initial collections in university database

**Example:**
```
University: QUEST
Code: QUEST
→ Creates database: obe_university_quest
```

---

## 🔍 MongoDB Commands (via aaPanel Terminal)

### **Connect to MongoDB:**
```bash
mongo mongodb://root:5PhYxwmq%40@localhost:27017/admin
```

### **List all databases:**
```javascript
show dbs
```

### **Use platform database:**
```javascript
use obe_platform
```

### **List collections:**
```javascript
show collections
```

### **View all platform users:**
```javascript
db.platformusers.find().pretty()
```

### **View all universities:**
```javascript
db.universities.find().pretty()
```

### **View all subscriptions:**
```javascript
db.subscriptions.find().pretty()
```

### **Count documents:**
```javascript
db.universities.countDocuments()
db.subscriptions.countDocuments()
```

### **Find active subscriptions:**
```javascript
db.subscriptions.find({ status: "Active" }).pretty()
```

### **Find universities by status:**
```javascript
db.universities.find({ isActive: true }).pretty()
```

---

## 📊 Monitoring in aaPanel

### **Database Statistics:**
1. aaPanel → **Databases** → **MongoDB**
2. Click on **`obe_platform`**
3. View:
   - Database size
   - Number of collections
   - Number of documents
   - Indexes

### **Collection Statistics:**
1. Click on any collection (e.g., `universities`)
2. View:
   - Document count
   - Average document size
   - Total size
   - Indexes

---

## 🛠️ Maintenance

### **Backup Platform Database:**
```bash
mongodump --uri="mongodb://root:PASSWORD@localhost:27017/obe_platform" --out=/backup/mongodb/
```

### **Restore Platform Database:**
```bash
mongorestore --uri="mongodb://root:PASSWORD@localhost:27017/" /backup/mongodb/obe_platform
```

### **Check Database Health:**
```bash
mongo --eval "db.serverStatus()" mongodb://root:PASSWORD@localhost:27017/admin
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] `obe_platform` database exists in aaPanel
- [ ] `platformusers` collection has 1 document (Pro Super Admin)
- [ ] `universities` collection exists (empty or with data)
- [ ] `subscriptions` collection exists
- [ ] Can login with pro@obe.org.pk
- [ ] Can view data in aaPanel MongoDB GUI
- [ ] Application connects successfully

---

## 🔐 Security Notes

1. **Change default password** after first login
2. **Backup regularly** - Use aaPanel backup feature
3. **Monitor access logs** in MongoDB
4. **Keep credentials secure** in `config.env`
5. **Use firewall rules** - MongoDB port should NOT be public

---

## 📞 Troubleshooting

### **Can't see database in aaPanel:**
```bash
# Restart MongoDB
systemctl restart mongod

# Check status
systemctl status mongod

# Check if database exists
mongo --eval "show dbs" mongodb://root:PASSWORD@localhost:27017/admin
```

### **Connection refused:**
```bash
# Check if MongoDB is running
systemctl status mongod

# Check port
netstat -tlnp | grep 27017

# Check firewall (only allow localhost)
ufw status
```

### **Re-initialize database:**
```bash
cd /www/wwwroot/obe
node scripts/init-platform-database.js
```

---

**Made with ❤️ for QUEST University OBE Portal**
**Database visible in aaPanel MongoDB GUI** 🎉

