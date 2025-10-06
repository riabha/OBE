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
        department: 'Computer Science'
    },
    {
        name: 'Dr. Muhammad Hassan',
        email: 'teacher@quest.edu.pk',
        password: 'pass',
        role: 'teacher',
        department: 'Computer Science'
    },
    {
        name: 'Dr. Usman Ahmed',
        email: 'focal@quest.edu.pk',
        password: 'pass',
        role: 'focal',
        department: 'Computer Science'
    },
    {
        name: 'Prof. Dr. Khalid Mahmood',
        email: 'chairman@quest.edu.pk',
        password: 'pass',
        role: 'chairman',
        department: 'Computer Science'
    },
    {
        name: 'Prof. Dr. Fatima Sheikh',
        email: 'dean@quest.edu.pk',
        password: 'pass',
        role: 'dean',
        department: 'All Departments'
    },
    {
        name: 'Dr. Imran Khan',
        email: 'controller@quest.edu.pk',
        password: 'pass',
        role: 'controller',
        department: 'Examination'
    },
    {
        name: 'System Administrator',
        email: 'superadmin@quest.edu.pk',
        password: 'pass',
        role: 'superadmin',
        department: 'Administration'
    }
];

async function checkTableStructure() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        console.log('🔍 Checking users table structure...');
        
        // Check if users table exists
        const [tables] = await connection.execute("SHOW TABLES LIKE 'users'");
        
        if (tables.length === 0) {
            console.log('📝 Creating users table...');
            const createTableQuery = `
                CREATE TABLE users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    department VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;
            await connection.execute(createTableQuery);
            console.log('✅ Users table created successfully');
        } else {
            console.log('✅ Users table exists');
            
            // Check table structure
            const [columns] = await connection.execute("DESCRIBE users");
            console.log('📋 Table columns:');
            columns.forEach(col => {
                console.log(`  - ${col.Field} (${col.Type})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error checking table structure:', error);
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
                
                // Insert user with basic fields only
                const insertQuery = `
                    INSERT INTO users (name, email, password, role, department)
                    VALUES (?, ?, ?, ?, ?)
                `;
                
                await connection.execute(insertQuery, [
                    user.name,
                    user.email,
                    hashedPassword,
                    user.role,
                    user.department
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
        
        // Check table structure
        await checkTableStructure();
        
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

module.exports = { checkTableStructure, addDemoUsers, verifyUsers };
