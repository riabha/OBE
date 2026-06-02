# MongoDB Architecture for OBE Portal - Complete Guide

## 🎯 **How Your System Works**

### **Architecture Overview:**

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN MONGODB SERVER                       │
│                  (194.60.87.212:27017)                      │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐      ┌──────▼──────┐    ┌──────▼──────┐
   │  obe_   │      │obe_university│    │obe_university│
   │platform │      │   _quest     │    │    _uok      │
   └─────────┘      └──────────────┘    └──────────────┘
   (Central)        (QUEST Uni)         (UOK Uni)
```

---

## 📊 **Database Structure:**

### **1. Platform Database (`obe_platform`)**
**Purpose:** Central management database
**Who can access:** Pro Super Admin only

**Collections:**
```
obe_platform/
├── platformusers    → All admins (Pro + University Super Admins)
├── universities     → List of all universities
└── subscriptions    → Billing/subscription info
```

**Example Data:**
```javascript
// platformusers collection
{
  email: "pro@obe.org.pk",
  role: "pro_superadmin",  // Full access to everything
  permissions: ["all"]
}

{
  email: "admin@quest.edu.pk",
  role: "university_superadmin",  // Access to QUEST database only
  university: ObjectId("..."),
  universityCode: "QUEST"
}

// universities collection
{
  universityName: "QUEST University",
  universityCode: "QUEST",
  databaseName: "obe_university_quest",  // ← This is their dedicated database
  subscriptionPlan: "Premium",
  isActive: true
}
```

---

### **2. University Databases (`obe_university_xxx`)**
**Purpose:** Individual university data - COMPLETELY ISOLATED
**Who can access:** 
- ✅ Pro Super Admin (can see all)
- ✅ University Super Admin (can see ONLY their university's database)

**Collections (Auto-created):**
```
obe_university_quest/
├── _metadata        → Database info
├── departments      → CS, EE, ME, etc.
├── users            → Teachers, Students, Staff
├── courses          → All courses
├── sections         → Course sections
├── enrollments      → Student enrollments
├── assessments      → Quizzes, Assignments, Exams
├── results          → Student grades
├── clos             → Course Learning Outcomes
├── plos             → Program Learning Outcomes
├── attainments      → CLO/PLO attainment tracking
└── reports          → Generated reports
```

---

## 🔐 **Access Control Model:**

### **Pro Super Admin:**
```
Can Access:
✅ obe_platform (full CRUD)
✅ obe_university_quest (full CRUD)
✅ obe_university_uok (full CRUD)
✅ obe_university_xyz (full CRUD)
✅ ALL universities' databases
```

### **University Super Admin (QUEST):**
```
Can Access:
❌ obe_platform (no access)
✅ obe_university_quest (full CRUD) ← ONLY their database
❌ obe_university_uok (no access)
❌ obe_university_xyz (no access)

Within their database, they can:
✅ Create/Edit/Delete departments
✅ Create/Edit/Delete users (teachers, students)
✅ Create/Edit/Delete courses
✅ Manage assessments
✅ View/Generate reports
✅ Everything related to THEIR university
```

---

## 🚀 **What Happens When You Create a University:**

### **Step-by-Step Process:**

#### **Step 1: Pro Admin Creates University**
```javascript
POST /api/universities/create
{
  universityName: "QUEST University",
  universityCode: "QUEST",
  superAdminEmail: "admin@quest.edu.pk",
  subscriptionPlan: "Premium"
}
```

#### **Step 2: System Auto-Creates Everything**

**A. Platform Database Entry:**
```javascript
// In obe_platform.universities
{
  universityName: "QUEST University",
  universityCode: "QUEST",
  databaseName: "obe_university_quest",  // ← Database name
  subscriptionPlan: "Premium",
  isActive: true
}
```

**B. Creates New Database:**
```
MongoDB creates: obe_university_quest/
```

**C. Auto-Creates Collections with Schema:**
```javascript
obe_university_quest/_metadata/
{
  universityId: ObjectId("..."),
  universityName: "QUEST University",
  universityCode: "QUEST",
  created: ISODate("2025-10-21")
}

obe_university_quest/departments/
// Ready to receive: { name, code, head, isActive }

