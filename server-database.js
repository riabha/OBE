const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     🎓 QUEST OBE Portal - DATABASE MODE                 ║');
console.log('║     💾 MongoDB Connected                                ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ============================================
// MIDDLEWARE
// ============================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configure multer for file uploads (memory storage for MongoDB)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// ============================================
// PLATFORM USER MODEL (for Pro Super Admin)
// ============================================

const platformUserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['pro_superadmin', 'platform_admin', 'support'],
        default: 'platform_admin'
    },
    permissions: {
        type: [String],
        default: ['all']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Method to compare password
platformUserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const PlatformUser = mongoose.model('PlatformUser', platformUserSchema);

// ============================================
// MONGODB CONNECTION
// ============================================

async function connectDatabase() {
    try {
        console.log('📡 Connecting to MongoDB...');
        console.log(`🔗 URI: ${process.env.MONGODB_URI?.replace(/\/\/.*:.*@/, '//***:***@')}`);
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ MongoDB connected successfully!\n');
        
        // Create default Pro Super Admin if not exists
        await createDefaultProAdmin();
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.error('💡 Check your MONGODB_URI in config.env');
        process.exit(1);
    }
}

// ============================================
// CREATE DEFAULT PRO SUPER ADMIN
// ============================================

async function createDefaultProAdmin() {
    try {
        const existingAdmin = await PlatformUser.findOne({ email: 'pro@obe.org.pk' });
        
        if (!existingAdmin) {
            console.log('👤 Creating default Pro Super Admin...');
            
            const hashedPassword = await bcrypt.hash('proadmin123', 12);
            
            const proAdmin = new PlatformUser({
                email: 'pro@obe.org.pk',
                password: hashedPassword,
                name: 'OBE Portal Administrator',
                role: 'pro_superadmin',
                permissions: ['all'],
                isActive: true
            });
            
            await proAdmin.save();
            console.log('✅ Default Pro Super Admin created!');
            console.log('   📧 Email: pro@obe.org.pk');
            console.log('   🔑 Password: proadmin123\n');
        } else {
            console.log('✅ Pro Super Admin already exists\n');
        }
    } catch (error) {
        console.error('❌ Error creating default admin:', error.message);
    }
}

// ============================================
// ROUTES
// ============================================

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ============================================
// AUTHENTICATION API
// ============================================

// Login endpoint - DATABASE MODE (Multi-Database Support)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log(`🔐 Login attempt: ${email}`);
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        
        // First, check platform users (Pro Super Admin, etc.)
        const platformUser = await PlatformUser.findOne({ email: email.toLowerCase() });
        
        if (platformUser && platformUser.isActive) {
            const isPasswordValid = await platformUser.comparePassword(password);
            
            if (isPasswordValid) {
                // Update last login
                platformUser.lastLogin = new Date();
                await platformUser.save();
                
                console.log(`✅ Platform login successful: ${email} (${platformUser.role})`);
                
                // Create JWT token
                const token = jwt.sign(
                    { 
                        userId: platformUser._id, 
                        email: platformUser.email, 
                        role: platformUser.role,
                        permissions: platformUser.permissions,
                        userType: 'platform'
                    },
                    process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024_very_secure_random_string',
                    { expiresIn: process.env.JWT_EXPIRE || '7d' }
                );
                
                return res.json({
                    message: 'Login successful',
                    token,
                    user: {
                        id: platformUser._id,
                        email: platformUser.email,
                        name: platformUser.name,
                        role: platformUser.role,
                        permissions: platformUser.permissions,
                        userType: 'platform',
                        isActive: platformUser.isActive,
                        lastLogin: platformUser.lastLogin
                    }
                });
            }
        }
        
        // If not found in platform, check all university databases
        const universities = await University.find({ isActive: true });
        const UserSchema = require('./models/User');
        
        for (const uni of universities) {
            try {
                const uniDbConnection = mongoose.connection.useDb(uni.databaseName, { useCache: true });
                const UniversityUser = uniDbConnection.model('User', UserSchema);
                
                const user = await UniversityUser.findOne({ email: email.toLowerCase() });
                
                if (user && user.isActive) {
                    const isPasswordValid = await user.comparePassword(password);
                    
                    if (isPasswordValid) {
                        // Update last login
                        user.lastLogin = new Date();
                        await user.save();
                        
                        console.log(`✅ University login successful: ${email} (${user.role}) - ${uni.universityName}`);
                        
                        // Create JWT token
                        const token = jwt.sign(
                            { 
                                userId: user._id, 
                                email: user.email, 
                                role: user.role,
                                universityId: uni._id,
                                universityCode: uni.universityCode,
                                databaseName: uni.databaseName,
                                userType: 'university'
                            },
                            process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024_very_secure_random_string',
                            { expiresIn: process.env.JWT_EXPIRE || '7d' }
                        );
                        
                        return res.json({
                            message: 'Login successful',
                            token,
                            user: {
                                id: user._id,
                                email: user.email,
                                name: `${user.firstName} ${user.lastName}`,
                                role: user.role,
                                university: uni.universityName,
                                universityCode: uni.universityCode,
                                userType: 'university',
                                isActive: user.isActive,
                                lastLogin: user.lastLogin
                            }
                        });
                    }
                }
            } catch (uniDbError) {
                // Database might not exist yet, continue to next
                continue;
            }
        }
        
        // If we reach here, credentials are invalid
        console.log(`❌ Invalid credentials for: ${email}`);
        return res.status(401).json({ message: 'Invalid email or password' });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Check authentication status
app.get('/api/auth/check', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ authenticated: false });
    }
    
    try {
        const decoded = jwt.verify(
            token, 
            process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024_very_secure_random_string'
        );
        
        // Verify user still exists and is active
        const user = await PlatformUser.findById(decoded.userId);
        
        if (!user || !user.isActive) {
            return res.status(401).json({ authenticated: false });
        }
        
        res.json({ 
            authenticated: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                permissions: user.permissions
            }
        });
    } catch (error) {
        res.status(401).json({ authenticated: false });
    }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// ============================================
