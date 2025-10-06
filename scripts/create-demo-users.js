const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'mysql.gb.stackcp.com',
    port: process.env.DB_PORT || 39558,
    user: process.env.DB_USER || 'questobe',
    password: process.env.DB_PASSWORD || 'Quest123@',
    database: process.env.DB_NAME || 'questobe-35313139c836'
};

// Demo users data
const demoUsers = [
    {
        name: 'Ahmad Ali',
        email: 'student@quest.edu.pk',
        password: 'pass',
        role: 'student',
        department: 'Computer Science',
        studentId: 'QUEST-2024-001',
        semester: '7th',
        batch: '2021'
    },
    {
        name: 'Dr. Muhammad Hassan',
        email: 'teacher@quest.edu.pk',
        password: 'pass',
        role: 'teacher',
        department: 'Computer Science',
        employeeId: 'EMP-001',
        designation: 'Assistant Professor'
    },
    {
        name: 'Dr. Usman Ahmed',
        email: 'focal@quest.edu.pk',
        password: 'pass',
        role: 'focal',
        department: 'Computer Science',
        employeeId: 'EMP-003',
        designation: 'Focal Person'
    },
    {
        name: 'Prof. Dr. Khalid Mahmood',
        email: 'chairman@quest.edu.pk',
        password: 'pass',
        role: 'chairman',
        department: 'Computer Science',
        employeeId: 'EMP-004',
        designation: 'Chairman'
    },
    {
        name: 'Prof. Dr. Fatima Sheikh',
        email: 'dean@quest.edu.pk',
        password: 'pass',
        role: 'dean',
        department: 'All Departments',
        employeeId: 'EMP-005',
        designation: 'Dean'
    },
    {
        name: 'Dr. Imran Khan',
        email: 'controller@quest.edu.pk',
        password: 'pass',
        role: 'controller',
        department: 'Examination',
        employeeId: 'EMP-006',
        designation: 'Controller'
    },
    {
        name: 'System Administrator',
        email: 'superadmin@quest.edu.pk',
        password: 'pass',
        role: 'superadmin',
        department: 'Administration',
        employeeId: 'ADMIN-001',
        designation: 'Super Administrator'
    }
];

async function createUsersTable() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        // Create users table if it doesn't exist
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('student', 'teacher', 'focal', 'chairman', 'dean', 'controller', 'superadmin') NOT NULL,
                department VARCHAR(255),
                designation VARCHAR(255),
                semester VARCHAR(50),
                batch VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `;
        
        await connection.execute(createTableQuery);
        console.log('✅ Users table created/verified successfully');
        
    } catch (error) {
        console.error('❌ Error creating users table:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

async function addDemoUsers() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        console.log('🚀 Starting to add demo users...');
        
        for (const user of demoUsers) {
            try {
                // Check if user already exists
                const checkQuery = 'SELECT id FROM users WHERE email = ?';
                const [existingUsers] = await connection.execute(checkQuery, [user.email]);
                
                if (existingUsers.length > 0) {
                    console.log(`⚠️  User ${user.email} already exists, skipping...`);
                    continue;
                }
                
                // Hash password
                const hashedPassword = await bcrypt.hash(user.password, 12);
                
                // Insert user
                const insertQuery = `
                    INSERT INTO users (
                        name, email, password, role, department, 
                        designation, semester, batch, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                `;
                
                await connection.execute(insertQuery, [
                    user.name,
                    user.email,
                    hashedPassword,
                    user.role,
                    user.department,
                    user.designation || null,
                    user.semester || null,
                    user.batch || null
                ]);
                
                console.log(`✅ Created user: ${user.name} (${user.email}) - ${user.role}`);
                
            } catch (error) {
                console.error(`❌ Error creating user ${user.email}:`, error.message);
            }
        }
        
        console.log('🎉 Demo users creation completed!');
        
    } catch (error) {
        console.error('❌ Error in demo users creation:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

async function verifyUsers() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        const query = 'SELECT id, name, email, role, department FROM users ORDER BY role, name';
        const [users] = await connection.execute(query);
        
        console.log('\n📋 Current Users in Database:');
        console.log('================================');
        
        users.forEach(user => {
            console.log(`${user.id}. ${user.name} (${user.email}) - ${user.role} - ${user.department || 'N/A'}`);
        });
        
        console.log(`\nTotal Users: ${users.length}`);
        
    } catch (error) {
        console.error('❌ Error verifying users:', error);
    } finally {
        await connection.end();
    }
}

async function main() {
    try {
        console.log('🎯 QUEST OBE Portal - Demo Users Setup');
        console.log('=====================================');
        
        // Create users table
        await createUsersTable();
        
        // Add demo users
        await addDemoUsers();
        
        // Verify users
        await verifyUsers();
        
        console.log('\n🎉 Setup completed successfully!');
        console.log('\n📱 You can now login with any of these accounts:');
        console.log('• Student: student@quest.edu.pk / pass');
        console.log('• Teacher: teacher@quest.edu.pk / pass');
        console.log('• Focal: focal@quest.edu.pk / pass');
        console.log('• Chairman: chairman@quest.edu.pk / pass');
        console.log('• Dean: dean@quest.edu.pk / pass');
        console.log('• Controller: controller@quest.edu.pk / pass');
        console.log('• Superadmin: superadmin@quest.edu.pk / pass');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { createUsersTable, addDemoUsers, verifyUsers };