obe_university_quest/users/
// Ready to receive: { email, name, role, department }

obe_university_quest/courses/
// Ready to receive: { code, name, creditHours, department }

... and so on for all collections
```

**D. Creates University Super Admin:**
```javascript
// In obe_platform.platformusers
{
  email: "admin@quest.edu.pk",
  password: "Admin@QUEST2025",  // Auto-generated
  role: "university_superadmin",
  university: ObjectId("..."),  // Link to university
  universityCode: "QUEST",
  permissions: ["all"]  // All permissions within their university
}
```

---

## 💡 **Key Concepts:**

### **1. Database Isolation**
- Each university gets a COMPLETELY SEPARATE database
- University A cannot see University B's data
- Like separate houses on the same street

### **2. Flexible Access**
- University Super Admin has FULL CONTROL over their database
- They can:
  - Create unlimited departments
  - Add unlimited users
  - Create custom courses
  - Modify anything in THEIR database
  - No restrictions (within their scope)

### **3. Automatic Setup**
When a database is created, ALL collections are pre-created with proper schemas. The university super admin doesn't need to create collections manually - they're ready to use!

---

## 🔄 **Data Flow Example:**

### **Scenario: QUEST wants to add a student**

```
1. QUEST Super Admin logs in:
   Email: admin@quest.edu.pk
   Password: Admin@QUEST2025

2. System checks obe_platform.platformusers:
   ✓ User found
   ✓ Role: university_superadmin
   ✓ universityCode: QUEST
   ✓ Allowed database: obe_university_quest

3. Admin navigates to "Students" section:
   → Opens connection to: obe_university_quest.users
   → Can add student
   → Data saved to: obe_university_quest.users

4. This data is COMPLETELY SEPARATE from other universities
```

---

## 📋 **Collections & Their Purpose:**

| Collection | Purpose | Who Creates Data |
|------------|---------|------------------|
| **_metadata** | Database info | System (auto) |
| **departments** | CS, EE, ME, etc. | University Admin |
| **users** | Teachers, Students | University Admin |
| **courses** | Course catalog | University Admin + Teachers |
| **sections** | Course instances | Teachers |
| **enrollments** | Student registrations | Students + Admin |
| **assessments** | Quizzes, Exams | Teachers |
| **results** | Grades | Teachers |
| **clos** | Course outcomes | Teachers |
| **plos** | Program outcomes | Admin |
| **attainments** | Achievement tracking | System (auto-calculated) |
| **reports** | Generated reports | System (auto-generated) |

---

## 🎯 **Summary:**

### **Think of it like this:**

```
OBE Portal (Building)
│
├── Ground Floor (obe_platform)
│   └── Reception: List of all universities, admins
│
├── Floor 1 (obe_university_quest)
│   └── QUEST's Office: Only QUEST can access
│       └── Their own rooms: students, courses, results, etc.
│
├── Floor 2 (obe_university_uok)
│   └── UOK's Office: Only UOK can access
│       └── Their own rooms: students, courses, results, etc.
│
└── Floor 3 (obe_university_xyz)
    └── XYZ's Office: Only XYZ can access
        └── Their own rooms: students, courses, results, etc.
```

**Pro Super Admin** = Building Owner (can access all floors)
**University Super Admin** = Office Manager (can only access their floor)

---

## ✅ **What's Automated:**

When you create a university:
1. ✅ Database is created automatically
2. ✅ All collections are created automatically
3. ✅ Schemas are set up automatically
4. ✅ Super admin account is created automatically
5. ✅ Access permissions are set automatically
6. ✅ Everything is ready to use immediately

The university super admin can START USING the system IMMEDIATELY without any technical setup!

---

## 🔧 **Your Requested Features:**

### **1. CRUD Operations in Databases Section**
✅ **Coming:** Add Edit/Delete buttons for university databases

### **2. Auto-Create Collections**
✅ **Implementing:** When database is created, auto-create all necessary collections

### **3. Full Access for University Super Admin**
✅ **Already Works:** University super admin has full control over their database
- They can create/edit/delete anything
- No limitations within their scope
- Complete flexibility

---

**Last Updated:** October 21, 2025  
**Version:** 1.0  
**Status:** Implementation in Progress