// PLATFORM USERS API
// ============================================

// Get all platform users
app.get('/api/platform-users', async (req, res) => {
    try {
        const users = await PlatformUser.find({}, '-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create platform user
app.post('/api/platform-users', async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        
        // Check if user already exists
        const existingUser = await PlatformUser.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Create new user
        const newUser = new PlatformUser({
            email: email.toLowerCase(),
            password: hashedPassword,
            name,
            role: role || 'platform_admin',
            permissions: ['all']
        });
        
        await newUser.save();
        
        // Return user without password
        const userResponse = { ...newUser.toObject() };
        delete userResponse.password;
        
        res.status(201).json({
            message: 'User created successfully',
            user: userResponse
        });
        
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ============================================
// UNIVERSITIES API
// ============================================

const UniversitySchema = require('./models/University');
const University = mongoose.model('University', UniversitySchema);

const Subscription = require('./models/Subscription');

// Get all universities
app.get('/api/universities', async (req, res) => {
    try {
        // Exclude logo data from list (for performance)
        const universities = await University.find({}, '-logo.data').sort({ createdAt: -1 });
        
        // Add logo URL for each university
        const universitiesWithLogoUrl = universities.map(uni => {
            const uniObj = uni.toObject();
            if (uni.logo && uni.logo.contentType) {
                uniObj.logoUrl = `/api/universities/${uni._id}/logo`;
            }
            return uniObj;
        });
        
        res.json(universitiesWithLogoUrl);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get single university by ID
app.get('/api/universities/:id', async (req, res) => {
    try {
        const university = await University.findById(req.params.id);
        
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }
        
        // Return university with logo URL
        const uniObj = university.toObject();
        if (university.logo && university.logo.contentType) {
            uniObj.logoUrl = `/api/universities/${university._id}/logo`;
        }
        // Remove binary logo data from response
        delete uniObj.logo;
        
        res.json(uniObj);
        
    } catch (error) {
        console.error('Error fetching university:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get university logo
app.get('/api/universities/:id/logo', async (req, res) => {
    try {
        const university = await University.findById(req.params.id);
        
        if (!university || !university.logo || !university.logo.data) {
            return res.status(404).json({ message: 'Logo not found' });
        }
        
        res.contentType(university.logo.contentType);
        res.send(university.logo.data);
        
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create new university
app.post('/api/universities/create', upload.single('logo'), async (req, res) => {
    try {
        const {
            universityName,
            universityCode,
            address,
            city,
            country,
            contactEmail,
            contactPhone,
            website,
            superAdminEmail,
            databaseOption, // 'auto' or 'manual'
            databaseName, // if manual
            subscriptionPlan
        } = req.body;

        // Check if university code already exists
        const existing = await University.findOne({ universityCode: universityCode.toUpperCase() });
        if (existing) {
            return res.status(400).json({ message: 'University code already exists' });
        }

        // Generate database name
        let dbName;
        if (databaseOption === 'manual' && databaseName) {
            dbName = databaseName;
        } else {
            dbName = `obe_university_${universityCode.toLowerCase()}`;
        }

        // Create university
        const university = new University({
            universityName,
            universityCode: universityCode.toUpperCase(),
            databaseName: dbName,
            logo: req.file ? {
                data: req.file.buffer,
                contentType: req.file.mimetype
            } : undefined,
            address,
            city,
            country: country || 'Pakistan',
            contactEmail,
            contactPhone,
            website,
            superAdminEmail,
            subscriptionPlan: subscriptionPlan || 'Basic',
            subscriptionStatus: 'Active',
            isActive: true
        });

        await university.save();

        // Create the university database in MongoDB
        let superAdminPassword = '';
        try {
            const uniDbConnection = mongoose.connection.useDb(dbName, { useCache: true });
            
            // Create initial collections with metadata
            await uniDbConnection.createCollection('_metadata');
            await uniDbConnection.collection('_metadata').insertOne({
                universityId: university._id,
                universityName: university.universityName,
                universityCode: university.universityCode,
                created: new Date(),
                version: '1.0.0'
            });
            
            console.log(`✅ Database created in MongoDB: ${dbName}`);
            
            // Create super admin user in university database
            const UserSchema = require('./models/User');
            const UniversityUser = uniDbConnection.model('User', UserSchema);
            
            // Generate random password
            superAdminPassword = 'Admin@' + universityCode.toUpperCase() + '2025';
            const hashedPassword = await bcrypt.hash(superAdminPassword, 12);
            
            // Create super admin
            const superAdmin = new UniversityUser({
                firstName: 'Super',
                lastName: 'Admin',
                email: superAdminEmail,
                password: hashedPassword,
                role: 'controller', // Highest role in university
                phone: contactPhone || '+92-000-0000000',
                isActive: true,
                isEmailVerified: true,
                permissions: ['read', 'write', 'delete', 'admin']
            });
            
            await superAdmin.save();
            console.log(`✅ University Super Admin created: ${superAdminEmail}`);
            
        } catch (dbError) {
            console.log(`⚠️  Database creation note: ${dbError.message}`);
        }

        // Create default subscription
        const subscription = new Subscription({
            university: university._id,
            universityCode: university.universityCode,
            planType: subscriptionPlan || 'Basic',
            planName: `${subscriptionPlan || 'Basic'} Plan`,
            status: 'Trial',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
            trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        await subscription.save();

        console.log(`✅ University created: ${universityName} (${universityCode})`);
        console.log(`📊 Database: ${dbName}`);

        // Prepare response with logo URL
        const uniResponse = university.toObject();
        if (university.logo && university.logo.contentType) {
            uniResponse.logoUrl = `/api/universities/${university._id}/logo`;
        }
        delete uniResponse.logo; // Remove binary data from response

        res.status(201).json({
            message: 'University created successfully',
            university: uniResponse,
            subscription,
            superAdminPassword: superAdminPassword || 'Not created'
        });

    } catch (error) {
        console.error('❌ Error creating university:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update university
app.put('/api/universities/:id', upload.single('logo'), async (req, res) => {
    try {
        const university = await University.findById(req.params.id);
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }

        // Update fields
        Object.assign(university, req.body);
        
        // Update logo if new one provided
        if (req.file) {
            university.logo = {
                data: req.file.buffer,
                contentType: req.file.mimetype
            };
        }

        await university.save();

        res.json({
            message: 'University updated successfully',
            university
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete university
app.delete('/api/universities/:id', async (req, res) => {
    try {
        const university = await University.findById(req.params.id);
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }

        // Delete associated subscription
        await Subscription.deleteOne({ university: university._id });

        // Delete university
        await university.deleteOne();

        res.json({ message: 'University deleted successfully' });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ============================================
// SUBSCRIPTIONS API
// ============================================

// Get all subscriptions
app.get('/api/subscriptions', async (req, res) => {
    try {
        const subscriptions = await Subscription.find({})
            .populate('university')
            .sort({ createdAt: -1 });
        res.json(subscriptions);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get subscription by university
app.get('/api/subscriptions/university/:universityId', async (req, res) => {
    try {
        const subscription = await Subscription.findOne({ 
            university: req.params.universityId 
        }).populate('university');
        
        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }
        
        res.json(subscription);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update subscription
app.put('/api/subscriptions/:id', async (req, res) => {
    try {
        const subscription = await Subscription.findById(req.params.id);
        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        Object.assign(subscription, req.body);
        await subscription.save();

        res.json({
            message: 'Subscription updated successfully',
            subscription
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get subscription plans
app.get('/api/subscriptions/plans', (req, res) => {
    res.json(Subscription.getPlans());
});

// ============================================
// DATABASES API
// ============================================

// List all MongoDB databases
app.get('/api/databases', async (req, res) => {
    try {
        const admin = mongoose.connection.db.admin();
        const { databases } = await admin.listDatabases();
        
        // Filter to show only OBE-related databases
        const obeDatabases = databases
            .filter(db => db.name.startsWith('obe_'))
            .map(db => ({
                name: db.name,
                sizeOnDisk: db.sizeOnDisk,
                sizeMB: (db.sizeOnDisk / 1024 / 1024).toFixed(2),
                empty: db.empty,
                type: db.name === 'obe_platform' ? 'Platform' : 'University'
            }));
        
        res.json(obeDatabases);
    } catch (error) {
        console.error('Error listing databases:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create a new MongoDB database manually
app.post('/api/databases/create', async (req, res) => {
    try {
        const { databaseName, description } = req.body;
        
        if (!databaseName) {
            return res.status(400).json({ message: 'Database name is required' });
        }
        
        // Validate database name
        if (!databaseName.startsWith('obe_')) {
            return res.status(400).json({ message: 'Database name must start with "obe_"' });
        }
        
        if (!/^[a-z0-9_]+$/.test(databaseName)) {
            return res.status(400).json({ message: 'Database name can only contain lowercase letters, numbers, and underscores' });
        }
        
        // Create connection to the new database
        const newDbConnection = mongoose.connection.useDb(databaseName, { useCache: true });
        
        // Create an initial collection to ensure database is created
        // MongoDB doesn't create empty databases, so we create a metadata collection
        await newDbConnection.createCollection('_metadata');
        await newDbConnection.collection('_metadata').insertOne({
            created: new Date(),
            description: description || `Database for ${databaseName}`,
            version: '1.0.0'
        });
        
        console.log(`✅ Database created: ${databaseName}`);
        
        res.json({
            message: 'Database created successfully',
            database: {
                name: databaseName,
                description,
                created: new Date()
            }
        });
        
    } catch (error) {
        console.error('Error creating database:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get platform statistics
app.get('/api/platform-stats', async (req, res) => {
    try {
        const totalPlatformUsers = await PlatformUser.countDocuments();
        const totalUniversities = await University.countDocuments();
        const activeUniversities = await University.countDocuments({ isActive: true });
        const totalSubscriptions = await Subscription.countDocuments();
        const activeSubscriptions = await Subscription.countDocuments({ status: 'Active' });
        const trialSubscriptions = await Subscription.countDocuments({ status: 'Trial' });
        
        res.json({
            totalUniversities,
            activeUniversities,
            totalUsers: 0, // TODO: Count users from all university databases
            totalCourses: 0,
            totalDepartments: 0,
            totalStudents: 0,
            totalTeachers: 0,
            platformUsers: totalPlatformUsers,
            totalSubscriptions,
            activeSubscriptions,
            trialSubscriptions
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({ 
        status: 'OK', 
        message: 'QUEST OBE Portal - DATABASE MODE',
        database: dbStatus,
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API is working - DATABASE MODE', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        path: req.path,
        message: 'The requested resource was not found'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: err.message 
    });
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
    try {
        // Connect to database first
        await connectDatabase();
        
        // Then start HTTP server
        app.listen(PORT, '0.0.0.0', () => {
            const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
            
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log(`║  🌐 Server Running: ${baseUrl.padEnd(38)} ║`);
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            
            console.log('🔗 Access Points:');
            console.log(`   📱 Homepage: ${baseUrl}`);
            console.log(`   🔐 Login: ${baseUrl}/login.html`);
            console.log(`   🏥 Health: ${baseUrl}/api/health\n`);
            
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║  🔐 DEFAULT PRO SUPER ADMIN CREDENTIALS                ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            console.log('║  📧 Email:    pro@obe.org.pk                            ║');
            console.log('║  🔑 Password: proadmin123                               ║');
            console.log('║  👑 Role:     Pro Super Admin                           ║');
            console.log('║  💾 Storage:  MongoDB Database                          ║');
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            
            console.log('✨ Website is ready with database! Open the login URL above.\n');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Server shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Server shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

// Start the server
startServer();

