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
        
        // Find user in platform database
        const user = await PlatformUser.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            console.log(`❌ User not found: ${email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        if (!user.isActive) {
            console.log(`❌ User inactive: ${email}`);
            return res.status(401).json({ message: 'Account inactive' });
        }
        
        const isValid = await user.comparePassword(password);
        
        if (!isValid) {
            console.log(`❌ Wrong password: ${email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        console.log(`✅ Login successful: ${email} (${user.role})`);
        
        // Create token
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email, 
                role: user.role,
                universityId: user.university,
                universityCode: user.universityCode
            },
            process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024',
            { expiresIn: '7d' }
        );
        
        return res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                universityCode: user.universityCode,
                permissions: user.permissions,
                isActive: user.isActive
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/auth/check', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ authenticated: false });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024');
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
app.get('/api/universities', async (req, res) => {
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
app.get('/api/universities/:id', async (req, res) => {
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
app.put('/api/universities/:id', upload.single('logo'), async (req, res) => {
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
app.delete('/api/universities/:id', async (req, res) => {
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

app.get('/api/platform-users', async (req, res) => {
    try {
        const users = await PlatformUser.find({}, '-password').populate('university');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.post('/api/platform-users', async (req, res) => {
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
app.delete('/api/platform-users/:id', async (req, res) => {
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

app.get('/api/subscriptions', async (req, res) => {
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

app.get('/api/databases', async (req, res) => {
    try {
        const admin = mongoose.connection.db.admin();
        const { databases } = await admin.listDatabases();
        
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
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.post('/api/databases/create', async (req, res) => {
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
app.get('/api/databases/:dbName/collections', async (req, res) => {
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
app.get('/api/databases/:dbName/details', async (req, res) => {
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
app.delete('/api/databases/:dbName', async (req, res) => {
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
app.get('/api/mongodb-settings', async (req, res) => {
    try {
        const currentUri = process.env.MONGODB_URI || '';
        
        let parsedSettings = {
            host: 'localhost',
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

        res.json({
            success: true,
            settings: parsedSettings,
            rawUri: currentUri
        });

    } catch (error) {
        console.error('Error getting MongoDB settings:', error);
        res.status(500).json({ message: 'Error retrieving settings', error: error.message });
    }
});

// Test MongoDB connection
app.post('/api/mongodb-settings/test', async (req, res) => {
    try {
        const { host, port, username, password, database, authSource } = req.body;

        let testUri;
        if (username && password) {
            const encodedUser = encodeURIComponent(username);
            const encodedPass = encodeURIComponent(password);
            testUri = `mongodb://${encodedUser}:${encodedPass}@${host}:${port}/${database}?authSource=${authSource || 'admin'}`;
        } else {
            testUri = `mongodb://${host}:${port}/${database}`;
        }

        console.log(`Testing MongoDB connection to: ${host}:${port}/${database}`);

        const testConnection = await mongoose.createConnection(testUri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 5000
        });

        if (testConnection.readyState === 1) {
            await testConnection.close();
            console.log('✅ MongoDB connection test successful');
            res.json({ 
                success: true, 
                message: 'Connection successful! MongoDB is accessible.',
                status: 'Connected'
            });
        } else {
            await testConnection.close();
            res.status(400).json({ 
                success: false, 
                message: 'Connection failed. Please check your settings.'
            });
        }

    } catch (error) {
        console.error('MongoDB connection test failed:', error);
        res.status(400).json({ 
            success: false, 
            message: `Connection failed: ${error.message}`,
            error: error.message
        });
    }
});

// Update MongoDB settings
app.put('/api/mongodb-settings', async (req, res) => {
    try {
        const { host, port, username, password, database, authSource } = req.body;

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
        console.log('⚠️  Server restart required for changes to take effect');

        res.json({ 
            success: true, 
            message: 'MongoDB settings updated successfully. Please restart the server for changes to take effect.',
            requiresRestart: true,
            newUri: newUri
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
// STATISTICS
// ============================================

app.get('/api/platform-stats', async (req, res) => {
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
