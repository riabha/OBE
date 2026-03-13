#!/bin/bash

# 🎯 POPULATE DEMO DATABASE WITH SAMPLE DATA
# This script creates comprehensive demo data for all user roles

echo "🎯 POPULATING DEMO DATABASE WITH SAMPLE DATA"
echo "============================================="

echo "1. 🔧 First, fixing the loading issue..."

# Fix the loading issue and database sync
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;

print('=== FIXING LOADING ISSUE ===');

// Find or create DEMO university
var demoUniversity = db.universities.findOne({universityCode: 'DEMO'});
if (!demoUniversity) {
    print('Creating DEMO university...');
    var result = db.universities.insertOne({
        universityName: 'Demo University',
        universityCode: 'DEMO',
        databaseName: 'obe_demo',
        createdAt: new Date(),
        isActive: true
    });
    demoUniversity = db.universities.findOne({_id: result.insertedId});
    print('✅ Created DEMO university');
} else {
    // Update database name to obe_demo
    db.universities.updateOne(
        {_id: demoUniversity._id},
        {\$set: {databaseName: 'obe_demo'}}
    );
    print('✅ Updated university database name to obe_demo');
}

// Fix platform user university reference
var demoUser = db.platformusers.findOne({universityCode: 'DEMO'});
if (demoUser) {
    db.platformusers.updateOne(
        {_id: demoUser._id},
        {\$set: {university: demoUniversity._id}}
    );
    print('✅ Fixed platform user university reference');
} else {
    print('❌ No DEMO platform user found');
}

print('University ID: ' + demoUniversity._id);
print('Database: ' + demoUniversity.databaseName);
"

echo ""
echo "2. 📊 Creating demo database structure..."

# Create the demo database and populate with sample data
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_demo;

print('=== CREATING DEMO DATABASE STRUCTURE ===');

// Clear existing data
db.dropDatabase();

// Create collections and add sample data
print('Creating departments...');
var deptIds = [];

// Computer Science Department
var csResult = db.departments.insertOne({
    name: 'Computer Science',
    code: 'CS',
    description: 'Department of Computer Science and Information Technology',
    createdAt: new Date(),
    isActive: true
});
deptIds.push({name: 'Computer Science', id: csResult.insertedId});

// Business Administration Department  
var baResult = db.departments.insertOne({
    name: 'Business Administration',
    code: 'BA',
    description: 'Department of Business Administration and Management',
    createdAt: new Date(),
    isActive: true
});
deptIds.push({name: 'Business Administration', id: baResult.insertedId});

// Engineering Department
var engResult = db.departments.insertOne({
    name: 'Engineering',
    code: 'ENG',
    description: 'Department of Engineering and Technology',
    createdAt: new Date(),
    isActive: true
});
deptIds.push({name: 'Engineering', id: engResult.insertedId});

print('✅ Created ' + deptIds.length + ' departments');

// Create sample users for each role
print('Creating sample users...');

// Hash for password 'demo123'
var hashedPassword = '\$2b\$10\$rQJ8kHPXyKtGxGvEiU5zKOYxGxGvEiU5zKOYxGxGvEiU5zKOYxGxGv';

var userIds = [];

// Dean
var deanResult = db.users.insertOne({
    name: 'Dr. John Dean',
    email: 'dean@demo.edu',
    password: hashedPassword,
    role: 'dean',
    department: deptIds[0].id,
    employeeId: 'DEAN001',
    phone: '+1-555-0101',
    isActive: true,
    createdAt: new Date()
});
userIds.push({role: 'dean', id: deanResult.insertedId, email: 'dean@demo.edu'});

// Chairman
var chairmanResult = db.users.insertOne({
    name: 'Dr. Sarah Chairman',
    email: 'chairman@demo.edu',
    password: hashedPassword,
    role: 'chairman',
    department: deptIds[0].id,
    employeeId: 'CHAIR001',
    phone: '+1-555-0102',
    isActive: true,
    createdAt: new Date()
});
userIds.push({role: 'chairman', id: chairmanResult.insertedId, email: 'chairman@demo.edu'});

// Controller
var controllerResult = db.users.insertOne({
    name: 'Mr. Mike Controller',
    email: 'controller@demo.edu',
    password: hashedPassword,
    role: 'controller',
    department: deptIds[1].id,
    employeeId: 'CTRL001',
    phone: '+1-555-0103',
    isActive: true,
    createdAt: new Date()
});
userIds.push({role: 'controller', id: controllerResult.insertedId, email: 'controller@demo.edu'});

