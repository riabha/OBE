const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const { promisify } = require('util');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3001;

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     🎓 QUEST OBE Portal - Production Version            ║');
console.log('║     💾 MongoDB Connected - All Features Working         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ============================================
// MIDDLEWARE
// ============================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configure multer for memory storage (logos in MongoDB)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images allowed'), false);
        }
    }
});

// ============================================
// DATABASE MODELS
// ============================================

// Platform User Schema
const platformUserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { 
        type: String, 
        enum: ['pro_superadmin', 'university_superadmin', 'platform_admin', 'support'],
        default: 'platform_admin'
    },
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University' },
    universityCode: { type: String, uppercase: true },
    permissions: { type: [String], default: ['all'] },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date }
}, { timestamps: true });

platformUserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const PlatformUser = mongoose.model('PlatformUser', platformUserSchema);

// University Schema
const universitySchema = new mongoose.Schema({
    universityName: { type: String, required: true, unique: true, trim: true },
    universityCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    databaseName: { type: String, required: true, unique: true, trim: true },
    logo: {
        data: Buffer,
        contentType: String
    },
    primaryColor: { type: String, default: '#2563eb' },
    secondaryColor: { type: String, default: '#7c3aed' },
    address: String,
    city: String,
    country: { type: String, default: 'Pakistan' },
    contactEmail: { type: String, lowercase: true, trim: true },
    contactPhone: String,
    website: String,
    superAdminEmail: { type: String, required: true, lowercase: true, trim: true },
    subscriptionPlan: { 
        type: String, 
        enum: ['Free', 'Basic', 'Standard', 'Premium', 'Enterprise'],
        default: 'Basic'
    },
    subscriptionStatus: {
        type: String,
        enum: ['Active', 'Inactive', 'Suspended', 'Trial'],
        default: 'Trial'
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const University = mongoose.model('University', universitySchema);

// Subscription Schema
const subscriptionSchema = new mongoose.Schema({
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University', required: true },
    universityCode: { type: String, required: true, uppercase: true },
    planType: { type: String, enum: ['Free', 'Basic', 'Standard', 'Premium', 'Enterprise'], default: 'Free' },
    planName: String,
    status: { type: String, enum: ['Active', 'Inactive', 'Trial', 'Expired'], default: 'Trial' },
    startDate: { type: Date, default: Date.now },
    endDate: Date,
    trialEndDate: Date
}, { timestamps: true });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

// Platform Settings Schema (single document in obe_platform)
const platformSettingsSchema = new mongoose.Schema({
    platformName: { type: String, default: 'OBE Portal' },
    platformEmail: { type: String, default: 'admin@obe.org.pk' },
    supportEmail: { type: String, default: 'support@obe.org.pk' },
    platformUrl: { type: String, default: 'https://obe.org.pk' },
    smtpHost: String,
    smtpPort: String,
    smtpUsername: String,
    smtpPassword: String,
    smtpFromName: { type: String, default: 'OBE Portal' },
    smtpFromEmail: { type: String, default: 'noreply@obe.org.pk' }
}, { timestamps: true });

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

const JWT_SECRET = process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024';
const PRO_ADMIN_ROLES = ['pro_superadmin', 'platform_admin'];

async function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await PlatformUser.findById(decoded.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'Invalid or inactive account' });
        }
        req.user = user;
        req.tokenPayload = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}

function requireProAdmin(req, res, next) {
    if (!req.user || !PRO_ADMIN_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Pro admin access required' });
    }
    next();
}

const proAdminAuth = [requireAuth, requireProAdmin];

function maskMongoPassword(settings) {
    return {
        ...settings,
        password: settings.password ? '********' : '',
        passwordSet: !!settings.password
    };
}

async function getDefaultPlatformSettings() {
    let settings = await PlatformSettings.findOne();
    if (!settings) {
        settings = await PlatformSettings.create({});
    }
    return settings;
}

const UserSchema = require('./models/User');
const DepartmentSchema = require('./models/Department');
const CourseSchema = require('./models/Course');

async function findUniversityUserByCredentials(email, password) {
    const universities = await University.find({ isActive: true });
    for (const university of universities) {
        const uniDb = mongoose.connection.useDb(university.databaseName);
        const User = uniDb.model('User', UserSchema);
        const uniUser = await User.findOne({ email: email.toLowerCase() });
        if (!uniUser || !uniUser.isActive) continue;
        const isValid = await uniUser.comparePassword(password);
        if (isValid) {
            return { uniUser, university };
        }
    }
    return null;
}

async function getUniversityDatabase(token) {
    const decoded = jwt.verify(token, JWT_SECRET);
    let university;

    if (decoded.userType === 'university') {
        university = decoded.universityId
            ? await University.findById(decoded.universityId)
            : await University.findOne({ universityCode: decoded.universityCode });
    } else {
        const user = await PlatformUser.findById(decoded.userId);
        if (!user || user.role !== 'university_superadmin') {
            throw new Error('Not authorized');
        }
        university = await University.findById(user.university)
            || await University.findOne({ universityCode: user.universityCode });
    }

    if (!university) {
        throw new Error('University not found');
    }

    const uniDb = mongoose.connection.useDb(university.databaseName);
    return { uniDb, university, decoded };
}

