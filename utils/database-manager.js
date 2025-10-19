const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const universitySchema = require('../migrations/university-schema');

class DatabaseManager {
    constructor() {
        this.connections = new Map(); // Store connection pools for each university
        this.platformPool = null; // Platform database pool
    }

    // Initialize platform database connection
    initPlatformDatabase(config) {
        this.platformPool = mysql.createPool(config);
        console.log('✅ Platform database connection initialized');
        return this.platformPool;
    }

    // Get platform database connection
    getPlatformDB() {
        return this.platformPool;
    }

    // Create a new database for a university
    async createUniversityDatabase(universitySlug, superAdminEmail, superAdminPassword) {
        const dbName = `obe_university_${universitySlug}`;
        
        try {
            console.log(`\n🏗️  Creating database for university: ${universitySlug}`);
            
            // 1. Create the database
            await this.platformPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
            console.log(`  ✅ Database created: ${dbName}`);

            // 2. Connect to the new database
            const uniConnection = await mysql.createConnection({
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: dbName
            });

            // 3. Run schema migrations
            await universitySchema.runMigrations(uniConnection);

            // 4. Create super admin in university database
            const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
            await uniConnection.execute(
                `INSERT INTO users (email, password, role, name, department, permissions) 
                 VALUES (?, ?, 'superadmin', ?, 'Administration', ?)`,
                [
                    superAdminEmail,
                    hashedPassword,
                    `${universitySlug.toUpperCase()} Administrator`,
                    JSON.stringify(['all'])
                ]
            );
            console.log(`  ✅ Super admin created in ${dbName}`);

            await uniConnection.end();

            // 5. Create connection pool for this university
            await this.getUniversityConnection(dbName);

            console.log(`✅ University database setup complete: ${dbName}\n`);
            return dbName;

        } catch (error) {
            console.error(`❌ Error creating university database:`, error);
            throw error;
        }
    }

    // Get or create connection pool for a university database
    async getUniversityConnection(databaseName) {
        if (!this.connections.has(databaseName)) {
            // Fetch the correct credentials for this database from database_connections table
            const [dbConfig] = await this.platformPool.execute(
                'SELECT host, port, username, password FROM database_connections WHERE databaseName = ?',
                [databaseName]
            );

            if (dbConfig.length === 0) {
                throw new Error(`Database connection configuration not found for: ${databaseName}`);
            }

            const config = dbConfig[0];
            const pool = mysql.createPool({
                host: config.host,
                port: config.port,
                user: config.username,
                password: config.password,
                database: databaseName,
                waitForConnections: true,
                connectionLimit: 5,
                queueLimit: 0
            });

            this.connections.set(databaseName, pool);
            console.log(`  ✅ Connection pool created for: ${databaseName}`);
        }

        return this.connections.get(databaseName);
    }

    // Determine which database to use based on user
    async getDatabaseForUser(email) {
        // Check if user is a platform user (PRO admin or other platform roles)
        const [platformUsers] = await this.platformPool.execute(
            'SELECT id FROM platform_users WHERE email = ?',
            [email]
        );

        if (platformUsers.length > 0) {
            return { 
                type: 'platform', 
                database: this.platformPool,
                databaseName: 'platform'
            };
        }

        // Find university for this user (by superAdminEmail)
        const [universities] = await this.platformPool.execute(
            `SELECT id, universityCode, databaseName 
             FROM universities 
             WHERE superAdminEmail = ? 
             LIMIT 1`,
            [email]
        );

        if (universities.length > 0) {
            const dbName = universities[0].databaseName;
            const connection = await this.getUniversityConnection(dbName);
            
            return {
                type: 'university',
                database: connection,
                databaseName: dbName,
                universityId: universities[0].id,
                universityCode: universities[0].universityCode
            };
        }

        throw new Error('No database found for this user');
    }

    // Close a specific university connection
    async closeUniversityConnection(databaseName) {
        if (this.connections.has(databaseName)) {
            const pool = this.connections.get(databaseName);
            await pool.end();
            this.connections.delete(databaseName);
            console.log(`  ✅ Closed connection: ${databaseName}`);
        }
    }

    // Close all connections
    async closeAll() {
        if (this.platformPool) {
            await this.platformPool.end();
        }

        for (const [name, pool] of this.connections.entries()) {
            await pool.end();
            console.log(`  ✅ Closed connection: ${name}`);
        }

        this.connections.clear();
    }

    // Get all university databases
    async getAllUniversityDatabases() {
        const [universities] = await this.platformPool.execute(
            'SELECT universityCode, databaseName FROM universities WHERE isActive = TRUE'
        );

        return universities.map(uni => ({
            code: uni.universityCode,
            database: uni.databaseName
        }));
    }

    // Get statistics across all university databases
    async getPlatformStatistics() {
        try {
            // Get list of all university databases
            const universities = await this.getAllUniversityDatabases();

            let totalUsers = 1; // PRO admin
            let totalCourses = 0;

            // Query each university database
            for (const uni of universities) {
                try {
                    const db = await this.getUniversityConnection(uni.database);
                    
                    const [userCount] = await db.execute('SELECT COUNT(*) as count FROM users');
                    const [courseCount] = await db.execute('SELECT COUNT(*) as count FROM courses');
                    
                    totalUsers += userCount[0].count;
                    totalCourses += courseCount[0].count;
                } catch (error) {
                    console.error(`Error querying ${uni.database}:`, error.message);
                }
            }

            return {
                totalUniversities: universities.length,
                totalUsers,
                totalCourses
            };
        } catch (error) {
            console.error('Error getting platform statistics:', error);
            return {
                totalUniversities: 0,
                totalUsers: 1,
                totalCourses: 0
            };
        }
    }
}

// Singleton instance
const dbManager = new DatabaseManager();

module.exports = dbManager;

