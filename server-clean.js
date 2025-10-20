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
console.log('║     🎓 QUEST OBE Portal - CLEAN VERSION                 ║');
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

        // Create university database
        try {
            const uniDb = mongoose.connection.useDb(dbName);
            await uniDb.createCollection('_metadata');
            await uniDb.collection('_metadata').insertOne({
                universityId: university._id,
                universityName: university.universityName,
                universityCode: university.universityCode,
                created: new Date()
            });
            console.log(`✅ Database created: ${dbName}`);
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
            console.error(`   Full error:`, adminErr);
            // Don't fail the whole request, just log it
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

// Create university super admin
app.post('/api/university-super-admins', async (req, res) => {
    try {
        const { universityId, universityCode, email, name, password } = req.body;

        // Check if email already exists
        const existing = await PlatformUser.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Verify university exists
        const university = await University.findById(universityId);
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const superAdmin = await PlatformUser.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            name,
            role: 'university_superadmin',
            university: universityId,
            universityCode: universityCode,
            permissions: ['all'],
            isActive: true
        });

        console.log(`✅ University Super Admin created: ${email} for ${universityCode}`);

        const userObj = superAdmin.toObject();
        delete userObj.password;

        res.status(201).json({ message: 'University Super Admin created', user: userObj });

    } catch (error) {
        console.error('Error creating university super admin:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Reset password
app.post('/api/platform-users/:id/reset-password', async (req, res) => {
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

        console.log(`✅ Password reset for: ${user.email}`);

        res.json({ message: 'Password reset successfully' });

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

        // Don't allow deleting pro_superadmin
        if (user.role === 'pro_superadmin') {
            return res.status(403).json({ message: 'Cannot delete Pro Super Admin' });
        }

        await user.deleteOne();

        res.json({ message: 'User deleted' });

    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Get my university (for university super admins)
app.get('/api/my-university', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024');
        
        // Check if user is university super admin
        const platformUser = await PlatformUser.findById(decoded.userId);
        
        if (!platformUser || platformUser.role !== 'university_superadmin') {
            return res.status(403).json({ message: 'Not authorized' });
        }
        
        // Get their university
        const university = await University.findById(platformUser.university);
        
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }
        
        const uniObj = university.toObject();
        if (university.logo && university.logo.contentType) {
            uniObj.logoUrl = `/api/universities/${university._id}/logo`;
        }
        delete uniObj.logo;
        
        res.json(uniObj);
        
    } catch (error) {
        console.error('Error getting university:', error);
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
// UNIVERSITY-SPECIFIC APIs
// (For University Super Admins accessing their university data)
// ============================================

// Helper function to get university database connection
async function getUniversityDatabase(token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024');
    
    // Get user's university
    const user = await PlatformUser.findById(decoded.userId);
    if (!user || user.role !== 'university_superadmin') {
        throw new Error('Not authorized');
    }
    
    const university = await University.findById(user.university);
    if (!university) {
        throw new Error('University not found');
    }
    
    // Return connection to university database
    const uniDb = mongoose.connection.useDb(university.databaseName);
    return { uniDb, university };
}

// ============================================
// DEPARTMENTS API
// ============================================

// Get all departments
app.get('/api/departments', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const DepartmentSchema = require('./models/Department');
        const Department = uniDb.model('Department', DepartmentSchema);
        
        const departments = await Department.find({}).sort({ createdAt: -1 });
        res.json(departments);
        
    } catch (error) {
        console.error('Error getting departments:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Create department
app.post('/api/departments', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const DepartmentSchema = require('./models/Department');
        const Department = uniDb.model('Department', DepartmentSchema);
        
        const department = new Department(req.body);
        await department.save();
        
        console.log(`✅ Department created: ${department.name}`);
        res.status(201).json({ message: 'Department created', department });
        
    } catch (error) {
        console.error('Error creating department:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Update department
app.put('/api/departments/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const DepartmentSchema = require('./models/Department');
        const Department = uniDb.model('Department', DepartmentSchema);
        
        const department = await Department.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }
        
        res.json({ message: 'Department updated', department });
        
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Delete department
app.delete('/api/departments/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const DepartmentSchema = require('./models/Department');
        const Department = uniDb.model('Department', DepartmentSchema);
        
        const department = await Department.findByIdAndDelete(req.params.id);
        
        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }
        
        res.json({ message: 'Department deleted' });
        
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// ============================================
// USERS API (University-specific)
// ============================================

// Get all users from university database
app.get('/api/users', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const UserSchema = require('./models/User');
        const User = uniDb.model('User', UserSchema);
        
        const users = await User.find({}, '-password').populate('department').sort({ createdAt: -1 });
        res.json(users);
        
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Create user
app.post('/api/users', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const UserSchema = require('./models/User');
        const User = uniDb.model('User', UserSchema);
        
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
        const UserSchema = require('./models/User');
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
        const UserSchema = require('./models/User');
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

// ============================================
// COURSES API
// ============================================

// Get all courses from university database
app.get('/api/courses', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const CourseSchema = require('./models/Course');
        const Course = uniDb.model('Course', CourseSchema);
        
        const courses = await Course.find({}).populate('department').sort({ createdAt: -1 });
        res.json(courses);
        
    } catch (error) {
        console.error('Error getting courses:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Create course
app.post('/api/courses', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const CourseSchema = require('./models/Course');
        const Course = uniDb.model('Course', CourseSchema);
        
        const course = new Course(req.body);
        await course.save();
        
        console.log(`✅ Course created: ${course.name}`);
        res.status(201).json({ message: 'Course created', course });
        
    } catch (error) {
        console.error('Error creating course:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Update course
app.put('/api/courses/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const CourseSchema = require('./models/Course');
        const Course = uniDb.model('Course', CourseSchema);
        
        const course = await Course.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        
        res.json({ message: 'Course updated', course });
        
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Delete course
app.delete('/api/courses/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token' });
        }
        
        const { uniDb } = await getUniversityDatabase(token);
        const CourseSchema = require('./models/Course');
        const Course = uniDb.model('Course', CourseSchema);
        
        const course = await Course.findByIdAndDelete(req.params.id);
        
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        
        res.json({ message: 'Course deleted' });
        
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
        await db.createCollection('_metadata');
        await db.collection('_metadata').insertOne({
            created: new Date(),
            description: description || `Database: ${databaseName}`
        });
        
        console.log(`✅ Database created: ${databaseName}`);
        
        res.json({ message: 'Database created', database: { name: databaseName } });
        
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
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
        message: 'QUEST OBE Portal - CLEAN VERSION',
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
            console.log('✅ Ready!\n');
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

