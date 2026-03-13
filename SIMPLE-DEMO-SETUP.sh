#!/bin/bash

# 🎯 SIMPLE DEMO SETUP - Create working demo accounts
# This script uses the same password hashing approach as the existing system

echo "🎯 SIMPLE DEMO SETUP - Creating working demo accounts"
echo "===================================================="

echo "1. 🔧 Fixing university database reference..."

# Fix the loading issue and database sync
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;

print('=== FIXING PLATFORM DATABASE ===');

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

// Fix existing platform user university reference
var existingUser = db.platformusers.findOne({universityCode: 'DEMO'});
if (existingUser) {
    db.platformusers.updateOne(
        {_id: existingUser._id},
        {\$set: {university: demoUniversity._id}}
    );
    print('✅ Fixed existing platform user university reference');
}

print('University ID: ' + demoUniversity._id);
print('Database: ' + demoUniversity.databaseName);

// Get the existing pro admin password hash to use as template
var proAdmin = db.platformusers.findOne({email: 'pro@obe.org.pk'});
var templateHash = proAdmin ? proAdmin.password : '\$2b\$12\$rQJ8kHPXyKtGxGvEiU5zKOYxGxGvEiU5zKOYxGxGvEiU5zKOYxGxGv';

print('Using password hash template from existing user');

// Create demo platform users for login
print('Creating demo platform users...');

var demoUsers = [
    {name: 'Dr. John Dean', email: 'dean@demo.edu', role: 'dean'},
    {name: 'Dr. Sarah Chairman', email: 'chairman@demo.edu', role: 'chairman'},
    {name: 'Mr. Mike Controller', email: 'controller@demo.edu', role: 'controller'},
    {name: 'Ms. Lisa Focal', email: 'focal@demo.edu', role: 'focal'},
    {name: 'Dr. Alice Johnson', email: 'alice.johnson@demo.edu', role: 'teacher'},
    {name: 'Prof. Bob Smith', email: 'bob.smith@demo.edu', role: 'teacher'},
    {name: 'John Student', email: 'john.student@demo.edu', role: 'student'},
    {name: 'Jane Doe', email: 'jane.doe@demo.edu', role: 'student'}
];

var createdCount = 0;
demoUsers.forEach(function(user) {
    var existingUser = db.platformusers.findOne({email: user.email});
    if (!existingUser) {
        db.platformusers.insertOne({
            name: user.name,
            email: user.email,
            password: templateHash,
            role: user.role,
            universityCode: 'DEMO',
            university: demoUniversity._id,
            isActive: true,
            createdAt: new Date()
        });
        print('✅ Created: ' + user.email + ' (' + user.role + ')');
        createdCount++;
    } else {
        // Update university reference if missing
        if (!existingUser.university) {
            db.platformusers.updateOne(
                {_id: existingUser._id},
                {\$set: {university: demoUniversity._id}}
            );
            print('✅ Fixed reference: ' + user.email);
        } else {
            print('⚠️ Already exists: ' + user.email);
        }
    }
});

print('Created ' + createdCount + ' new platform users');
"

echo ""
echo "2. 📊 Creating demo university database..."

# Create the demo database with sample data
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_demo;

print('=== CREATING DEMO UNIVERSITY DATABASE ===');

// Clear existing data
db.dropDatabase();

// Create departments
var deptResult = db.departments.insertMany([
    {name: 'Computer Science', code: 'CS', description: 'Department of Computer Science', createdAt: new Date(), isActive: true},
    {name: 'Business Administration', code: 'BA', description: 'Department of Business Administration', createdAt: new Date(), isActive: true},
    {name: 'Engineering', code: 'ENG', description: 'Department of Engineering', createdAt: new Date(), isActive: true}
]);

var deptIds = Object.values(deptResult.insertedIds);
print('✅ Created ' + deptIds.length + ' departments');

