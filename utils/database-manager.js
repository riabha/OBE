const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import schemas
const universitySchema = require('../models/University');
const platformUserSchema = require('../models/PlatformUser');

class DatabaseManager {
    constructor() {
        this.connections = new Map(); // Store MongoDB connections for each university
        this.platformConnection = null; // Platform database connection
        this.models = new Map(); // Store models for each connection
    }

    // Initialize platform database connection
    async initPlatformDatabase(mongoUri) {
        try {
            // Connect to platform database
            this.platformConnection = await mongoose.createConnection(mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 10,
                minPoolSize: 2,
                socketTimeoutMS: 45000,
            });

            // Register models on platform connection
            this.models.set('platform_University', this.platformConnection.model('University', universitySchema));
            this.models.set('platform_PlatformUser', this.platformConnection.model('PlatformUser', platformUserSchema));

            console.log('✅ Platform MongoDB database connected:', mongoUri.replace(/\/\/.*@/, '//***:***@'));
            return this.platformConnection;
        } catch (error) {
            console.error('❌ Platform database connection failed:', error.message);
            throw error;
        }
    }

    // Get platform database connection
    getPlatformDB() {
        return this.platformConnection;
    }

    // Get platform model
    getPlatformModel(modelName) {
        return this.models.get(`platform_${modelName}`);
    }

    // Create a new MongoDB database for a university (auto-create)
    async createUniversityDatabase(universitySlug, superAdminEmail, superAdminPassword, universityData = {}) {
        const dbName = `obe_university_${universitySlug}`;
        
        try {
            console.log(`\n🏗️  Creating MongoDB database for university: ${universitySlug}`);
            
            // Step 1: Create MongoDB URI for the new university database
            const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
            const uriWithoutDb = baseUri.substring(0, baseUri.lastIndexOf('/'));
            const universityMongoUri = `${uriWithoutDb}/${dbName}`;

            console.log(`  ℹ️  University DB URI: ${universityMongoUri.replace(/\/\/.*@/, '//***:***@')}`);

            // Step 2: Connect to the university database (MongoDB auto-creates it)
            const uniConnection = await mongoose.createConnection(universityMongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 5,
                minPoolSize: 1,
            });

            console.log(`  ✅ MongoDB database auto-created: ${dbName}`);

            // Step 3: Define models for university database
            const User = uniConnection.model('User', require('../models/User').schema);
            const Department = uniConnection.model('Department', require('../models/Department').schema);
            const Course = uniConnection.model('Course', require('../models/Course').schema);

            // Step 4: Create super admin in university database
            const hashedPassword = await bcrypt.hash(superAdminPassword, 12);
            const superAdmin = new User({
                firstName: universityData.universityName || universitySlug.toUpperCase(),
                lastName: 'Administrator',
                email: superAdminEmail,
                password: hashedPassword,
                role: 'controller', // Highest role in university
                phone: universityData.contactPhone || '+92-300-0000000',
                isActive: true,
                isEmailVerified: true
            });

            await superAdmin.save();
            console.log(`  ✅ Super admin created in ${dbName}`);

            // Step 5: Create default department if provided
            if (universityData.defaultDepartment) {
                const defaultDept = new Department({
                    name: universityData.defaultDepartment,
                    code: universityData.defaultDepartment.substring(0, 3).toUpperCase(),
                    faculty: 'Engineering',
                    chairman: superAdmin._id,
                    contactInfo: {
                        email: universityData.contactEmail || superAdminEmail,
                        phone: universityData.contactPhone || '+92-300-0000000'
                    },
                    isActive: true
                });
                await defaultDept.save();
                console.log(`  ✅ Default department created: ${universityData.defaultDepartment}`);
            }

            // Step 6: Store connection for future use
            this.connections.set(dbName, uniConnection);
            
            // Store models for this university
            this.models.set(`${dbName}_User`, User);
            this.models.set(`${dbName}_Department`, Department);
            this.models.set(`${dbName}_Course`, Course);

            // Step 7: Save university info to platform database
            const University = this.getPlatformModel('University');
            const newUniversity = new University({
                universityName: universityData.universityName || universitySlug.toUpperCase(),
                universityCode: universitySlug.toUpperCase(),
                databaseName: dbName,
                logo: universityData.logo || null,
                primaryColor: universityData.primaryColor || '#2563eb',
                secondaryColor: universityData.secondaryColor || '#7c3aed',
                address: universityData.address || null,
                city: universityData.city || null,
                country: universityData.country || 'Pakistan',
                contactEmail: universityData.contactEmail || superAdminEmail,
                contactPhone: universityData.contactPhone || null,
                website: universityData.website || null,
                superAdminEmail: superAdminEmail,
                subscriptionPlan: universityData.subscriptionPlan || 'Basic',
                subscriptionStatus: universityData.subscriptionStatus || 'Active',
                maxUsers: universityData.maxUsers || 1000,
                maxCourses: universityData.maxCourses || 100,
                isActive: true
            });

            await newUniversity.save();
            console.log(`  ✅ University registered in platform database`);

            console.log(`✅ University database setup complete: ${dbName}\n`);
            return {
                databaseName: dbName,
                connection: uniConnection,
                universityId: newUniversity._id
            };

        } catch (error) {
            console.error(`❌ Error creating university database:`, error);
            throw error;
        }
    }

    // Get or create connection for a university database
    async getUniversityConnection(databaseName) {
        try {
            if (!this.connections.has(databaseName)) {
                // Fetch university info from platform database
                const University = this.getPlatformModel('University');
                const university = await University.findOne({ databaseName });

                if (!university) {
                    throw new Error(`University not found for database: ${databaseName}`);
                }

                // Create MongoDB URI for university database
                const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
                const uriWithoutDb = baseUri.substring(0, baseUri.lastIndexOf('/'));
                const universityMongoUri = `${uriWithoutDb}/${databaseName}`;

                // Connect to university database
                const uniConnection = await mongoose.createConnection(universityMongoUri, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    maxPoolSize: 5,
                    minPoolSize: 1,
                });

                // Define models for this connection
                const User = uniConnection.model('User', require('../models/User').schema);
                const Department = uniConnection.model('Department', require('../models/Department').schema);
                const Course = uniConnection.model('Course', require('../models/Course').schema);

                this.connections.set(databaseName, uniConnection);
                this.models.set(`${databaseName}_User`, User);
                this.models.set(`${databaseName}_Department`, Department);
                this.models.set(`${databaseName}_Course`, Course);

                console.log(`  ✅ Connection pool created for: ${databaseName}`);
            }

            return this.connections.get(databaseName);
        } catch (error) {
            console.error(`❌ Error getting university connection:`, error);
            throw error;
        }
    }

    // Get model for a specific university database
    getUniversityModel(databaseName, modelName) {
        return this.models.get(`${databaseName}_${modelName}`);
    }

    // Determine which database to use based on user email
    async getDatabaseForUser(email) {
        try {
            // Check if user is a platform user (PRO admin or other platform roles)
            const PlatformUser = this.getPlatformModel('PlatformUser');
            const platformUser = await PlatformUser.findOne({ email });

            if (platformUser) {
                return { 
                    type: 'platform', 
                    connection: this.platformConnection,
                    databaseName: 'platform',
                    user: platformUser
                };
            }

            // Find university for this user (by superAdminEmail)
            const University = this.getPlatformModel('University');
            const university = await University.findOne({ 
                superAdminEmail: email,
                isActive: true
            });

            if (university) {
                const connection = await this.getUniversityConnection(university.databaseName);
                
                return {
                    type: 'university',
                    connection: connection,
                    databaseName: university.databaseName,
                    universityId: university._id,
                    universityCode: university.universityCode,
                    university: university
                };
            }

            // Check if user exists in any university database
            const universities = await University.find({ isActive: true });
            
            for (const uni of universities) {
                try {
                    const connection = await this.getUniversityConnection(uni.databaseName);
                    const User = this.getUniversityModel(uni.databaseName, 'User');
                    const user = await User.findOne({ email });
                    
                    if (user) {
                        return {
                            type: 'university',
                            connection: connection,
                            databaseName: uni.databaseName,
                            universityId: uni._id,
                            universityCode: uni.universityCode,
                            university: uni,
                            user: user
                        };
                    }
                } catch (err) {
                    console.error(`Error checking ${uni.databaseName}:`, err.message);
                }
            }

            throw new Error('No database found for this user');
        } catch (error) {
            console.error('Error in getDatabaseForUser:', error);
            throw error;
        }
    }

    // Close a specific university connection
    async closeUniversityConnection(databaseName) {
        if (this.connections.has(databaseName)) {
            const connection = this.connections.get(databaseName);
            await connection.close();
            this.connections.delete(databaseName);
            
            // Remove models
            this.models.delete(`${databaseName}_User`);
            this.models.delete(`${databaseName}_Department`);
            this.models.delete(`${databaseName}_Course`);
            
            console.log(`  ✅ Closed connection: ${databaseName}`);
        }
    }

    // Close all connections
    async closeAll() {
        if (this.platformConnection) {
            await this.platformConnection.close();
            console.log('  ✅ Platform connection closed');
        }

        for (const [name, connection] of this.connections.entries()) {
            await connection.close();
            console.log(`  ✅ Closed connection: ${name}`);
        }

        this.connections.clear();
        this.models.clear();
    }

    // Get all university databases
    async getAllUniversityDatabases() {
        const University = this.getPlatformModel('University');
        const universities = await University.find({ isActive: true });

        return universities.map(uni => ({
            code: uni.universityCode,
            name: uni.universityName,
            database: uni.databaseName,
            id: uni._id
        }));
    }

    // Get statistics across all university databases
    async getPlatformStatistics() {
        try {
            const universities = await this.getAllUniversityDatabases();

            let totalUsers = 0;
            let totalCourses = 0;
            let totalDepartments = 0;
            let totalStudents = 0;
            let totalTeachers = 0;

            // Query each university database
            for (const uni of universities) {
                try {
                    await this.getUniversityConnection(uni.database);
                    
                    const User = this.getUniversityModel(uni.database, 'User');
                    const Course = this.getUniversityModel(uni.database, 'Course');
                    const Department = this.getUniversityModel(uni.database, 'Department');
                    
                    const userCount = await User.countDocuments({ isActive: true });
                    const courseCount = await Course.countDocuments({ isActive: true });
                    const deptCount = await Department.countDocuments({ isActive: true });
                    const studentCount = await User.countDocuments({ role: 'student', isActive: true });
                    const teacherCount = await User.countDocuments({ role: 'teacher', isActive: true });
                    
                    totalUsers += userCount;
                    totalCourses += courseCount;
                    totalDepartments += deptCount;
                    totalStudents += studentCount;
                    totalTeachers += teacherCount;
                } catch (error) {
                    console.error(`Error querying ${uni.database}:`, error.message);
                }
            }

            // Count platform users
            const PlatformUser = this.getPlatformModel('PlatformUser');
            const platformUserCount = await PlatformUser.countDocuments({ isActive: true });

            return {
                totalUniversities: universities.length,
                totalUsers: totalUsers + platformUserCount,
                totalCourses,
                totalDepartments,
                totalStudents,
                totalTeachers,
                platformUsers: platformUserCount
            };
        } catch (error) {
            console.error('Error getting platform statistics:', error);
            return {
                totalUniversities: 0,
                totalUsers: 0,
                totalCourses: 0,
                totalDepartments: 0,
                totalStudents: 0,
                totalTeachers: 0,
                platformUsers: 0
            };
        }
    }

    // Create platform pro-admin user
    async createPlatformAdmin(email, password, name) {
        try {
            const PlatformUser = this.getPlatformModel('PlatformUser');
            
            // Check if already exists
            const existing = await PlatformUser.findOne({ email });
            if (existing) {
                console.log(`  ℹ️  Platform admin already exists: ${email}`);
                return existing;
            }

            const hashedPassword = await bcrypt.hash(password, 12);
            const admin = new PlatformUser({
                email,
                password: hashedPassword,
                name,
                role: 'pro-superadmin',
                permissions: ['all'],
                isActive: true
            });

            await admin.save();
            console.log(`  ✅ Platform admin created: ${email}`);
            return admin;
        } catch (error) {
            console.error('Error creating platform admin:', error);
            throw error;
        }
    }
}

// Singleton instance
const dbManager = new DatabaseManager();

module.exports = dbManager;