function buildAuthResponse(userPayload, tokenPayload) {
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    return {
        message: 'Login successful',
        token,
        user: userPayload
    };
}

// ============================================
// MONGODB CONNECTION
// ============================================

async function connectDatabase() {
    try {
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connected!\n');
        
        // Create default Pro Super Admin
        await createDefaultAdmin();
        await getDefaultPlatformSettings();
        
    } catch (error) {
        console.error('❌ MongoDB error:', error.message);
        process.exit(1);
    }
}

async function createDefaultAdmin() {
    try {
        const existing = await PlatformUser.findOne({ email: 'pro@obe.org.pk' });
        
        if (!existing) {
            const hashedPassword = await bcrypt.hash('proadmin123', 12);
            await PlatformUser.create({
                email: 'pro@obe.org.pk',
                password: hashedPassword,
                name: 'OBE Portal Administrator',
                role: 'pro_superadmin',
                permissions: ['all'],
                isActive: true
            });
            console.log('✅ Default Pro Super Admin created');
            console.log('   📧 Email: pro@obe.org.pk');
            console.log('   🔑 Password: proadmin123\n');
        }
    } catch (error) {
        console.error('⚠️  Admin creation:', error.message);
    }
}

// ============================================
// ROUTES
// ============================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// ============================================
// AUTHENTICATION
// ============================================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log(`\n🔐 Login attempt: ${email}`);
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }
        
        const normalizedEmail = email.toLowerCase();
        const platformUser = await PlatformUser.findOne({ email: normalizedEmail });

        if (platformUser) {
            if (!platformUser.isActive) {
                return res.status(401).json({ message: 'Account inactive' });
            }
            const isValid = await platformUser.comparePassword(password);
            if (!isValid) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            platformUser.lastLogin = new Date();
            await platformUser.save();
            console.log(`✅ Login successful: ${email} (${platformUser.role})`);
            return res.json(buildAuthResponse(
                {
                    id: platformUser._id,
                    email: platformUser.email,
                    name: platformUser.name,
                    role: platformUser.role,
                    universityCode: platformUser.universityCode,
                    permissions: platformUser.permissions,
                    isActive: platformUser.isActive
                },
                {
                    userId: platformUser._id,
                    email: platformUser.email,
                    role: platformUser.role,
                    universityId: platformUser.university,
                    universityCode: platformUser.universityCode,
                    userType: 'platform'
                }
            ));
        }

        const uniLogin = await findUniversityUserByCredentials(normalizedEmail, password);
        if (!uniLogin) {
            console.log(`❌ User not found or wrong password: ${email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const { uniUser, university } = uniLogin;
        uniUser.lastLogin = new Date();
        await uniUser.save();

        const displayName = `${uniUser.firstName} ${uniUser.lastName}`;
        console.log(`✅ Login successful: ${email} (${uniUser.role}) @ ${university.universityCode}`);

        return res.json(buildAuthResponse(
            {
                id: uniUser._id,
                email: uniUser.email,
                name: displayName,
                role: uniUser.role,
                universityCode: university.universityCode,
                isActive: uniUser.isActive
            },
            {
                userId: uniUser._id,
                email: uniUser.email,
                name: displayName,
                role: uniUser.role,
                universityId: university._id,
                universityCode: university.universityCode,
                userType: 'university'
            }
        ));
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/auth/check', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ authenticated: false });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.userType === 'university') {
            return res.json({
                authenticated: true,
                user: {
                    id: decoded.userId,
                    email: decoded.email,
                    name: decoded.name,
                    role: decoded.role,
                    universityCode: decoded.universityCode
                }
            });
        }
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
                role: user.role
            }
        });
    } catch (error) {
        res.status(401).json({ authenticated: false });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logged out' });
});

// ============================================
// UNIVERSITIES API
// ============================================

// Get all universities
app.get('/api/universities', proAdminAuth, async (req, res) => {
    try {
        const universities = await University.find({}, '-logo.data').sort({ createdAt: -1 });
        const result = universities.map(uni => {
            const obj = uni.toObject();
            if (uni.logo && uni.logo.contentType) {
                obj.logoUrl = `/api/universities/${uni._id}/logo`;
            }
            return obj;
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Get single university
app.get('/api/universities/:id', proAdminAuth, async (req, res) => {
    try {
        const university = await University.findById(req.params.id);
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }
        
        const obj = university.toObject();
        if (university.logo && university.logo.contentType) {
            obj.logoUrl = `/api/universities/${university._id}/logo`;
        }
        delete obj.logo;
        
        res.json(obj);
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Get university logo
app.get('/api/universities/:id/logo', async (req, res) => {
    try {
        const university = await University.findById(req.params.id);
        if (!university || !university.logo || !university.logo.data) {
            return res.status(404).send('Logo not found');
        }
        res.contentType(university.logo.contentType);
        res.send(university.logo.data);
    } catch (error) {
        res.status(500).send('Error');
    }
});

// Create university
app.post('/api/universities/create', proAdminAuth, upload.single('logo'), async (req, res) => {
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
            databaseOption,
            databaseName,
            subscriptionPlan
        } = req.body;

        console.log(`\n📝 Creating university: ${universityName} (${universityCode})`);

        // Check if code exists
        const existing = await University.findOne({ universityCode: universityCode.toUpperCase() });
        if (existing) {
            return res.status(400).json({ message: 'University code already exists' });
        }

        // Determine database name
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
            superAdminEmail: superAdminEmail.toLowerCase(),
            subscriptionPlan: subscriptionPlan || 'Basic',
            subscriptionStatus: 'Trial',
            isActive: true
        });

        await university.save();
        console.log(`✅ University created in obe_platform`);

        // Create university database with all collections
        try {
            const uniDb = mongoose.connection.useDb(dbName);
            
            // List of collections to create
            const collections = [
                '_metadata',
                'departments',
                'users',
                'courses',
                'sections',
                'enrollments',
                'assessments',
                'results',
                'clos',
                'plos',
                'attainments',
                'reports',
                'settings'
            ];

            // Create all collections
            for (const collectionName of collections) {
                try {
                    await uniDb.createCollection(collectionName);
                    console.log(`   ✓ Created collection: ${collectionName}`);
                } catch (err) {
                    // Collection might already exist, ignore error
                    if (!err.message.includes('already exists')) {
                        console.log(`   ⚠️  ${collectionName}: ${err.message}`);
                    }
                }
            }

            // Insert metadata
            await uniDb.collection('_metadata').insertOne({
                universityId: university._id,
                universityName: university.universityName,
                universityCode: university.universityCode,
                created: new Date(),
                collections: collections,
                version: '1.0'
            });

            console.log(`✅ Database created: ${dbName} with ${collections.length} collections`);
        } catch (dbErr) {
            console.log(`⚠️  Database creation: ${dbErr.message}`);
        }

        // Create university super admin in PLATFORM database
        let superAdminPassword = '';
        try {
            superAdminPassword = 'Admin@' + universityCode.toUpperCase() + '2025';
            const hashedPassword = await bcrypt.hash(superAdminPassword, 12);

            const superAdmin = new PlatformUser({
                email: superAdminEmail.toLowerCase(),
                password: hashedPassword,
                name: `${universityName} - Administrator`,
                role: 'university_superadmin',
                university: university._id,
                universityCode: university.universityCode,
                permissions: ['all'],
                isActive: true
            });

            await superAdmin.save();
            console.log(`✅ Super Admin created: ${superAdminEmail}`);
            console.log(`   🔑 Password: ${superAdminPassword}\n`);
        } catch (adminErr) {
            console.error(`❌ Super admin creation failed: ${adminErr.message}`);
            superAdminPassword = `ERROR: ${adminErr.message}`;
        }

        // Create subscription
        const subscription = new Subscription({
            university: university._id,
            universityCode: university.universityCode,
            planType: subscriptionPlan || 'Basic',
            planName: `${subscriptionPlan || 'Basic'} Plan`,
            status: 'Trial',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        await subscription.save();

        const uniObj = university.toObject();
        if (university.logo && university.logo.contentType) {
            uniObj.logoUrl = `/api/universities/${university._id}/logo`;
        }
        delete uniObj.logo;

        res.status(201).json({
            message: 'University created successfully',
            university: uniObj,
            subscription,
            superAdminPassword
        });

    } catch (error) {
        console.error('❌ Create university error:', error);
        res.status(500).json({ message: 'Error creating university', error: error.message });
    }
});

// Update university
app.put('/api/universities/:id', proAdminAuth, upload.single('logo'), async (req, res) => {
    try {
        const university = await University.findById(req.params.id);
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }

        Object.assign(university, req.body);
        
        if (req.file) {
            university.logo = {
                data: req.file.buffer,
                contentType: req.file.mimetype
            };
        }

        await university.save();

        const obj = university.toObject();
        delete obj.logo;
        res.json({ message: 'University updated', university: obj });

    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Delete university
app.delete('/api/universities/:id', proAdminAuth, async (req, res) => {
    try {
        const university = await University.findById(req.params.id);
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }

        // Delete super admin
        await PlatformUser.deleteOne({ university: university._id, role: 'university_superadmin' });
        
        // Delete subscription
        await Subscription.deleteOne({ university: university._id });
        
        // Delete university
        await university.deleteOne();

        res.json({ message: 'University deleted' });

    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// ============================================
// PLATFORM USERS API
// ============================================

app.get('/api/platform-users', proAdminAuth, async (req, res) => {
    try {
        const users = await PlatformUser.find({}, '-password').populate('university');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.post('/api/platform-users', proAdminAuth, async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        
        const existing = await PlatformUser.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 12);
        
        const user = await PlatformUser.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            name,
            role: role || 'platform_admin',
            permissions: ['all']
        });
        
        const userObj = user.toObject();
        delete userObj.password;
        
        res.status(201).json({ message: 'User created', user: userObj });
        
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Delete platform user
app.delete('/api/platform-users/:id', proAdminAuth, async (req, res) => {
    try {
        const user = await PlatformUser.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'pro_superadmin') {
            return res.status(403).json({ message: 'Cannot delete Pro Super Admin' });
        }

        await user.deleteOne();
        res.json({ message: 'User deleted' });

    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// ============================================
// SUBSCRIPTIONS API
// ============================================

app.get('/api/subscriptions', proAdminAuth, async (req, res) => {
    try {
        const subscriptions = await Subscription.find({}).populate('university').sort({ createdAt: -1 });
        res.json(subscriptions);
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// ============================================
// DATABASES API
// ============================================

app.get('/api/databases', proAdminAuth, async (req, res) => {
    try {
        console.log('📋 Fetching all databases from MongoDB...');
        
        const admin = mongoose.connection.db.admin();
        const { databases } = await admin.listDatabases();
        
        console.log(`Found ${databases.length} total databases`);
        
        // Return ALL databases, not just obe_ ones
        const allDatabases = databases.map(db => ({
            name: db.name,
            sizeOnDisk: db.sizeOnDisk,
            sizeMB: (db.sizeOnDisk / 1024 / 1024).toFixed(2),
            empty: db.empty,
            type: db.name === 'obe_platform' ? 'Platform' : 
                  db.name.startsWith('obe_') ? 'University' : 'Other',
            canAssign: db.name !== 'admin' && db.name !== 'config' && db.name !== 'local'
        }));
        
        console.log('📊 Database breakdown:');
        allDatabases.forEach(db => {
            console.log(`  - ${db.name} (${db.sizeMB} MB) [${db.type}]`);
        });
        
        res.json(allDatabases);
    } catch (error) {
        console.error('❌ Error fetching databases:', error);
        res.status(500).json({ 
            message: 'Error fetching databases', 
            error: error.message,
            suggestion: 'Check MongoDB connection and permissions'
        });
    }
});

// Get database connection info
app.get('/api/database-connection-info', proAdminAuth, async (req, res) => {
    try {
        const connectionState = mongoose.connection.readyState;
        const connectionStates = {
            0: 'Disconnected',
            1: 'Connected', 
            2: 'Connecting',
            3: 'Disconnecting'
        };
        
        const admin = mongoose.connection.db.admin();
        const serverStatus = await admin.serverStatus();
        
        res.json({
            status: connectionStates[connectionState],
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name,
            version: serverStatus.version,
            uptime: serverStatus.uptime,
            connections: serverStatus.connections,
            externalHost: process.env.APP_PUBLIC_HOST || 'obe.org.pk',
            externalPort: '27018',
            internalHost: 'mongodb',
            internalPort: '27017',
            note: 'Credentials are configured via server environment (.env on VPS).'
        });
    } catch (error) {
        console.error('Error getting connection info:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// List databases available for university assignment
app.get('/api/databases/available', proAdminAuth, async (req, res) => {
    try {
        const admin = mongoose.connection.db.admin();
        const { databases } = await admin.listDatabases();
        const universities = await University.find({}, 'databaseName');
        const assigned = new Set(universities.map(u => u.databaseName));

        const available = databases
            .filter(db => db.name.startsWith('obe_') && db.name !== 'obe_platform' && !assigned.has(db.name))
            .map(db => ({
                name: db.name,
                sizeMB: (db.sizeOnDisk / 1024 / 1024).toFixed(2),
                empty: db.empty
            }));

        res.json(available);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching available databases', error: error.message });
    }
});

// Test external database connection (add-database form)
app.post('/api/databases/test', proAdminAuth, async (req, res) => {
    try {
        const { host, port, username, password, databaseName, database, authSource } = req.body;
        const dbName = databaseName || database || 'obe_platform';
        const dbHost = host || 'mongodb';
        const dbPort = port || 27017;
        let dbUser = username;
        let dbPass = password;

        if (!dbPass || dbPass === '********') {
            const uri = process.env.MONGODB_URI || '';
            const uriMatch = uri.match(/mongodb:\/\/([^:]+):([^@]+)@/);
            if (uriMatch) {
                dbUser = dbUser || decodeURIComponent(uriMatch[1]);
                dbPass = decodeURIComponent(uriMatch[2]);
            }
        }

        let testUri;
        if (dbUser && dbPass) {
            testUri = `mongodb://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/${dbName}?authSource=${authSource || 'admin'}`;
        } else {
            testUri = `mongodb://${dbHost}:${dbPort}/${dbName}`;
        }

        const testConnection = await mongoose.createConnection(testUri, {
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: 1
        });
        await testConnection.db.admin().ping();
        await testConnection.close();

        res.json({ success: true, message: 'Connection successful!' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.post('/api/databases/create', proAdminAuth, async (req, res) => {
    try {
        const { databaseName, description } = req.body;
        
        if (!databaseName || !databaseName.startsWith('obe_')) {
            return res.status(400).json({ message: 'Invalid database name' });
        }
        
        const db = mongoose.connection.useDb(databaseName);
        
        // Create all necessary collections
        const collections = [
            '_metadata',
            'departments',
            'users',
            'courses',
            'sections',
            'enrollments',
            'assessments',
            'results',
            'clos',
            'plos',
            'attainments',
            'reports',
            'settings'
        ];

        for (const collectionName of collections) {
            try {
                await db.createCollection(collectionName);
            } catch (err) {
                // Ignore if collection already exists
            }
        }

        await db.collection('_metadata').insertOne({
            created: new Date(),
            description: description || `Database: ${databaseName}`,
            collections: collections
        });
        
        console.log(`✅ Database created: ${databaseName} with ${collections.length} collections`);
        
        res.json({ message: 'Database created successfully', database: { name: databaseName } });
        
    } catch (error) {
        console.error('Error creating database:', error);
        res.status(500).json({ message: 'Error creating database', error: error.message });
    }
});

// Get database collections
app.get('/api/databases/:dbName/collections', proAdminAuth, async (req, res) => {
    try {
        const { dbName } = req.params;
        
        if (!dbName.startsWith('obe_')) {
            return res.status(400).json({ message: 'Invalid database name' });
        }

        const db = mongoose.connection.useDb(dbName);
        const collections = await db.db.listCollections().toArray();
        
        res.json({
            database: dbName,
            collections: collections.map(c => c.name)
        });
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ message: 'Error fetching collections', error: error.message });
    }
});

// Get database details
app.get('/api/databases/:dbName/details', proAdminAuth, async (req, res) => {
    try {
        const { dbName } = req.params;
        
        if (!dbName.startsWith('obe_')) {
            return res.status(400).json({ message: 'Invalid database name' });
        }

        const db = mongoose.connection.useDb(dbName);
        const collections = await db.db.listCollections().toArray();
        
        // Try to get metadata
        let metadata = null;
        try {
            metadata = await db.collection('_metadata').findOne({});
        } catch (err) {
            // Metadata might not exist
        }

        // Get database stats
        const stats = await db.db.stats();

        res.json({
            database: dbName,
            collections: collections.map(c => c.name),
            sizeMB: (stats.dataSize / 1024 / 1024).toFixed(2),
            created: metadata?.created || null,
            metadata: metadata
        });
    } catch (error) {
        console.error('Error fetching database details:', error);
        res.status(500).json({ message: 'Error fetching details', error: error.message });
    }
});

// Delete database
app.delete('/api/databases/:dbName', proAdminAuth, async (req, res) => {
    try {
        const { dbName } = req.params;
        
        // Prevent deleting platform database
        if (dbName === 'obe_platform') {
            return res.status(403).json({ message: 'Cannot delete platform database' });
        }

        if (!dbName.startsWith('obe_')) {
            return res.status(400).json({ message: 'Invalid database name' });
        }

        const db = mongoose.connection.useDb(dbName);
        await db.dropDatabase();
        
        console.log(`✅ Database deleted: ${dbName}`);
        
        res.json({ 
            message: 'Database deleted successfully',
            database: dbName
        });
    } catch (error) {
        console.error('Error deleting database:', error);
        res.status(500).json({ message: 'Error deleting database', error: error.message });
    }
});

// ============================================
// MONGODB SETTINGS API
// ============================================

// Get current MongoDB settings
app.get('/api/mongodb-settings', proAdminAuth, async (req, res) => {
    try {
        const currentUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/obe_platform';
        
        let parsedSettings = {
            host: 'mongodb',
            port: '27017',
            username: '',
            password: '',
            database: 'obe_platform',
            authSource: 'admin',
            connectionStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
        };

        try {
            const uriMatch = currentUri.match(/mongodb:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?/);
            if (uriMatch) {
                parsedSettings.username = decodeURIComponent(uriMatch[1]);
                parsedSettings.password = decodeURIComponent(uriMatch[2]);
                parsedSettings.host = uriMatch[3];
                parsedSettings.port = uriMatch[4];
                parsedSettings.database = uriMatch[5];
                
                if (uriMatch[6]) {
                    const authSourceMatch = uriMatch[6].match(/authSource=([^&]+)/);
                    if (authSourceMatch) {
                        parsedSettings.authSource = authSourceMatch[1];
                    }
                }
            } else {
                const simpleMatch = currentUri.match(/mongodb:\/\/([^:]+):(\d+)\/(.+)/);
                if (simpleMatch) {
                    parsedSettings.host = simpleMatch[1];
                    parsedSettings.port = simpleMatch[2];
                    parsedSettings.database = simpleMatch[3];
                }
            }
        } catch (parseError) {
            console.error('Error parsing MongoDB URI:', parseError);
        }

        // Test actual connection status
        try {
            await mongoose.connection.db.admin().ping();
            parsedSettings.connectionStatus = 'Connected';
        } catch (pingError) {
            parsedSettings.connectionStatus = 'Disconnected';
        }

        res.json({
            success: true,
            settings: maskMongoPassword(parsedSettings)
        });

    } catch (error) {
        console.error('Error getting MongoDB settings:', error);
        res.status(500).json({ message: 'Error retrieving settings', error: error.message });
    }
});

// Test MongoDB connection
app.post('/api/mongodb-settings/test', proAdminAuth, async (req, res) => {
    try {
        let { host, port, username, password, database, authSource } = req.body;

        if (!password || password === '********') {
            const uri = process.env.MONGODB_URI || '';
            const uriMatch = uri.match(/mongodb:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
            if (uriMatch) {
                username = username || decodeURIComponent(uriMatch[1]);
                password = decodeURIComponent(uriMatch[2]);
                host = host || uriMatch[3];
                port = port || uriMatch[4];
                database = database || uriMatch[5];
            }
        }

        let testUri;
        if (username && password) {
            const encodedUser = encodeURIComponent(username);
            const encodedPass = encodeURIComponent(password);
            testUri = `mongodb://${encodedUser}:${encodedPass}@${host}:${port}/${database}?authSource=${authSource || 'admin'}`;
        } else {
            testUri = `mongodb://${host}:${port}/${database}`;
        }

        console.log(`Testing MongoDB connection to: ${host}:${port}/${database}`);
        console.log(`Test URI: ${testUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials in log

        try {
            const testConnection = await mongoose.createConnection(testUri, {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                maxPoolSize: 1,
                retryWrites: false
            });

            // Test the connection with a ping
            await testConnection.db.admin().ping();
            
            // List databases to verify access
            const adminDb = testConnection.db.admin();
            const dbList = await adminDb.listDatabases();
            
            await testConnection.close();
            
            console.log('✅ MongoDB connection test successful');
            console.log(`✅ Found ${dbList.databases.length} databases`);
            
            res.json({ 
                success: true, 
                message: `Connection successful! MongoDB is accessible with ${dbList.databases.length} databases.`,
                status: 'Connected',
                databases: dbList.databases.map(db => db.name)
            });
            
        } catch (connectionError) {
            console.error('MongoDB connection test failed:', connectionError);
            
            // Provide specific error messages
            let errorMessage = 'Connection failed: ';
            if (connectionError.message.includes('ENOTFOUND')) {
                errorMessage += `Host "${host}" not found. In Docker, use container name "mongodb" instead of "localhost".`;
            } else if (connectionError.message.includes('ECONNREFUSED')) {
                errorMessage += `Connection refused to ${host}:${port}. Check if MongoDB is running.`;
            } else if (connectionError.message.includes('Authentication failed')) {
                errorMessage += 'Authentication failed. Check username and password.';
            } else if (connectionError.message.includes('not authorized')) {
                errorMessage += `Not authorized to access database "${database}". Check permissions.`;
            } else {
                errorMessage += connectionError.message;
            }
            
            res.status(400).json({ 
                success: false, 
                message: errorMessage,
                error: connectionError.message,
                suggestion: host === 'localhost' ? 'Try using "mongodb" as host (Docker container name)' : null
            });
        }

    } catch (error) {
        console.error('MongoDB connection test error:', error);
        res.status(500).json({ 
            success: false, 
            message: `Test failed: ${error.message}`,
            error: error.message
        });
    }
});

// Update MongoDB settings (Docker: update .env on VPS and restart containers)
app.put('/api/mongodb-settings', proAdminAuth, async (req, res) => {
    try {
        let { host, port, username, password, database, authSource } = req.body;

        if (!password || password === '********') {
            const uri = process.env.MONGODB_URI || '';
            const uriMatch = uri.match(/mongodb:\/\/([^:]+):([^@]+)@/);
            if (uriMatch) {
                password = decodeURIComponent(uriMatch[2]);
                username = username || decodeURIComponent(uriMatch[1]);
            }
        }

        let newUri;
        if (username && password) {
            const encodedUser = encodeURIComponent(username);
            const encodedPass = encodeURIComponent(password);
            newUri = `mongodb://${encodedUser}:${encodedPass}@${host}:${port}/${database}?authSource=${authSource || 'admin'}`;
        } else {
            newUri = `mongodb://${host}:${port}/${database}`;
        }

        const configPath = './config.env';
        let configContent = await readFile(configPath, 'utf8');

        const mongoUriRegex = /MONGODB_URI=.*/;
        if (mongoUriRegex.test(configContent)) {
            configContent = configContent.replace(mongoUriRegex, `MONGODB_URI=${newUri}`);
        } else {
            configContent += `\nMONGODB_URI=${newUri}\n`;
        }

        await writeFile(configPath, configContent, 'utf8');

        console.log('✅ MongoDB settings updated in config.env');

        res.json({ 
            success: true, 
            message: 'Settings saved. On Docker VPS: update MONGODB_URI in .env and run docker-compose restart obe-app.',
            requiresRestart: true
        });

    } catch (error) {
        console.error('Error updating MongoDB settings:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating settings', 
            error: error.message 
        });
    }
});

// ============================================
// PLATFORM SETTINGS API
// ============================================

app.get('/api/platform-settings', proAdminAuth, async (req, res) => {
    try {
        const settings = await getDefaultPlatformSettings();
        const obj = settings.toObject();
        if (obj.smtpPassword) {
            obj.smtpPassword = '********';
        }
        res.json(obj);
    } catch (error) {
        res.status(500).json({ message: 'Error loading settings', error: error.message });
    }
});

app.post('/api/platform-settings', proAdminAuth, async (req, res) => {
    try {
        const update = { ...req.body };
        if (update.smtpPassword === '********') {
            delete update.smtpPassword;
        }
        const settings = await PlatformSettings.findOneAndUpdate({}, update, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });
        res.json({ message: 'Platform settings saved', settings });
    } catch (error) {
        res.status(500).json({ message: 'Error saving settings', error: error.message });
    }
});