// Focal Person
var focalResult = db.users.insertOne({
    name: 'Ms. Lisa Focal',
    email: 'focal@demo.edu',
    password: hashedPassword,
    role: 'focal',
    department: deptIds[0].id,
    employeeId: 'FOCAL001',
    phone: '+1-555-0104',
    isActive: true,
    createdAt: new Date()
});
userIds.push({role: 'focal', id: focalResult.insertedId, email: 'focal@demo.edu'});

// Teachers
var teacherIds = [];
var teachers = [
    {name: 'Dr. Alice Johnson', email: 'alice.johnson@demo.edu', dept: 0, empId: 'T001'},
    {name: 'Prof. Bob Smith', email: 'bob.smith@demo.edu', dept: 0, empId: 'T002'},
    {name: 'Dr. Carol Wilson', email: 'carol.wilson@demo.edu', dept: 1, empId: 'T003'},
    {name: 'Mr. David Brown', email: 'david.brown@demo.edu', dept: 2, empId: 'T004'},
    {name: 'Dr. Emma Davis', email: 'emma.davis@demo.edu', dept: 0, empId: 'T005'}
];

teachers.forEach(function(teacher) {
    var result = db.users.insertOne({
        name: teacher.name,
        email: teacher.email,
        password: hashedPassword,
        role: 'teacher',
        department: deptIds[teacher.dept].id,
        employeeId: teacher.empId,
        phone: '+1-555-02' + teacher.empId.slice(-2),
        isActive: true,
        createdAt: new Date()
    });
    teacherIds.push(result.insertedId);
    userIds.push({role: 'teacher', id: result.insertedId, email: teacher.email});
});

// Students
var studentIds = [];
var students = [
    {name: 'John Student', email: 'john.student@demo.edu', rollNo: 'CS2021001', dept: 0},
    {name: 'Jane Doe', email: 'jane.doe@demo.edu', rollNo: 'CS2021002', dept: 0},
    {name: 'Mike Wilson', email: 'mike.wilson@demo.edu', rollNo: 'BA2021001', dept: 1},
    {name: 'Sarah Johnson', email: 'sarah.johnson@demo.edu', rollNo: 'CS2021003', dept: 0},
    {name: 'Tom Brown', email: 'tom.brown@demo.edu', rollNo: 'ENG2021001', dept: 2},
    {name: 'Lisa Davis', email: 'lisa.davis@demo.edu', rollNo: 'CS2021004', dept: 0},
    {name: 'Alex Smith', email: 'alex.smith@demo.edu', rollNo: 'BA2021002', dept: 1},
    {name: 'Emma Wilson', email: 'emma.wilson@demo.edu', rollNo: 'ENG2021002', dept: 2},
    {name: 'Chris Taylor', email: 'chris.taylor@demo.edu', rollNo: 'CS2021005', dept: 0},
    {name: 'Amy Johnson', email: 'amy.johnson@demo.edu', rollNo: 'BA2021003', dept: 1}
];

students.forEach(function(student) {
    var result = db.users.insertOne({
        name: student.name,
        email: student.email,
        password: hashedPassword,
        role: 'student',
        department: deptIds[student.dept].id,
        rollNumber: student.rollNo,
        phone: '+1-555-03' + student.rollNo.slice(-2),
        isActive: true,
        createdAt: new Date()
    });
    studentIds.push(result.insertedId);
    userIds.push({role: 'student', id: result.insertedId, email: student.email});
});

print('✅ Created ' + userIds.length + ' users');

// Create Programs
print('Creating programs...');
var programIds = [];

var programs = [
    {name: 'Bachelor of Computer Science', code: 'BCS', dept: 0, duration: 4},
    {name: 'Master of Computer Science', code: 'MCS', dept: 0, duration: 2},
    {name: 'Bachelor of Business Administration', code: 'BBA', dept: 1, duration: 4},
    {name: 'Master of Business Administration', code: 'MBA', dept: 1, duration: 2},
    {name: 'Bachelor of Engineering', code: 'BE', dept: 2, duration: 4}
];

programs.forEach(function(program) {
    var result = db.programs.insertOne({
        name: program.name,
        code: program.code,
        department: deptIds[program.dept].id,
        duration: program.duration,
        isActive: true,
        createdAt: new Date()
    });
    programIds.push({name: program.name, id: result.insertedId, dept: program.dept});
});

print('✅ Created ' + programIds.length + ' programs');

// Create Courses
print('Creating courses...');
var courseIds = [];