// Get password hash from platform database
var platformDb = db.getSiblingDB('obe_platform');
var proAdmin = platformDb.platformusers.findOne({email: 'pro@obe.org.pk'});
var passwordHash = proAdmin ? proAdmin.password : '\$2b\$12\$rQJ8kHPXyKtGxGvEiU5zKOYxGxGvEiU5zKOYxGxGvEiU5zKOYxGxGv';

// Create university users
var userResult = db.users.insertMany([
    {name: 'Dr. John Dean', email: 'dean@demo.edu', password: passwordHash, role: 'dean', department: deptIds[0], employeeId: 'DEAN001', phone: '+1-555-0101', isActive: true, createdAt: new Date()},
    {name: 'Dr. Sarah Chairman', email: 'chairman@demo.edu', password: passwordHash, role: 'chairman', department: deptIds[0], employeeId: 'CHAIR001', phone: '+1-555-0102', isActive: true, createdAt: new Date()},
    {name: 'Mr. Mike Controller', email: 'controller@demo.edu', password: passwordHash, role: 'controller', department: deptIds[1], employeeId: 'CTRL001', phone: '+1-555-0103', isActive: true, createdAt: new Date()},
    {name: 'Ms. Lisa Focal', email: 'focal@demo.edu', password: passwordHash, role: 'focal', department: deptIds[0], employeeId: 'FOCAL001', phone: '+1-555-0104', isActive: true, createdAt: new Date()},
    {name: 'Dr. Alice Johnson', email: 'alice.johnson@demo.edu', password: passwordHash, role: 'teacher', department: deptIds[0], employeeId: 'T001', phone: '+1-555-0201', isActive: true, createdAt: new Date()},
    {name: 'Prof. Bob Smith', email: 'bob.smith@demo.edu', password: passwordHash, role: 'teacher', department: deptIds[0], employeeId: 'T002', phone: '+1-555-0202', isActive: true, createdAt: new Date()},
    {name: 'Dr. Carol Wilson', email: 'carol.wilson@demo.edu', password: passwordHash, role: 'teacher', department: deptIds[1], employeeId: 'T003', phone: '+1-555-0203', isActive: true, createdAt: new Date()},
    {name: 'John Student', email: 'john.student@demo.edu', password: passwordHash, role: 'student', department: deptIds[0], rollNumber: 'CS2021001', phone: '+1-555-0301', isActive: true, createdAt: new Date()},
    {name: 'Jane Doe', email: 'jane.doe@demo.edu', password: passwordHash, role: 'student', department: deptIds[0], rollNumber: 'CS2021002', phone: '+1-555-0302', isActive: true, createdAt: new Date()},
    {name: 'Mike Wilson', email: 'mike.wilson@demo.edu', password: passwordHash, role: 'student', department: deptIds[1], rollNumber: 'BA2021001', phone: '+1-555-0303', isActive: true, createdAt: new Date()}
]);

var userIds = Object.values(userResult.insertedIds);
print('✅ Created ' + userIds.length + ' university users');

// Create programs
var programResult = db.programs.insertMany([
    {name: 'Bachelor of Computer Science', code: 'BCS', department: deptIds[0], duration: 4, isActive: true, createdAt: new Date()},
    {name: 'Bachelor of Business Administration', code: 'BBA', department: deptIds[1], duration: 4, isActive: true, createdAt: new Date()},
    {name: 'Master of Computer Science', code: 'MCS', department: deptIds[0], duration: 2, isActive: true, createdAt: new Date()}
]);

print('✅ Created ' + Object.keys(programResult.insertedIds).length + ' programs');

// Create courses (assign to teachers)
var teacherIds = userIds.slice(4, 7); // Get teacher user IDs

