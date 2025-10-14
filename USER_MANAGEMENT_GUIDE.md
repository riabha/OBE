# QUEST OBE Portal - Superadmin User Management Guide

## 🔑 **Superadmin Login Credentials**

### **Primary Access:**
- **Email**: `superadmin@quest.edu.pk`
- **Password**: `pass`
- **Role**: `superadmin`
- **Dashboard**: Super Admin Dashboard

## 👥 **User Management System**

### **Available User Roles:**
1. **Student** - Access to student dashboard
2. **Teacher** - Access to teacher dashboard with comprehensive reports
3. **Focal** - Access to focal person dashboard
4. **Chairman** - Access to chairman dashboard
5. **Dean** - Access to dean dashboard
6. **Controller** - Access to controller dashboard
7. **Superadmin** - Full system access

### **How to Create New Users:**

#### **Step 1: Login as Superadmin**
1. Go to your QUEST OBE Portal login page
2. Enter: `superadmin@quest.edu.pk`
3. Password: `pass`
4. Click "Sign In"

#### **Step 2: Access User Management**
1. In Super Admin Dashboard, click "User Management" in sidebar
2. Click "Add New User" button
3. Fill in the user details:

**Required Fields:**
- **Name**: Full name of the user
- **Email**: Unique email address
- **Password**: Secure password
- **Role**: Select from dropdown (Student, Teacher, Focal, Chairman, Dean, Controller, Superadmin)

**Optional Fields:**
- **Department**: User's department
- **Employee ID**: For staff members
- **Student ID**: For students
- **Designation**: Job title/position
- **Semester**: For students
- **Batch**: For students

#### **Step 3: Save User**
1. Click "Add User" button
2. User will be created in database
3. User can now login with their credentials

### **User Management Features:**

#### **View All Users:**
- Complete list of all system users
- Filter by role, department, status
- Search functionality
- Sort by name, email, role, department

#### **Edit Users:**
- Click "Edit" button next to any user
- Modify user details
- Change password
- Update role and permissions
- Activate/deactivate accounts

#### **Delete Users:**
- Click "Delete" button next to any user
- Soft delete (user becomes inactive)
- User cannot login but data is preserved

#### **Bulk Operations:**
- Select multiple users
- Bulk activate/deactivate
- Bulk role changes
- Bulk department assignments

### **User Statistics Dashboard:**
- Total users count
- Users by role distribution
- Active vs inactive users
- Department-wise user count
- Recent user activity

### **Security Features:**
- Password hashing with bcrypt
- Role-based access control
- Secure API endpoints
- Input validation
- SQL injection protection

## 🎯 **Quick Start Guide:**

### **Create Your First Teacher:**
1. Login as superadmin
2. Go to User Management
3. Click "Add New User"
4. Fill details:
   - Name: "Dr. John Smith"
   - Email: "john.smith@quest.edu.pk"
   - Password: "SecurePass123"
   - Role: "Teacher"
   - Department: "Computer Science"
   - Employee ID: "EMP-001"
   - Designation: "Assistant Professor"
5. Click "Add User"
6. Teacher can now login and access comprehensive reports

### **Create Your First Student:**
1. Login as superadmin
2. Go to User Management
3. Click "Add New User"
4. Fill details:
   - Name: "Ahmad Ali"
   - Email: "ahmad.ali@quest.edu.pk"
   - Password: "StudentPass123"
   - Role: "Student"
   - Department: "Computer Science"
   - Student ID: "QUEST-2024-001"
   - Semester: "7th"
   - Batch: "2021"
5. Click "Add User"
6. Student can now login and access student dashboard

## 📊 **Database Integration:**

The user management system is fully integrated with your MySQL database:
- **Table**: `users`
- **Connection**: Uses your existing database credentials
- **Security**: Passwords are hashed and stored securely
- **Backup**: All user data is preserved in database

## 🔄 **API Endpoints:**

- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/role/:role` - Get users by role
- `GET /api/users/stats/overview` - Get user statistics
- `POST /api/users/bulk` - Bulk operations

## 🚀 **Live System:**

Your user management system is now live on Vercel and ready to use!

---
**Need Help?** Contact system administrator or check the comprehensive reports system in teacher dashboard.