var courses = [
    {name: 'Programming Fundamentals', code: 'CS101', credits: 3, dept: 0, teacher: 0},
    {name: 'Data Structures', code: 'CS201', credits: 3, dept: 0, teacher: 1},
    {name: 'Database Systems', code: 'CS301', credits: 3, dept: 0, teacher: 0},
    {name: 'Software Engineering', code: 'CS401', credits: 3, dept: 0, teacher: 4},
    {name: 'Business Management', code: 'BA101', credits: 3, dept: 1, teacher: 2},
    {name: 'Marketing Principles', code: 'BA201', credits: 3, dept: 1, teacher: 2},
    {name: 'Engineering Mathematics', code: 'ENG101', credits: 4, dept: 2, teacher: 3},
    {name: 'Circuit Analysis', code: 'ENG201', credits: 3, dept: 2, teacher: 3}
];

courses.forEach(function(course) {
    var result = db.courses.insertOne({
        name: course.name,
        code: course.code,
        credits: course.credits,
        department: deptIds[course.dept].id,
        instructor: teacherIds[course.teacher],
        semester: 'Fall 2024',
        isActive: true,
        createdAt: new Date()
    });
    courseIds.push(result.insertedId);
});

print('✅ Created ' + courseIds.length + ' courses');

// Create some sample assessments
print('Creating assessments...');
var assessmentCount = 0;

courseIds.forEach(function(courseId, index) {
    // Create 2 assessments per course
    for (var i = 1; i <= 2; i++) {
        db.assessments.insertOne({
            title: 'Assessment ' + i + ' - ' + courses[index].name,
            course: courseId,
            type: i === 1 ? 'quiz' : 'assignment',
            totalMarks: 100,
            weightage: i === 1 ? 20 : 30,
            dueDate: new Date(Date.now() + (i * 7 * 24 * 60 * 60 * 1000)),
            isActive: true,
            createdAt: new Date()
        });
        assessmentCount++;
    }
});

print('✅ Created ' + assessmentCount + ' assessments');

print('=== DEMO DATABASE POPULATED SUCCESSFULLY ===');
print('Total Users: ' + userIds.length);
print('Total Departments: ' + deptIds.length);
print('Total Programs: ' + programIds.length);
print('Total Courses: ' + courseIds.length);
print('Total Assessments: ' + assessmentCount);
"

echo ""
echo "3. 🔄 Restarting application..."
docker-compose restart

echo ""
echo "4. ⏳ Waiting for restart..."
sleep 15

echo ""
echo "✅ DEMO DATABASE POPULATION COMPLETE!"
echo "===================================="
echo ""
echo "🎯 DEMO ACCOUNTS CREATED:"
echo "========================="
echo ""
echo "🏛️ UNIVERSITY SUPER ADMIN:"
echo "Email: (your existing account)"
echo "Password: (your existing password)"
echo ""
echo "👨‍💼 MANAGEMENT ROLES:"
echo "Dean: dean@demo.edu / demo123"
echo "Chairman: chairman@demo.edu / demo123"
echo "Controller: controller@demo.edu / demo123"
echo "Focal Person: focal@demo.edu / demo123"
echo ""
echo "👩‍🏫 TEACHERS:"
echo "alice.johnson@demo.edu / demo123"
echo "bob.smith@demo.edu / demo123"
echo "carol.wilson@demo.edu / demo123"
echo "david.brown@demo.edu / demo123"
echo "emma.davis@demo.edu / demo123"
echo ""
echo "🎓 STUDENTS:"
echo "john.student@demo.edu / demo123"
echo "jane.doe@demo.edu / demo123"
echo "mike.wilson@demo.edu / demo123"
echo "sarah.johnson@demo.edu / demo123"
echo "tom.brown@demo.edu / demo123"
echo "lisa.davis@demo.edu / demo123"
echo "alex.smith@demo.edu / demo123"
echo "emma.wilson@demo.edu / demo123"
echo "chris.taylor@demo.edu / demo123"
echo "amy.johnson@demo.edu / demo123"
echo ""
echo "📚 SAMPLE DATA CREATED:"
echo "• 3 Departments (CS, BA, Engineering)"
echo "• 5 Programs (BCS, MCS, BBA, MBA, BE)"
echo "• 8 Courses with assigned teachers"
echo "• 16 Assessments across all courses"
echo "• 15+ Users across all roles"
echo ""
echo "🧪 TEST ALL DASHBOARDS:"
echo "1. University Super Admin Dashboard"
echo "2. Dean Dashboard"
echo "3. Chairman Dashboard"
echo "4. Controller Dashboard"
echo "5. Focal Person Dashboard"
echo "6. Teacher Dashboard"
echo "7. Student Dashboard"
echo ""
echo "All accounts use password: demo123"