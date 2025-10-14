const mysql = require('mysql2/promise');
require('dotenv').config({ path: './config.env' });

const dbConfig = {
    host: process.env.DB_HOST || 'mysql.gb.stackcp.com',
    port: process.env.DB_PORT || 39558,
    user: process.env.DB_USER || 'questobe',
    password: process.env.DB_PASSWORD || 'Quest123@',
    database: process.env.DB_NAME || 'questobe-35313139c836',
};

console.log('🔄 Testing database connection...\n');
console.log('Database Configuration:');
console.log('  Host:', dbConfig.host);
console.log('  Port:', dbConfig.port);
console.log('  Database:', dbConfig.database);
console.log('  User:', dbConfig.user);
console.log('  Password:', '*'.repeat(dbConfig.password.length));
console.log('');

async function testConnection() {
    let connection;
    try {
        // Test connection
        console.log('⏳ Attempting to connect...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connection established successfully!\n');

        // Test database access
        console.log('⏳ Testing database access...');
        await connection.ping();
        console.log('✅ Database ping successful!\n');

        // Test tables
        console.log('⏳ Checking tables...');
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`✅ Found ${tables.length} tables:\n`);
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`   - ${tableName}`);
        });
        console.log('');

        // Check users table
        console.log('⏳ Checking users table...');
        try {
            const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
            console.log(`✅ Users table exists with ${users[0].count} users\n`);
            
            // Show user roles
            const [roles] = await connection.execute('SELECT role, COUNT(*) as count FROM users GROUP BY role');
            console.log('User roles distribution:');
            roles.forEach(role => {
                console.log(`   - ${role.role}: ${role.count}`);
            });
            console.log('');
        } catch (error) {
            console.log('⚠️  Users table not found or empty\n');
        }

        // Check courses table
        console.log('⏳ Checking courses table...');
        try {
            const [courses] = await connection.execute('SELECT COUNT(*) as count FROM courses');
            console.log(`✅ Courses table exists with ${courses[0].count} courses\n`);
        } catch (error) {
            console.log('⚠️  Courses table not found or empty\n');
        }

        console.log('═══════════════════════════════════════════════');
        console.log('✅ DATABASE CONNECTION TEST PASSED!');
        console.log('═══════════════════════════════════════════════\n');
        console.log('Your database connection is working correctly.');
        console.log('You can now deploy to Vercel with confidence.\n');
        console.log('Remember to set these environment variables in Vercel:');
        console.log(`  DB_HOST=${dbConfig.host}`);
        console.log(`  DB_PORT=${dbConfig.port}`);
        console.log(`  DB_NAME=${dbConfig.database}`);
        console.log(`  DB_USER=${dbConfig.user}`);
        console.log(`  DB_PASSWORD=${dbConfig.password}`);
        console.log(`  JWT_SECRET=quest_obe_jwt_secret_key_2024`);
        console.log('');

    } catch (error) {
        console.log('═══════════════════════════════════════════════');
        console.log('❌ DATABASE CONNECTION TEST FAILED!');
        console.log('═══════════════════════════════════════════════\n');
        console.log('Error Details:');
        console.log('  Message:', error.message);
        console.log('  Code:', error.code || 'N/A');
        console.log('  Errno:', error.errno || 'N/A');
        console.log('');
        console.log('Common Issues:');
        console.log('  1. Incorrect database credentials');
        console.log('  2. Database server is down or unreachable');
        console.log('  3. Firewall blocking the connection');
        console.log('  4. IP address not whitelisted');
        console.log('');
        console.log('Solutions:');
        console.log('  1. Verify credentials in config.env file');
        console.log('  2. Check database server status in StackCP');
        console.log('  3. Contact hosting provider to whitelist your IP');
        console.log('  4. Check if database allows remote connections');
        console.log('');
        
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Connection closed.\n');
        }
    }
}

testConnection();