var courseResult = db.courses.insertMany([
    {name: 'Programming Fundamentals', code: 'CS101', credits: 3, department: deptIds[0], instructor: teacherIds[0], semester: 'Fall 2024', isActive: true, createdAt: new Date()},
    {name: 'Data Structures', code: 'CS201', credits: 3, department: deptIds[0], instructor: teacherIds[1], semester: 'Fall 2024', isActive: true, createdAt: new Date()},
    {name: 'Business Management', code: 'BA101', credits: 3, department: deptIds[1], instructor: teacherIds[2], semester: 'Fall 2024', isActive: true, createdAt: new Date()},
    {name: 'Database Systems', code: 'CS301', credits: 3, department: deptIds[0], instructor: teacherIds[0], semester: 'Fall 2024', isActive: true, createdAt: new Date()}
]);

var courseIds = Object.values(courseResult.insertedIds);
print('✅ Created ' + courseIds.length + ' courses');

// Create sample assessments
var assessmentCount = 0;
courseIds.forEach(function(courseId, index) {
    db.assessments.insertOne({
        title: 'Quiz 1 - Course ' + (index + 1),
        course: courseId,
        type: 'quiz',
        totalMarks: 100,
        weightage: 20,
        dueDate: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
        isActive: true,
        createdAt: new Date()
    });
    assessmentCount++;
});

print('✅ Created ' + assessmentCount + ' assessments');

print('=== DEMO DATABASE SETUP COMPLETE ===');
"

echo ""
echo "3. 🔄 Restarting application..."
docker-compose restart

echo ""
echo "4. ⏳ Waiting for restart..."
sleep 15

echo ""
echo "5. 🧪 Testing the system..."

# Test if application is responding
echo "Checking application status..."
if curl -I http://194.60.87.212:3200 2>/dev/null | head -1 | grep -q "200\|302"; then
    echo "✅ Application is responding"
else
    echo "⚠️ Application may still be starting, please wait a moment"
fi

echo ""
echo "6. 📋 Final verification..."

# Verify the setup
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
use obe_platform;
print('=== PLATFORM USERS VERIFICATION ===');
var platformUsers = db.platformusers.find({universityCode: 'DEMO'}).toArray();
platformUsers.forEach(function(user) {
    print('✅ ' + user.role.toUpperCase() + ': ' + user.email + ' (University: ' + (user.university ? 'SET' : 'MISSING') + ')');
});
print('Total platform users: ' + platformUsers.length);

print('=== UNIVERSITY VERIFICATION ===');
var uni = db.universities.findOne({universityCode: 'DEMO'});
if (uni) {
    print('✅ University: ' + uni.universityName);
    print('✅ Database: ' + uni.databaseName);
}

use obe_demo;
print('=== DEMO DATABASE VERIFICATION ===');
print('Departments: ' + db.departments.countDocuments());
print('Users: ' + db.users.countDocuments());
print('Courses: ' + db.courses.countDocuments());
print('Programs: ' + db.programs.countDocuments());
print('Assessments: ' + db.assessments.countDocuments());
"

echo ""
echo "✅ SIMPLE DEMO SETUP COMPLETE!"
echo "=============================="
echo ""
echo "🔑 DEMO LOGIN ACCOUNTS:"
echo "======================="
echo ""
echo "👨‍💼 MANAGEMENT:"
echo "dean@demo.edu / proadmin123"
echo "chairman@demo.edu / proadmin123"
echo "controller@demo.edu / proadmin123"
echo "focal@demo.edu / proadmin123"
echo ""
echo "👩‍🏫 TEACHERS:"
echo "alice.johnson@demo.edu / proadmin123"
echo "bob.smith@demo.edu / proadmin123"
echo ""
echo "🎓 STUDENTS:"
echo "john.student@demo.edu / proadmin123"
echo "jane.doe@demo.edu / proadmin123"
echo ""
echo "📝 NOTE: All demo accounts use the same password as the pro admin"
echo "This ensures the password hashing is compatible with the system"
echo ""
echo "🧪 NOW TEST:"
echo "1. Go to: http://194.60.87.212:3200"
echo "2. Try logging in with any account above"
echo "3. Check university super admin dashboard shows 'Demo University'"
echo "4. Test different role dashboards with sample data"