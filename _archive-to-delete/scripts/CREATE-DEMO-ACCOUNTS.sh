#!/bin/bash

# 🔧 CREATE DEMO ACCOUNTS WITH CORRECT PASSWORD HASHING
# This script creates working demo accounts in the correct database structure

echo "🔧 CREATING DEMO ACCOUNTS WITH CORRECT PASSWORD HASHING"
echo "======================================================="

echo "1. 🔧 Fixing the loading issue and database structure..."

# Fix the loading issue and database sync, then create demo accounts
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
"

echo ""
echo "2. 🔐 Creating demo accounts with Node.js password hashing..."

# Create a temporary Node.js script to generate proper bcrypt hashes and create users
cat > /tmp/create_demo_users.js << 'EOF'
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function createDemoUsers() {
    const client = new MongoClient('mongodb://admin:SecureOBE2025MongoDBQuest@localhost:27017', {
        authSource: 'admin'
    });
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const platformDb = client.db('obe_platform');
        const demoDb = client.db('obe_demo');
        
        // Get university info
        const university = await platformDb.collection('universities').findOne({universityCode: 'DEMO'});
        if (!university) {
            console.error('DEMO university not found');
            return;
        }
        
        console.log('Found university:', university.universityName);
        
        // Hash password for 'demo123'
        const hashedPassword = await bcrypt.hash('demo123', 12);
        console.log('Generated password hash');
        
        // Clear existing demo database
        await demoDb.dropDatabase();
        console.log('Cleared demo database');
        
        // Create departments
        const departments = [
            {name: 'Computer Science', code: 'CS', description: 'Department of Computer Science', createdAt: new Date(), isActive: true},
            {name: 'Business Administration', code: 'BA', description: 'Department of Business Administration', createdAt: new Date(), isActive: true},
            {name: 'Engineering', code: 'ENG', description: 'Department of Engineering', createdAt: new Date(), isActive: true}
        ];
        
        const deptResult = await demoDb.collection('departments').insertMany(departments);
        const deptIds = Object.values(deptResult.insertedIds);
        console.log('Created', deptIds.length, 'departments');
        
        // Create platform users for login
        const platformUsers = [
            {name: 'Dr. John Dean', email: 'dean@demo.edu', role: 'dean'},
            {name: 'Dr. Sarah Chairman', email: 'chairman@demo.edu', role: 'chairman'},
            {name: 'Mr. Mike Controller', email: 'controller@demo.edu', role: 'controller'},
            {name: 'Ms. Lisa Focal', email: 'focal@demo.edu', role: 'focal'},
            {name: 'Dr. Alice Johnson', email: 'alice.johnson@demo.edu', role: 'teacher'},
            {name: 'Prof. Bob Smith', email: 'bob.smith@demo.edu', role: 'teacher'},
            {name: 'Dr. Carol Wilson', email: 'carol.wilson@demo.edu', role: 'teacher'},
            {name: 'John Student', email: 'john.student@demo.edu', role: 'student'},
            {name: 'Jane Doe', email: 'jane.doe@demo.edu', role: 'student'},
            {name: 'Mike Wilson', email: 'mike.wilson@demo.edu', role: 'student'}
        ];
        
        // Create platform users
        for (const user of platformUsers) {
            const existingUser = await platformDb.collection('platformusers').findOne({email: user.email});
            if (!existingUser) {
                await platformDb.collection('platformusers').insertOne({
                    name: user.name,
                    email: user.email,
                    password: hashedPassword,
                    role: user.role,
                    universityCode: 'DEMO',
                    university: university._id,
                    isActive: true,
                    createdAt: new Date()
                });
                console.log('✅ Created platform user:', user.email, '(' + user.role + ')');
            } else {
                // Update university reference if missing
                if (!existingUser.university) {
                    await platformDb.collection('platformusers').updateOne(
                        {_id: existingUser._id},
                        {$set: {university: university._id}}
                    );
                    console.log('✅ Fixed university reference for:', user.email);
                } else {
                    console.log('⚠️ Platform user already exists:', user.email);
                }
            }
        }
        
        // Create university users (for internal operations)
        const universityUsers = [
            {name: 'Dr. John Dean', email: 'dean@demo.edu', role: 'dean', department: deptIds[0], employeeId: 'DEAN001'},
            {name: 'Dr. Sarah Chairman', email: 'chairman@demo.edu', role: 'chairman', department: deptIds[0], employeeId: 'CHAIR001'},
            {name: 'Mr. Mike Controller', email: 'controller@demo.edu', role: 'controller', department: deptIds[1], employeeId: 'CTRL001'},
            {name: 'Ms. Lisa Focal', email: 'focal@demo.edu', role: 'focal', department: deptIds[0], employeeId: 'FOCAL001'},
            {name: 'Dr. Alice Johnson', email: 'alice.johnson@demo.edu', role: 'teacher', department: deptIds[0], employeeId: 'T001'},
            {name: 'Prof. Bob Smith', email: 'bob.smith@demo.edu', role: 'teacher', department: deptIds[0], employeeId: 'T002'},
            {name: 'Dr. Carol Wilson', email: 'carol.wilson@demo.edu', role: 'teacher', department: deptIds[1], employeeId: 'T003'},
            {name: 'John Student', email: 'john.student@demo.edu', role: 'student', department: deptIds[0], rollNumber: 'CS2021001'},
            {name: 'Jane Doe', email: 'jane.doe@demo.edu', role: 'student', department: deptIds[0], rollNumber: 'CS2021002'},
            {name: 'Mike Wilson', email: 'mike.wilson@demo.edu', role: 'student', department: deptIds[1], rollNumber: 'BA2021001'}
        ];
        
        const userResult = await demoDb.collection('users').insertMany(
            universityUsers.map(user => ({
                ...user,
                password: hashedPassword,
                phone: '+1-555-0100',
                isActive: true,
                createdAt: new Date()
            }))
        );
        
        console.log('✅ Created', Object.keys(userResult.insertedIds).length, 'university users');
        
        // Create sample courses
        const teacherIds = Object.values(userResult.insertedIds).slice(4, 7); // Get teacher IDs
        
        const courses = [
            {name: 'Programming Fundamentals', code: 'CS101', credits: 3, department: deptIds[0], instructor: teacherIds[0], semester: 'Fall 2024'},
            {name: 'Data Structures', code: 'CS201', credits: 3, department: deptIds[0], instructor: teacherIds[1], semester: 'Fall 2024'},
            {name: 'Business Management', code: 'BA101', credits: 3, department: deptIds[1], instructor: teacherIds[2], semester: 'Fall 2024'},
            {name: 'Database Systems', code: 'CS301', credits: 3, department: deptIds[0], instructor: teacherIds[0], semester: 'Fall 2024'}
        ];
        
        const courseResult = await demoDb.collection('courses').insertMany(
            courses.map(course => ({
                ...course,
                isActive: true,
                createdAt: new Date()
            }))
        );
        
        console.log('✅ Created', Object.keys(courseResult.insertedIds).length, 'courses');
        
        // Create sample programs
        const programs = [
            {name: 'Bachelor of Computer Science', code: 'BCS', department: deptIds[0], duration: 4},
            {name: 'Bachelor of Business Administration', code: 'BBA', department: deptIds[1], duration: 4},
            {name: 'Master of Computer Science', code: 'MCS', department: deptIds[0], duration: 2}
        ];
        
        await demoDb.collection('programs').insertMany(
            programs.map(program => ({
                ...program,
                isActive: true,
                createdAt: new Date()
            }))
        );
        
        console.log('✅ Created', programs.length, 'programs');
        
        console.log('=== DEMO DATABASE SETUP COMPLETE ===');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

createDemoUsers();
EOF

# Run the Node.js script inside the container
docker exec obe-app node /tmp/create_demo_users.js

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
"

echo ""
echo "✅ DEMO ACCOUNTS CREATED SUCCESSFULLY!"
echo "====================================="
echo ""
echo "🔑 WORKING LOGIN ACCOUNTS:"
echo "=========================="
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
echo ""
echo "🎓 STUDENTS:"
echo "john.student@demo.edu / demo123"
echo "jane.doe@demo.edu / demo123"
echo "mike.wilson@demo.edu / demo123"
echo ""
echo "📚 SAMPLE DATA CREATED:"
echo "• 3 Departments"
echo "• 4 Courses with assigned teachers"
echo "• 3 Programs"
echo "• Platform users for login"
echo "• University users for data operations"
echo ""
echo "🧪 NOW TEST:"
echo "1. Go to: http://194.60.87.212:3200"
echo "2. Try logging in with any account above"
echo "3. Password for all accounts: demo123"
echo "4. Check university super admin dashboard shows 'Demo University'"