// ============================================
// UNIVERSITY SUPER ADMINS API
// ============================================

app.get('/api/university-super-admins', proAdminAuth, async (req, res) => {
    try {
        const users = await PlatformUser.find({ role: 'university_superadmin' }, '-password')
            .populate('university')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.post('/api/university-super-admins', proAdminAuth, async (req, res) => {
    try {
        const { universityId, email, name, password } = req.body;

        if (!universityId || !email || !password) {
            return res.status(400).json({ message: 'University, email, and password are required' });
        }

        const university = await University.findById(universityId);
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }

        const existing = await PlatformUser.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await PlatformUser.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            name: name || `${university.universityName} Admin`,
            role: 'university_superadmin',
            university: university._id,
            universityCode: university.universityCode,
            permissions: ['all'],
            isActive: true
        });

        const userObj = user.toObject();
        delete userObj.password;
        res.status(201).json({ message: 'University super admin created', user: userObj });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Reset platform user password
app.post('/api/platform-users/:id/reset-password', proAdminAuth, async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }

        const user = await PlatformUser.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// ============================================
// STATISTICS
// ============================================

app.get('/api/platform-stats', proAdminAuth, async (req, res) => {
    try {
        const stats = {
            totalUniversities: await University.countDocuments(),
            activeUniversities: await University.countDocuments({ isActive: true }),
            platformUsers: await PlatformUser.countDocuments(),
            totalSubscriptions: await Subscription.countDocuments(),
            activeSubscriptions: await Subscription.countDocuments({ status: 'Active' }),
            trialSubscriptions: await Subscription.countDocuments({ status: 'Trial' })
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ 
        status: 'OK', 
        message: 'QUEST OBE Portal - Production Version',
        database: dbStatus,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/test', (req, res) => {
    res.json({ message: 'API working', timestamp: new Date().toISOString() });
});

// ============================================
// UNIVERSITY-SPECIFIC API ENDPOINTS
// ============================================

// Get all users from university database
app.get('/api/users', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const User = uniDb.model('User', UserSchema);
        
        const filter = {};
        if (req.query.role) filter.role = req.query.role;
        if (req.query.department) filter.department = req.query.department;

        const users = await User.find(filter).select('-password').populate('department').sort({ role: 1, lastName: 1 });
        res.json(users);
        
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Create user in university database
app.post('/api/users', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const User = uniDb.model('User', UserSchema);
        const Department = uniDb.model('Department', DepartmentSchema);
        
        // Handle department - if it's a string, find or create the department
        if (req.body.department && typeof req.body.department === 'string') {
            let department = await Department.findOne({ 
                name: { $regex: new RegExp(req.body.department, 'i') } 
            });
            
            if (!department) {
                // Create default department if it doesn't exist
                const departmentCode = req.body.department.toUpperCase().replace(/\s+/g, '').substring(0, 5);
                department = new Department({
                    name: req.body.department,
                    code: departmentCode,
                    description: `${req.body.department} Department`,
                    faculty: 'Engineering', // Default faculty
                    contactInfo: {
                        email: `${departmentCode.toLowerCase()}@university.edu`,
                        phone: '000-000-0000'
                    }
                });
                await department.save();
                console.log(`✅ Created department: ${department.name}`);
            }
            
            req.body.department = department._id;
        }
        
        // For controller and dean roles, department is not required
        if (['controller', 'dean'].includes(req.body.role)) {
            delete req.body.department;
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(req.body.password, 12);
        req.body.password = hashedPassword;
        
        const user = new User(req.body);
        await user.save();
        
        console.log(`✅ User created: ${user.email}`);
        
        const userObj = user.toObject();
        delete userObj.password;
        
        res.status(201).json({ message: 'User created', user: userObj });
        
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const User = uniDb.model('User', UserSchema);
        
        // Don't allow password update through this endpoint
        delete req.body.password;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({ message: 'User updated', user });
        
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const User = uniDb.model('User', UserSchema);
        
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({ message: 'User deleted' });
        
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Get all courses from university database
app.get('/api/courses', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb, decoded } = await getUniversityDatabase(token);
        const Course = uniDb.model('Course', CourseSchema);
        const filter = { isActive: true };

        if (decoded.userType === 'university') {
            if (decoded.role === 'teacher') {
                filter.instructor = decoded.userId;
            } else if (decoded.role === 'student') {
                filter['enrolledStudents.student'] = decoded.userId;
                filter['enrolledStudents.status'] = { $in: ['enrolled', 'completed'] };
            }
        }

        const courses = await Course.find(filter)
            .populate('department', 'name code')
            .populate('instructor', 'firstName lastName email employeeId')
            .sort({ code: 1 });
        res.json(courses);
        
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// OBE data collections (CLOs, PLOs, PEOs, programs, assessments, results)
async function getUniCollectionData(req, res, collectionName) {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const items = await uniDb.collection(collectionName).find({}).sort({ code: 1, createdAt: -1 }).toArray();
        res.json(items);
    } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
}

app.get('/api/clos', (req, res) => getUniCollectionData(req, res, 'clos'));
app.get('/api/plos', (req, res) => getUniCollectionData(req, res, 'plos'));
app.get('/api/peos', (req, res) => getUniCollectionData(req, res, 'peos'));
app.get('/api/programs', (req, res) => getUniCollectionData(req, res, 'programs'));
app.get('/api/assessments', (req, res) => getUniCollectionData(req, res, 'assessments'));
app.get('/api/results', (req, res) => getUniCollectionData(req, res, 'results'));

// Get current user's university information
app.get('/api/my-university', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        try {
            const { university } = await getUniversityDatabase(token);
            
            const uniObj = university.toObject();
            if (university.logo && university.logo.contentType) {
                uniObj.logoUrl = `/api/universities/${university._id}/logo`;
            }
            delete uniObj.logo;
            
            res.json(uniObj);
        } catch (dbError) {
            console.error('Database error, trying fallback:', dbError);
            
            // Fallback: Get user info from token and find university by code
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await PlatformUser.findById(decoded.userId);
            
            if (user && user.universityCode) {
                const university = await University.findOne({ universityCode: user.universityCode });
                if (university) {
                    const uniObj = university.toObject();
                    if (university.logo && university.logo.contentType) {
                        uniObj.logoUrl = `/api/universities/${university._id}/logo`;
                    }
                    delete uniObj.logo;
                    
                    // Fix the user's university reference
                    if (!user.university) {
                        await PlatformUser.findByIdAndUpdate(user._id, { university: university._id });
                        console.log('Fixed user university reference');
                    }
                    
                    return res.json(uniObj);
                }
            }
            
            // Last resort fallback
            res.json({
                universityName: user?.universityCode === 'DEMO' ? 'Demo University' : 'Unknown University',
                universityCode: user?.universityCode || 'UNKNOWN',
                databaseName: user?.universityCode === 'DEMO' ? 'obe_university_demo' : `obe_university_${user?.universityCode?.toLowerCase() || 'unknown'}`
            });
        }
        
    } catch (error) {
        console.error('Error fetching university info:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Get all departments from university database
app.get('/api/departments', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const Department = uniDb.model('Department', DepartmentSchema);
        
        const departments = await Department.find({ isActive: true })
            .select('name code description faculty statistics')
            .populate('chairman', 'firstName lastName email')
            .sort({ name: 1 });
        
        res.json(departments);
        
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Change university super admin password (for Pro Admin)
app.post('/api/universities/:id/change-admin-password', proAdminAuth, async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        
        // Find the university
        const university = await University.findById(req.params.id);
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }
        
        // Find the university super admin
        const universityAdmin = await PlatformUser.findOne({ 
            university: university._id, 
            role: 'university_superadmin' 
        });
        
        if (!universityAdmin) {
            return res.status(404).json({ message: 'University super admin not found' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        // Update password
        await PlatformUser.findByIdAndUpdate(universityAdmin._id, {
            password: hashedPassword
        });
        
        console.log(`✅ Password changed for university admin: ${universityAdmin.email}`);
        
        res.json({ 
            message: 'Password changed successfully',
            adminEmail: universityAdmin.email
        });
        
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
    try {
        await connectDatabase();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log(`║  🌐 Server: http://localhost:${PORT}                      ║`);
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            console.log('🔗 URLs:');
            console.log(`   📱 Homepage: http://obe.org.pk`);
            console.log(`   🔐 Login: http://obe.org.pk/login.html`);
            console.log(`   🏥 Health: http://obe.org.pk/api/health\n`);
            console.log('🔐 Default Login:');
            console.log('   📧 Email: pro@obe.org.pk');
            console.log('   🔑 Password: proadmin123\n');
            console.log('✅ Ready! All features including database management available!\n');
        });
    } catch (error) {
        console.error('❌ Startup failed:', error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down...');
    await mongoose.connection.close();
    process.exit(0);
});

startServer();
