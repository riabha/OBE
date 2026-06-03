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
        if (file.mimetype.startsWith('image/') || file.mimetype === 'image/svg+xml') {
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
const UNIVERSITY_STAFF_ROLES = ['student', 'teacher', 'focal', 'chairman', 'dean', 'controller'];
const PLATFORM_LOGIN_ROLES = ['pro_superadmin', 'platform_admin', 'university_superadmin', 'support', 'superadmin'];

const ROLE_PRIORITY = {
    pro_superadmin: 100,
    platform_admin: 90,
    university_superadmin: 85,
    superadmin: 85,
    controller: 80,
    dean: 70,
    chairman: 60,
    focal: 50,
    teacher: 40,
    student: 10,
    support: 5
};

function normalizeRoleList(roles) {
    return [...new Set((roles || []).filter(Boolean).map(r => r === 'superadmin' ? 'university_superadmin' : r))];
}

function getUserRolesFromDoc(doc) {
    if (!doc) return [];
    if (typeof doc.getRoles === 'function') return normalizeRoleList(doc.getRoles());
    if (Array.isArray(doc.roles) && doc.roles.length) return normalizeRoleList(doc.roles);
    return doc.role ? normalizeRoleList([doc.role]) : [];
}

function pickDefaultActiveRole(roles, preferred) {
    const list = normalizeRoleList(roles);
    if (!list.length) return null;
    if (preferred && list.includes(preferred)) return preferred;
    return list.sort((a, b) => (ROLE_PRIORITY[b] || 0) - (ROLE_PRIORITY[a] || 0))[0];
}

function applyUniversityUserRoleDefaults(user, roles) {
    const list = roles || getUserRolesFromDoc(user);
    const idSuffix = String(user._id || Date.now()).slice(-6);

    if (list.includes('student')) {
        if (!user.studentId) user.studentId = `STU${idSuffix}`;
        if (!user.semester) user.semester = 1;
        if (!user.batch) user.batch = String(new Date().getFullYear());
    }
    if (list.some(r => ['teacher', 'focal', 'chairman'].includes(r))) {
        if (!user.employeeId) user.employeeId = `EMP${idSuffix}`;
        if (!user.designation) user.designation = 'Faculty';
        if (!user.qualification) user.qualification = 'Graduate';
    }
    if (list.every(r => ['controller', 'dean'].includes(r))) {
        user.department = undefined;
    }
}

function isPlatformRole(role) {
    return PLATFORM_LOGIN_ROLES.includes(role);
}

function buildTokenPayload(session, activeRole) {
    const role = activeRole || pickDefaultActiveRole(session.availableRoles);
    const platformContext = isPlatformRole(role);
    return {
        userId: platformContext ? session.platformUserId : session.universityUserId,
        email: session.email,
        name: session.name,
        role,
        activeRole: role,
        availableRoles: session.availableRoles,
        universityId: session.university?._id || session.universityId || null,
        universityCode: session.university?.universityCode || session.universityCode || null,
        userType: platformContext ? 'platform' : 'university',
        platformUserId: session.platformUserId || null,
        universityUserId: session.universityUserId || null
    };
}

function buildUserPayload(session, activeRole) {
    const role = activeRole || pickDefaultActiveRole(session.availableRoles);
    return {
        id: isPlatformRole(role) ? session.platformUserId : session.universityUserId,
        email: session.email,
        name: session.name,
        role,
        activeRole: role,
        availableRoles: session.availableRoles,
        roles: session.availableRoles,
        universityCode: session.university?.universityCode || session.universityCode || null,
        studentId: session.universityProfile?.studentId,
        semester: session.universityProfile?.semester,
        batch: session.universityProfile?.batch,
        employeeId: session.universityProfile?.employeeId,
        department: session.universityProfile?.department,
        permissions: session.platformProfile?.permissions,
        isActive: true
    };
}

async function findUniversityUserByEmail(email, universityRef) {
    let university = null;
    if (universityRef && universityRef._id) {
        university = universityRef;
    } else if (typeof universityRef === 'string') {
        university = await University.findOne({
            $or: [
                { universityCode: universityRef.toUpperCase() },
                { databaseName: universityRef }
            ]
        });
    }
    if (!university) return null;
    const dbName = getCanonicalDatabaseName(university) || university.databaseName;
    const uniDb = mongoose.connection.useDb(dbName);
    const { User } = getUniModels(uniDb);
    const uniUser = await User.findOne({ email: email.toLowerCase(), isActive: true });
    return uniUser ? { uniUser, university } : null;
}

async function buildLoginSession(email, password) {
    const normalizedEmail = email.toLowerCase();
    let platformUser = null;
    let platformOk = false;
    let uniLogin = null;

    platformUser = await PlatformUser.findOne({ email: normalizedEmail });
    if (platformUser?.isActive && await platformUser.comparePassword(password)) {
        platformOk = true;
    }

    uniLogin = await findUniversityUserByCredentials(normalizedEmail, password);

    if (!platformOk && !uniLogin) return null;

    const availableRoles = [];
    let platformUserId = null;
    let universityUserId = null;
    let university = uniLogin?.university || null;
    let name = '';
    let universityProfile = null;
    let platformProfile = null;

    if (platformOk) {
        platformUserId = platformUser._id;
        platformProfile = platformUser;
        getUserRolesFromDoc(platformUser).forEach(r => availableRoles.push(r));
        if (!availableRoles.length && platformUser.role) availableRoles.push(platformUser.role);
        name = platformUser.name;

        if (platformUser.universityCode) {
            university = university || await University.findOne({ universityCode: platformUser.universityCode.toUpperCase() });
            const linked = await findUniversityUserByEmail(normalizedEmail, university);
            if (linked) {
                university = linked.university;
                universityUserId = linked.uniUser._id;
                universityProfile = linked.uniUser;
                getUserRolesFromDoc(linked.uniUser).forEach(r => availableRoles.push(r));
            }
        }
    }

    if (uniLogin) {
        university = uniLogin.university;
        universityUserId = uniLogin.uniUser._id;
        universityProfile = uniLogin.uniUser;
        if (!name) name = `${uniLogin.uniUser.firstName} ${uniLogin.uniUser.lastName}`.trim();
        getUserRolesFromDoc(uniLogin.uniUser).forEach(r => availableRoles.push(r));
    }

    const uniqueRoles = normalizeRoleList(availableRoles);
    if (!uniqueRoles.length) return null;

    const lastRoleKey = `lastActiveRole_${normalizedEmail}`;
    // lastRole from client is applied at select-role; server uses priority here

    return {
        email: normalizedEmail,
        name,
        availableRoles: uniqueRoles,
        platformUserId,
        universityUserId,
        university,
        universityCode: university?.universityCode,
        universityId: university?._id,
        universityProfile,
        platformProfile
    };
}

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
const FacultySchema = require('./models/Faculty');
const { facultyCodeFromName } = require('./utils/faculty-code');

function getUniModels(uniDb) {
    const User = uniDb.models.User || uniDb.model('User', UserSchema);
    const Department = uniDb.models.Department || uniDb.model('Department', DepartmentSchema);
    const Course = uniDb.models.Course || uniDb.model('Course', CourseSchema);
    const Faculty = uniDb.models.Faculty || uniDb.model('Faculty', FacultySchema);
    return { User, Department, Course, Faculty };
}

function formatUserResponse(user) {
    const obj = user.toObject ? user.toObject({ virtuals: false }) : user;
    const roles = getUserRolesFromDoc(user);
    const instructor = obj.instructor;
        return {
            ...obj,
            id: obj._id,
            roles,
            role: obj.role || roles[0],
            name: `${obj.firstName || ''} ${obj.lastName || ''}`.trim(),
        studentId: obj.studentId,
        semester: obj.semester,
        batch: obj.batch,
        employeeId: obj.employeeId,
        department: obj.department?.name || obj.department || null,
        departmentName: obj.department?.name || null,
        departmentId: obj.department?._id || obj.department
    };
}

function formatCourseResponse(course) {
    const obj = course.toObject ? course.toObject({ virtuals: false }) : course;
    const instructor = obj.instructor;
        return {
            ...obj,
            id: obj._id,
            name: obj.title || obj.name,
            creditHours: obj.credits || obj.creditHours || 3,
            instructorName: instructor
            ? `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim()
            : null,
        departmentName: obj.department?.name || null
    };
}

function formatCourseListItem(course, deptMap, instMap) {
    const dept = deptMap.get(String(course.department));
    const inst = instMap.get(String(course.instructor));
    return {
        _id: course._id,
        id: course._id,
        code: course.code,
        title: course.title,
        name: course.title,
        description: course.description,
        program: course.program,
        semester: course.semester,
        credits: course.credits,
        creditHours: course.credits || 3,
        department: dept ? { _id: dept._id, name: dept.name, code: dept.code } : course.department,
        departmentName: dept?.name || null,
        instructor: inst || course.instructor,
        instructorName: inst
            ? `${inst.firstName || ''} ${inst.lastName || ''}`.trim()
            : null,
        isActive: course.isActive !== false,
        academicYear: course.academicYear,
        semesterName: course.semesterName,
        statistics: course.statistics
    };
}

function buildDefaultUniversityLogo(letter) {
    const ch = String(letter || 'U').charAt(0).toUpperCase();
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#2563eb"/>
  <text x="64" y="82" font-family="Arial,sans-serif" font-size="56" font-weight="700" fill="#ffffff" text-anchor="middle">${ch}</text>
</svg>`;
    return { data: Buffer.from(svg), contentType: 'image/svg+xml' };
}

const DEMO_CANONICAL_DB = 'obe_university_demo';
const LEGACY_DEMO_DB_NAMES = new Set(['obe_demo', 'obe_university_DEMO', '']);

const UNI_DB_COLLECTIONS = [
    '_metadata', 'faculties', 'departments', 'users', 'courses', 'sections', 'enrollments',
    'assessments', 'results', 'clos', 'plos', 'peos', 'programs', 'attainments', 'reports', 'settings'
];

const MAX_UNIVERSITY_CODE_LEN = 24;

function normalizeUniversityCode(rawCode, universityName) {
    let code = String(rawCode || '')
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    if (!code) {
        code = String(universityName || 'UNI')
            .replace(/[^A-Za-z0-9]/g, '')
            .toUpperCase()
            .slice(0, 12) || 'UNI';
    }
    return code.slice(0, MAX_UNIVERSITY_CODE_LEN);
}

function databaseNameFromUniversityCode(code) {
    const slug = String(code).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
    return `obe_university_${slug}`;
}

function getCanonicalDatabaseName(university) {
    if (!university) return null;
    const stored = (university.databaseName || '').trim();
    const code = (university.universityCode || '').toUpperCase();
    if (code === 'DEMO' && LEGACY_DEMO_DB_NAMES.has(stored)) {
        return DEMO_CANONICAL_DB;
    }
    return stored || null;
}

async function syncUniversityDatabaseName(university) {
    const canonical = getCanonicalDatabaseName(university);
    if (canonical && university.databaseName !== canonical) {
        university.databaseName = canonical;
        await university.save();
        console.log(`✅ Corrected university DB name → ${canonical}`);
    }
    return canonical || university.databaseName;
}

async function ensureUniversityDbCollections(dbName, meta = {}) {
    if (!dbName || !dbName.startsWith('obe_') || dbName === 'obe_platform') {
        throw new Error('Invalid university database name');
    }
    const uniDb = mongoose.connection.useDb(dbName);
    for (const collectionName of UNI_DB_COLLECTIONS) {
        try {
            await uniDb.createCollection(collectionName);
        } catch (err) {
            if (!String(err.message).includes('already exists')) {
                console.log(`   ⚠️  ${collectionName}: ${err.message}`);
            }
        }
    }
    const existingMeta = await uniDb.collection('_metadata').findOne({});
    if (!existingMeta) {
        await uniDb.collection('_metadata').insertOne({
            ...meta,
            created: new Date(),
            collections: UNI_DB_COLLECTIONS,
            version: '1.0'
        });
    }
    return uniDb;
}

async function findUniversityUserByCredentials(email, password) {
    const universities = await University.find({ isActive: true });
    for (const university of universities) {
        const dbName = getCanonicalDatabaseName(university) || university.databaseName;
        const uniDb = mongoose.connection.useDb(dbName);
        const { User } = getUniModels(uniDb);
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
    const activeRole = decoded.activeRole || decoded.role;
    let university;

    const platformAdminRoles = ['university_superadmin', 'superadmin'];
    const usePlatformContext = decoded.userType === 'platform' && platformAdminRoles.includes(activeRole);

    if (usePlatformContext) {
        const user = await PlatformUser.findById(decoded.platformUserId || decoded.userId);
        if (!user || !platformAdminRoles.includes(user.role)) {
            throw new Error('Not authorized');
        }
        university = await University.findById(user.university)
            || await University.findOne({ universityCode: user.universityCode });
        if (!university && user.universityCode) {
            university = await University.findOne({ universityCode: user.universityCode.toUpperCase() });
        }
        if (university && !user.university) {
            user.university = university._id;
            await user.save().catch(() => {});
        }
    } else {
        university = decoded.universityId
            ? await University.findById(decoded.universityId)
            : await University.findOne({ universityCode: decoded.universityCode });
    }

    if (!university) {
        throw new Error('University not found');
    }

    const dbName = await syncUniversityDatabaseName(university);
    const uniDb = mongoose.connection.useDb(dbName);
    const effectiveDecoded = { ...decoded, role: activeRole, activeRole };
    return { uniDb, university, decoded: effectiveDecoded };
}

function buildAuthResponse(userPayload, tokenPayload) {
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    return {
        message: 'Login successful',
        token,
        user: userPayload,
        needsRoleSelection: (userPayload.availableRoles || []).length > 1
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
app.get('/select-role', (req, res) => res.sendFile(path.join(__dirname, 'public', 'select-role.html')));

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

        const session = await buildLoginSession(email, password);
        if (!session) {
            console.log(`❌ User not found or wrong password: ${email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const preferredRole = req.body.preferredRole || null;
        const activeRole = pickDefaultActiveRole(session.availableRoles, preferredRole);

        if (session.platformUserId && session.platformProfile) {
            session.platformProfile.lastLogin = new Date();
            await session.platformProfile.save();
        }
        if (session.universityUserId && session.universityProfile) {
            session.universityProfile.lastLogin = new Date();
            await session.universityProfile.save();
        }

        console.log(`✅ Login successful: ${email} roles=[${session.availableRoles.join(', ')}] active=${activeRole}`);

        return res.json(buildAuthResponse(
            buildUserPayload(session, activeRole),
            buildTokenPayload(session, activeRole)
        ));
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/select-role', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Authentication required' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const { role } = req.body;
        const availableRoles = normalizeRoleList(decoded.availableRoles || [decoded.activeRole || decoded.role]);

        if (!role || !availableRoles.includes(role)) {
            return res.status(403).json({ message: 'Role not available for this account' });
        }

        const session = {
            email: decoded.email,
            name: decoded.name,
            availableRoles,
            platformUserId: decoded.platformUserId || (isPlatformRole(decoded.activeRole || decoded.role) ? decoded.userId : null),
            universityUserId: decoded.universityUserId || (!isPlatformRole(decoded.activeRole || decoded.role) ? decoded.userId : null),
            universityId: decoded.universityId,
            universityCode: decoded.universityCode,
            university: decoded.universityId ? { _id: decoded.universityId, universityCode: decoded.universityCode } : null
        };

        if (isPlatformRole(role) && session.platformUserId) {
            const pu = await PlatformUser.findById(session.platformUserId);
            if (pu) session.platformProfile = pu;
        } else if (session.universityUserId && session.universityCode) {
            const linked = await findUniversityUserByEmail(decoded.email, session.universityCode);
            if (linked) {
                session.universityProfile = linked.uniUser;
                session.university = linked.university;
            }
        }

        return res.json(buildAuthResponse(
            buildUserPayload(session, role),
            buildTokenPayload(session, role)
        ));
    } catch (error) {
        console.error('Select role error:', error);
        res.status(401).json({ message: 'Invalid or expired session' });
    }
});

app.get('/api/auth/check', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ authenticated: false });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const activeRole = decoded.activeRole || decoded.role;
        const availableRoles = normalizeRoleList(decoded.availableRoles || [activeRole]);
        if (decoded.userType === 'university') {
            return res.json({
                authenticated: true,
                user: {
                    id: decoded.userId,
                    email: decoded.email,
                    name: decoded.name,
                    role: activeRole,
                    activeRole,
                    availableRoles,
                    roles: availableRoles,
                    universityCode: decoded.universityCode
                }
            });
        }
        const user = await PlatformUser.findById(decoded.platformUserId || decoded.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({ authenticated: false });
        }
        res.json({
            authenticated: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: activeRole,
                activeRole,
                availableRoles,
                roles: availableRoles,
                universityCode: decoded.universityCode || user.universityCode
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

// Get all universities (with live counts from each university database)
app.get('/api/universities', proAdminAuth, async (req, res) => {
    try {
        const skipCounts = req.query.quick === '1' || req.query.quick === 'true';
        const universities = await University.find({}, '-logo.data').sort({ createdAt: -1 });
        const result = await Promise.all(universities.map(async (uni) => {
            const obj = uni.toObject();
            if (uni.logo && uni.logo.data) {
                obj.logoUrl = `/api/universities/${uni._id}/logo`;
            }
            const dbName = getCanonicalDatabaseName(uni) || uni.databaseName;
            obj.databaseName = dbName;
            if (skipCounts) {
                obj.totalUsers = null;
                obj.totalCourses = null;
            } else {
                const counts = await getUniversityDbCounts(dbName);
                obj.totalUsers = counts.totalUsers;
                obj.totalCourses = counts.totalCourses;
            }
            return obj;
        }));
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

// Get university logo (public by id — used by Pro Admin listings)
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

// Authenticated logo for current user's university (dashboards use Bearer token)
app.get('/api/my-university/logo', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).send('Unauthorized');
        }
        const { university } = await getUniversityDatabase(token);
        if (!university?.logo?.data) {
            return res.status(404).send('Logo not found');
        }
        res.set('Cache-Control', 'private, max-age=3600');
        res.contentType(university.logo.contentType || 'image/png');
        res.send(university.logo.data);
    } catch (error) {
        console.error('Error fetching university logo:', error);
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

        const normalizedCode = normalizeUniversityCode(universityCode, universityName);
        console.log(`\n📝 Creating university: ${universityName} (${normalizedCode})`);

        // Check if code exists
        const existing = await University.findOne({ universityCode: normalizedCode });
        if (existing) {
            return res.status(400).json({ message: 'University code already exists' });
        }

        // Determine database name
        let dbName;
        if ((databaseOption === 'manual' || databaseOption === 'existing') && databaseName) {
            dbName = String(databaseName).trim();
            if (!dbName.startsWith('obe_') || dbName === 'obe_platform') {
                return res.status(400).json({ message: 'Invalid database name' });
            }
            const taken = await University.findOne({ databaseName: dbName });
            if (taken) {
                return res.status(400).json({
                    message: `Database "${dbName}" is already assigned to ${taken.universityName} (${taken.universityCode}). Each university must have its own database.`
                });
            }
        } else {
            dbName = databaseNameFromUniversityCode(normalizedCode);
        }

        const logoPayload = req.file
            ? { data: req.file.buffer, contentType: req.file.mimetype }
            : buildDefaultUniversityLogo(universityName);

        // Create university
        const university = new University({
            universityName,
            universityCode: normalizedCode,
            databaseName: dbName,
            logo: logoPayload,
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

        try {
            await ensureUniversityDbCollections(dbName, {
                universityId: university._id,
                universityName: university.universityName,
                universityCode: university.universityCode
            });
            console.log(`✅ Database ready: ${dbName}`);
        } catch (dbErr) {
            console.log(`⚠️  Database setup: ${dbErr.message}`);
        }

        // Create university super admin in PLATFORM database
        let superAdminPassword = '';
        try {
            superAdminPassword = 'Admin@' + normalizedCode + '2025';
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

        const fields = [
            'universityName', 'city', 'country', 'superAdminEmail', 'contactPhone',
            'contactEmail', 'website', 'subscriptionPlan', 'address'
        ];
        fields.forEach(f => {
            if (req.body[f] !== undefined && req.body[f] !== '') {
                university[f] = f === 'superAdminEmail'
                    ? String(req.body[f]).toLowerCase().trim()
                    : req.body[f];
            }
        });
        if (req.body.isActive !== undefined) {
            university.isActive = req.body.isActive === '1' || req.body.isActive === true || req.body.isActive === 'true';
        }

        if (req.body.databaseName && req.body.databaseName !== university.databaseName) {
            const newDb = String(req.body.databaseName).trim();
            if (!newDb.startsWith('obe_') || newDb === 'obe_platform') {
                return res.status(400).json({ message: 'Invalid database name' });
            }
            const taken = await University.findOne({ databaseName: newDb, _id: { $ne: university._id } });
            if (taken) {
                return res.status(400).json({ message: `Database already assigned to ${taken.universityName}` });
            }
            await ensureUniversityDbCollections(newDb, {
                universityId: university._id,
                universityName: university.universityName,
                universityCode: university.universityCode
            });
            university.databaseName = newDb;
        }

        if (req.file) {
            university.logo = {
                data: req.file.buffer,
                contentType: req.file.mimetype
            };
        }

        await university.save();

        let passwordResetForResponse = null;
        const wantsReset = req.body.resetPassword === 'true' || req.body.resetPassword === true;
        if (wantsReset && req.body.newPassword) {
            const plainPassword = String(req.body.newPassword);
            if (plainPassword.length < 8) {
                return res.status(400).json({ message: 'New password must be at least 8 characters' });
            }
            const universityAdmin = await PlatformUser.findOne({
                university: university._id,
                role: 'university_superadmin'
            });
            if (!universityAdmin) {
                return res.status(404).json({
                    message: 'University super admin account not found. Add one from Platform Users or recreate the university.'
                });
            }
            universityAdmin.password = await bcrypt.hash(plainPassword, 12);
            universityAdmin.email = university.superAdminEmail;
            universityAdmin.isActive = true;
            await universityAdmin.save();
            passwordResetForResponse = plainPassword;
            console.log(`✅ Password reset for university admin: ${universityAdmin.email}`);
        } else if (req.body.superAdminEmail) {
            const universityAdmin = await PlatformUser.findOne({
                university: university._id,
                role: 'university_superadmin'
            });
            if (universityAdmin && universityAdmin.email !== university.superAdminEmail) {
                const emailTaken = await PlatformUser.findOne({
                    email: university.superAdminEmail,
                    _id: { $ne: universityAdmin._id }
                });
                if (emailTaken) {
                    return res.status(400).json({ message: 'Super admin email already in use by another account' });
                }
                universityAdmin.email = university.superAdminEmail;
                await universityAdmin.save();
            }
        }

        const obj = university.toObject();
        delete obj.logo;
        res.json({
            message: passwordResetForResponse ? 'University updated and super admin password reset' : 'University updated',
            university: obj,
            universityName: university.universityName,
            superAdminEmail: university.superAdminEmail,
            newPassword: passwordResetForResponse || undefined
        });

    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Assign/reassign MongoDB database to a university (pro admin)
app.put('/api/universities/:id/assign-database', proAdminAuth, async (req, res) => {
    try {
        const { databaseName } = req.body;
        if (!databaseName || !String(databaseName).startsWith('obe_')) {
            return res.status(400).json({ message: 'databaseName must start with obe_' });
        }
        if (databaseName === 'obe_platform') {
            return res.status(400).json({ message: 'Cannot assign platform database' });
        }

        const university = await University.findById(req.params.id);
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }

        const taken = await University.findOne({
            databaseName: String(databaseName).trim(),
            _id: { $ne: university._id }
        });
        if (taken) {
            return res.status(400).json({
                message: `Database "${databaseName}" is already assigned to ${taken.universityName}`
            });
        }

        await ensureUniversityDbCollections(databaseName, {
            universityId: university._id,
            universityName: university.universityName,
            universityCode: university.universityCode
        });

        university.databaseName = String(databaseName).trim();
        await university.save();

        res.json({
            message: 'Database assigned successfully',
            university: {
                id: university._id,
                universityName: university.universityName,
                universityCode: university.universityCode,
                databaseName: university.databaseName
            }
        });
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
        
        const universities = await University.find({}, 'universityName universityCode databaseName');
        const assignmentByDb = {};
        universities.forEach(u => {
            if (u.databaseName) assignmentByDb[u.databaseName] = u;
        });

        const allDatabases = databases.map(db => {
            const assigned = assignmentByDb[db.name];
            return {
                name: db.name,
                sizeOnDisk: db.sizeOnDisk,
                sizeMB: (db.sizeOnDisk / 1024 / 1024).toFixed(2),
                empty: db.empty,
                type: db.name === 'obe_platform' ? 'Platform' :
                    db.name.startsWith('obe_') ? 'University' : 'Other',
                canAssign: db.name !== 'admin' && db.name !== 'config' && db.name !== 'local' && db.name !== 'obe_platform',
                assignedUniversity: assigned ? {
                    id: assigned._id,
                    name: assigned.universityName,
                    code: assigned.universityCode
                } : null
            };
        });
        
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
                databaseName: db.name,
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
        
        await ensureUniversityDbCollections(databaseName, {
            description: description || `Database: ${databaseName}`
        });
        console.log(`✅ Database created: ${databaseName}`);
        
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
        const force = req.query.force === 'true';
        
        // Prevent deleting platform database
        if (dbName === 'obe_platform') {
            return res.status(403).json({ message: 'Cannot delete platform database' });
        }

        if (!dbName.startsWith('obe_')) {
            return res.status(400).json({ message: 'Invalid database name' });
        }

        const assignedUni = await University.findOne({ databaseName: dbName });
        if (assignedUni && !force) {
            return res.status(400).json({
                message: `Database is assigned to ${assignedUni.universityName}. Unassign first or use force=true.`,
                canForceDelete: true,
                assignedUniversity: assignedUni.universityName
            });
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

async function getUniversityDbCounts(dbName, timeoutMs = 4000) {
    if (!dbName) return { totalUsers: 0, totalCourses: 0 };
    const work = (async () => {
        const uniDb = mongoose.connection.useDb(dbName);
        const { User, Course } = getUniModels(uniDb);
        const [totalUsers, totalCourses] = await Promise.all([
            User.countDocuments({ isActive: true }).maxTimeMS(3000),
            Course.countDocuments({ isActive: true }).maxTimeMS(3000)
        ]);
        return { totalUsers, totalCourses };
    })();
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('count timeout')), timeoutMs)
    );
    try {
        return await Promise.race([work, timeout]);
    } catch (err) {
        console.warn(`Count skip ${dbName}:`, err.message);
        return { totalUsers: 0, totalCourses: 0 };
    }
}

async function aggregatePlatformCounts() {
    const universities = await University.find({ isActive: true });
    let totalUsers = 0;
    let totalCourses = 0;
    for (const university of universities) {
        const dbName = getCanonicalDatabaseName(university) || university.databaseName;
        const counts = await getUniversityDbCounts(dbName);
        totalUsers += counts.totalUsers;
        totalCourses += counts.totalCourses;
    }
    return { totalUsers, totalCourses };
}

app.get('/api/platform-stats/public', async (req, res) => {
    try {
        const { totalUsers, totalCourses } = await aggregatePlatformCounts();
        res.json({
            totalUniversities: await University.countDocuments({ isActive: true }),
            totalUsers,
            totalCourses
        });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.get('/api/universities/public', async (req, res) => {
    try {
        const universities = await University.find({ isActive: true })
            .select('universityName universityCode primaryColor')
            .sort({ universityName: 1 });
        res.json(universities.map(u => ({
            universityName: u.universityName,
            universityCode: u.universityCode,
            logo: `/api/universities/${u._id}/logo`
        })));
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.get('/api/platform-stats', proAdminAuth, async (req, res) => {
    try {
        const { totalUsers, totalCourses } = await aggregatePlatformCounts();
        const stats = {
            totalUniversities: await University.countDocuments(),
            activeUniversities: await University.countDocuments({ isActive: true }),
            platformUsers: await PlatformUser.countDocuments(),
            totalUsers,
            totalCourses,
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
        const { User } = getUniModels(uniDb);
        
        const filter = {};
        if (req.query.role) filter.role = req.query.role;
        if (req.query.department) filter.department = req.query.department;

        const users = await User.find(filter).select('-password').populate('department', 'name code').sort({ role: 1, lastName: 1 });
        const seen = new Set();
        const unique = [];
        for (const u of users) {
            const key = u.email.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(u);
        }
        res.json(unique.map(formatUserResponse));
        
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
        const { User, Department } = getUniModels(uniDb);
        
        // Handle department - if it's a string, find or create the department
        if (req.body.department && typeof req.body.department === 'string') {
            if (/^[a-f\d]{24}$/i.test(req.body.department)) {
                // department ID passed directly
            } else {
                let department = await Department.findOne({
                    name: { $regex: new RegExp(req.body.department, 'i') }
                });

                if (!department) {
                    const departmentCode = req.body.department.toUpperCase().replace(/\s+/g, '').substring(0, 5);
                    department = new Department({
                        name: req.body.department,
                        code: departmentCode,
                        description: `${req.body.department} Department`,
                        faculty: 'General',
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
        }
        
        // For controller and dean roles, department is not required
        if (Array.isArray(req.body.roles) && req.body.roles.length) {
            req.body.roles = normalizeRoleList(req.body.roles.filter(r => UNIVERSITY_STAFF_ROLES.includes(r)));
            if (!req.body.roles.length) {
                return res.status(400).json({ message: 'At least one valid role is required' });
            }
            req.body.role = pickDefaultActiveRole(req.body.roles, req.body.role);
        } else if (req.body.role) {
            req.body.roles = [req.body.role];
        }

        const primaryRoles = req.body.roles || [req.body.role];
        if (primaryRoles.every(r => ['controller', 'dean'].includes(r))) {
            delete req.body.department;
        } else if (primaryRoles.some(r => ['controller', 'dean'].includes(r)) && !req.body.department) {
            delete req.body.department;
        }
        
        if (['controller', 'dean'].includes(req.body.role) && primaryRoles.length === 1) {
            delete req.body.department;
        }
        
        // Password: assign plain text — User pre-save hook hashes once
        if (!req.body.password) {
            return res.status(400).json({ message: 'Password is required' });
        }
        
        const user = new User(req.body);
        applyUniversityUserRoleDefaults(user, primaryRoles);
        await user.save();
        
        console.log(`✅ User created: ${user.email}`);
        
        res.status(201).json({ message: 'User created', user: formatUserResponse(user) });
        
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
        const { User, Department } = getUniModels(uniDb);

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (req.body.name) {
            const parts = req.body.name.trim().split(/\s+/);
            user.firstName = parts[0] || '';
            user.lastName = parts.slice(1).join(' ') || parts[0];
        }
        if (req.body.email) user.email = req.body.email.toLowerCase();

        if (req.body.department === '' || req.body.department === null) {
            user.department = undefined;
        } else if (req.body.department) {
            if (typeof req.body.department === 'string' && /^[a-f\d]{24}$/i.test(req.body.department)) {
                user.department = req.body.department;
            } else if (typeof req.body.department === 'string') {
                const department = await Department.findOne({
                    name: { $regex: new RegExp(`^${req.body.department}$`, 'i') }
                });
                user.department = department ? department._id : undefined;
            }
        }

        if (Array.isArray(req.body.roles) && req.body.roles.length) {
            const roles = normalizeRoleList(req.body.roles.filter(r => UNIVERSITY_STAFF_ROLES.includes(r)));
            if (!roles.length) return res.status(400).json({ message: 'At least one valid role is required' });
            user.roles = roles;
            user.role = pickDefaultActiveRole(roles, req.body.role);
            applyUniversityUserRoleDefaults(user, roles);
        } else if (req.body.role) {
            user.roles = [req.body.role];
            user.role = req.body.role;
            applyUniversityUserRoleDefaults(user, [req.body.role]);
        }

        if (req.body.password) {
            if (String(req.body.password).length < 6) {
                return res.status(400).json({ message: 'Password must be at least 6 characters' });
            }
            user.password = req.body.password;
        }

        if (req.body.designation) user.designation = req.body.designation;
        if (req.body.employeeId) user.employeeId = req.body.employeeId;
        if (req.body.studentId) user.studentId = req.body.studentId;

        await user.save();
        await user.populate('department', 'name code');
        res.json({ message: 'User updated', user: formatUserResponse(user) });
        
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: error.message || 'Error updating user', error: error.message });
    }
});

// Reset university user password (admin) — always stores a single bcrypt hash
app.post('/api/users/:id/reset-password', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });

        const { uniDb } = await getUniversityDatabase(token);
        const { User } = getUniModels(uniDb);
        const { password } = req.body;

        if (!password || String(password).length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.password = password;
        await user.save();

        res.json({ message: `Password updated for ${user.email}. They can log in with the new password immediately.` });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ message: error.message || 'Error resetting password', error: error.message });
    }
});

// Link university super admin to a staff profile (teacher/dean/chairman) for multi-role login
app.post('/api/users/me/staff-profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });

        const { uniDb, decoded } = await getUniversityDatabase(token);
        const { User, Department } = getUniModels(uniDb);
        const email = (decoded.email || req.headers['x-user-email'] || '').toLowerCase();
        if (!email) return res.status(400).json({ message: 'Email not found in session' });

        const platformUser = await PlatformUser.findOne({ email });
        const requestedRoles = normalizeRoleList((req.body.roles || ['teacher']).filter(r => UNIVERSITY_STAFF_ROLES.includes(r)));
        if (!requestedRoles.length) return res.status(400).json({ message: 'Select at least one staff role' });

        let user = await User.findOne({ email });
        if (!user) {
            const nameParts = (platformUser?.name || email.split('@')[0]).trim().split(/\s+/);
            user = new User({
                firstName: nameParts[0],
                lastName: nameParts.slice(1).join(' ') || nameParts[0],
                email,
                password: platformUser?.password || await bcrypt.hash('ChangeMe123!', 12),
                role: pickDefaultActiveRole(requestedRoles),
                roles: requestedRoles,
                isActive: true
            });
        } else {
            user.roles = normalizeRoleList([...(user.roles || [user.role]), ...requestedRoles]);
            user.role = pickDefaultActiveRole(user.roles);
        }

        if (req.body.departmentId) {
            user.department = req.body.departmentId;
        } else if (req.body.department) {
            const dept = await Department.findOne({ name: { $regex: new RegExp(`^${req.body.department}$`, 'i') } });
            if (dept) user.department = dept._id;
        }

        if (req.body.designation) user.designation = req.body.designation;
        applyUniversityUserRoleDefaults(user, user.roles);
        await user.save();
        await user.populate('department', 'name code');

        res.json({
            message: 'Staff profile linked. Log out and log in again to switch roles from the role picker.',
            user: formatUserResponse(user),
            hint: 'Use the role switcher in the header after re-login to act as Teacher, Dean, etc.'
        });
    } catch (error) {
        console.error('Staff profile link error:', error);
        res.status(500).json({ message: error.message || 'Error linking staff profile', error: error.message });
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
        const { User } = getUniModels(uniDb);
        
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
        const { Course, User, Department } = getUniModels(uniDb);
        const filter = { $or: [{ isActive: true }, { isActive: { $exists: false } }] };

        if (decoded.userType === 'university') {
            delete filter.$or;
            filter.isActive = true;
            if (decoded.role === 'teacher') {
                filter.instructor = decoded.userId;
            } else if (decoded.role === 'student') {
                filter['enrolledStudents.student'] = decoded.userId;
            }
        }

        const courses = await Course.find(filter)
            .select('title code description department instructor credits semester program isActive academicYear semesterName statistics')
            .sort({ code: 1 })
            .lean();

        const deptIds = [...new Set(courses.map(c => c.department).filter(Boolean))];
        const instIds = [...new Set(courses.map(c => c.instructor).filter(Boolean))];
        const [depts, instructors] = await Promise.all([
            deptIds.length
                ? Department.find({ _id: { $in: deptIds } }).select('name code').lean()
                : [],
            instIds.length
                ? User.find({ _id: { $in: instIds } }).select('firstName lastName email employeeId').lean()
                : []
        ]);
        const deptMap = new Map(depts.map(d => [String(d._id), d]));
        const instMap = new Map(instructors.map(u => [String(u._id), u]));

        res.json(courses.map(c => formatCourseListItem(c, deptMap, instMap)));
        
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ message: 'Failed to load courses', error: error.message });
    }
});

// OBE data collections (CLOs, PLOs, PEOs, programs, assessments, results)
async function getUniCollectionData(req, res, collectionName) {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb, decoded } = await getUniversityDatabase(token);
        const query = {};
        if (decoded.userType === 'university' && decoded.role === 'student') {
            query.student = new mongoose.Types.ObjectId(decoded.userId);
        }
        if (req.query.courseCode) query.courseCode = req.query.courseCode;
        const items = await uniDb.collection(collectionName).find(query).sort({ code: 1, createdAt: -1 }).toArray();
        res.json(items);
    } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
}

app.get('/api/plos', (req, res) => getUniCollectionData(req, res, 'plos'));
app.get('/api/peos', (req, res) => getUniCollectionData(req, res, 'peos'));
app.get('/api/programs', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { Department } = getUniModels(uniDb);

        const departments = await Department.find({ isActive: true });
        const deptByCode = new Map(departments.map(d => [d.code, d]));
        const deptById = new Map(departments.map(d => [String(d._id), d]));

        const raw = await uniDb.collection('programs').find({ isActive: { $ne: false } }).sort({ code: 1 }).toArray();

        const programs = raw.map(p => {
            const dept = p.departmentId
                ? deptById.get(String(p.departmentId))
                : (p.departmentCode ? deptByCode.get(p.departmentCode) : null);
            const batchList = Array.isArray(p.batches) ? p.batches : (p.batch ? [p.batch] : []);
            return {
                ...p,
                id: p._id,
                department: dept?.name || p.department || p.departmentName || 'N/A',
                departmentId: dept?._id || p.departmentId || null,
                departmentCode: dept?.code || p.departmentCode || null,
                batches: batchList.length,
                batchList,
                duration: p.duration || 4,
                creditHours: p.creditHours || p.credits || 130,
                level: p.level || 'Undergraduate',
                students: p.students || 0
            };
        });

        res.json(programs);
    } catch (error) {
        console.error('Error fetching programs:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.post('/api/programs', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { Department } = getUniModels(uniDb);

        const { code, name, level, duration, creditHours, department, departmentId, batches, description, coordinator } = req.body;
        if (!code || !name) return res.status(400).json({ message: 'Program code and name are required' });

        let dept = null;
        if (departmentId) dept = await Department.findById(departmentId);
        else if (department) dept = await Department.findOne({ name: { $regex: new RegExp(`^${department}$`, 'i') } });

        const batchList = Array.isArray(batches) ? batches : (batches ? String(batches).split(',').map(b => b.trim()) : ['2024', '2025']);

        const doc = {
            code: code.toUpperCase(),
            name,
            level: level || 'Undergraduate',
            duration: Number(duration) || 4,
            creditHours: Number(creditHours) || 130,
            credits: Number(creditHours) || 130,
            department: dept?.name || department || null,
            departmentId: dept?._id || null,
            departmentCode: dept?.code || null,
            batches: batchList,
            description: description || '',
            coordinator: coordinator || null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await uniDb.collection('programs').insertOne(doc);
        res.status(201).json({ message: 'Program created', program: { ...doc, id: result.insertedId, _id: result.insertedId } });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.put('/api/programs/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { Department } = getUniModels(uniDb);

        const updates = { ...req.body, updatedAt: new Date() };
        delete updates.id;
        delete updates._id;

        if (updates.departmentId) {
            const dept = await Department.findById(updates.departmentId);
            if (dept) {
                updates.department = dept.name;
                updates.departmentCode = dept.code;
            }
        } else if (updates.department && typeof updates.department === 'string') {
            const dept = await Department.findOne({ name: { $regex: new RegExp(`^${updates.department}$`, 'i') } });
            if (dept) {
                updates.departmentId = dept._id;
                updates.departmentCode = dept.code;
            }
        }

        if (updates.creditHours) updates.credits = Number(updates.creditHours);
        if (typeof updates.batches === 'string') {
            updates.batches = updates.batches.split(',').map(b => b.trim()).filter(Boolean);
        }

        const result = await uniDb.collection('programs').findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(req.params.id) },
            { $set: updates },
            { returnDocument: 'after' }
        );
        if (!result) return res.status(404).json({ message: 'Program not found' });
        res.json({ message: 'Program updated', program: result });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});
app.get('/api/assessments', (req, res) => getUniCollectionData(req, res, 'assessments'));
app.get('/api/results', (req, res) => getUniCollectionData(req, res, 'results'));

// Role-aware dashboard overview (real DB data for all role dashboards)
app.get('/api/dashboard/overview', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });

        const { uniDb, university, decoded } = await getUniversityDatabase(token);
        const { User, Department, Course } = getUniModels(uniDb);

        let uniUser = null;
        let deptFilter = null;
        let courseFilter = { isActive: true };

        if (decoded.userType === 'university') {
            uniUser = await User.findById(decoded.userId);
            if (decoded.role === 'teacher') {
                courseFilter.instructor = decoded.userId;
            } else if (decoded.role === 'student') {
                courseFilter['enrolledStudents.student'] = decoded.userId;
            } else if (['focal', 'chairman'].includes(decoded.role) && uniUser?.department) {
                deptFilter = uniUser.department;
            } else if (decoded.role === 'dean' && uniUser?.assignedFaculties?.length) {
                deptFilter = { $in: uniUser.assignedFaculties };
            }
        }

        const deptQuery = { isActive: true };
        if (deptFilter) {
            deptQuery._id = typeof deptFilter === 'object' && deptFilter.$in ? deptFilter : deptFilter;
        }

        const departments = await Department.find(deptQuery)
            .populate('chairman', 'firstName lastName email')
            .sort({ name: 1 });

        const deptIds = departments.map(d => d._id);
        const courses = await Course.find({
            ...courseFilter,
            ...(deptFilter && !courseFilter.instructor && !courseFilter['enrolledStudents.student']
                ? { department: typeof deptFilter === 'object' && deptFilter.$in ? deptFilter : deptFilter }
                : {})
        })
            .populate('department', 'name code faculty')
            .populate('instructor', 'firstName lastName email')
            .sort({ code: 1 });

        const courseIds = courses.map(c => c._id);
        const courseCodes = courses.map(c => c.code);

        const userQuery = { isActive: true };
        if (deptFilter) userQuery.department = deptFilter;
        const users = await User.find(userQuery).select('-password').populate('department', 'name code');

        const resultQuery = {};
        if (decoded.userType === 'university' && decoded.role === 'student') {
            resultQuery.student = new mongoose.Types.ObjectId(decoded.userId);
        } else if (courseCodes.length) {
            resultQuery.courseCode = { $in: courseCodes };
        }
        const results = await uniDb.collection('results').find(resultQuery).sort({ createdAt: -1 }).limit(200).toArray();

        const cloQuery = courseCodes.length ? { courseCode: { $in: courseCodes } } : {};
        const clos = await uniDb.collection('clos').find(cloQuery).toArray();
        const assessments = await uniDb.collection('assessments').find(
            courseCodes.length ? { courseCode: { $in: courseCodes } } : {}
        ).toArray();
        const plos = await uniDb.collection('plos').find(
            deptIds.length ? { department: { $in: deptIds } } : {}
        ).toArray();
        const programs = await uniDb.collection('programs').find(
            deptIds.length ? { department: { $in: deptIds } } : {}
        ).toArray();

        let students = users.filter(u => u.role === 'student');
        const teachers = users.filter(u => ['teacher', 'focal', 'chairman'].includes(u.role));

        if (decoded.userType === 'university' && decoded.role === 'teacher') {
            const enrolledIds = new Set();
            courses.forEach(c => {
                (c.enrolledStudents || []).forEach(e => {
                    if (e.student) enrolledIds.add(e.student.toString());
                });
            });
            students = students.filter(s => enrolledIds.has(s._id.toString()));
        }

        const deptSummaries = departments.map(d => {
            const deptStudents = students.filter(s => s.department?.toString() === d._id.toString());
            const deptTeachers = teachers.filter(t => t.department?.toString() === d._id.toString());
            const deptCourses = courses.filter(c => c.department?._id?.toString() === d._id.toString());
            const deptResults = results.filter(r => deptCourses.some(c => c.code === r.courseCode));
            const avgPct = deptResults.length
                ? Math.round(deptResults.reduce((s, r) => s + (r.percentage || 0), 0) / deptResults.length)
                : (d.statistics?.averageGrade || 0);
            return {
                id: d._id,
                name: d.name,
                code: d.code,
                faculty: d.faculty,
                chairman: d.chairman ? `${d.chairman.firstName} ${d.chairman.lastName}` : '—',
                totalStudents: deptStudents.length || d.statistics?.totalStudents || 0,
                totalTeachers: deptTeachers.length || d.statistics?.totalTeachers || 0,
                totalCourses: deptCourses.length || d.statistics?.totalCourses || 0,
                avgPassRate: d.statistics?.passRate || avgPct,
                avgGPA: (avgPct / 25).toFixed(1)
            };
        });

        const gradeCounts = {};
        results.forEach(r => {
            const g = r.grade || '—';
            gradeCounts[g] = (gradeCounts[g] || 0) + 1;
        });

        const recentActivity = results.slice(0, 15).map(r => ({
            activity: 'Result recorded',
            subject: r.courseTitle || r.courseCode,
            course: r.courseCode,
            user: r.studentName || 'Student',
            department: departments.find(d => courses.find(c => c.code === r.courseCode && c.department?._id?.equals(d._id)))?.name || '—',
            date: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
            status: 'Completed',
            marks: r.marksObtained,
            grade: r.grade
        }));

        const coursePerformance = courses.map(c => {
            const cResults = results.filter(r => r.courseCode === c.code);
            const avg = cResults.length
                ? Math.round(cResults.reduce((s, r) => s + (r.percentage || 0), 0) / cResults.length)
                : (c.statistics?.averageGrade || 0);
            return {
                code: c.code,
                title: c.title,
                name: c.title,
                avgMarks: avg,
                students: c.enrolledStudents?.length || c.statistics?.totalEnrolled || 0,
                instructorName: c.instructor ? `${c.instructor.firstName} ${c.instructor.lastName}` : '—'
            };
        });

        res.json({
            role: decoded.role,
            university: {
                name: university.universityName,
                code: university.universityCode,
                databaseName: university.databaseName
            },
            stats: {
                departments: departments.length,
                students: students.length,
                teachers: teachers.length,
                courses: courses.length,
                results: results.length,
                clos: clos.length,
                assessments: assessments.length,
                plos: plos.length
            },
            departments: deptSummaries,
            courses: courses.map(c => {
                const formatted = formatCourseResponse(c);
                const enrollment = c.enrolledStudents?.find(e =>
                    decoded.userType === 'university' && decoded.role === 'student' &&
                    e.student?.toString() === decoded.userId
                );
                return {
                    ...formatted,
                    students: c.enrolledStudents?.length || 0,
                    studentGrade: enrollment?.finalGrade,
                    studentPercentage: enrollment?.percentage,
                    instructorName: formatted.instructorName,
                    departmentName: c.department?.name
                };
            }),
            users: users.map(formatUserResponse),
            students: students.map(formatUserResponse),
            teachers: teachers.map(formatUserResponse),
            results: results.map(r => ({
                ...r,
                id: r._id,
                subject: r.courseTitle || r.courseCode,
                marks: r.marksObtained,
                uploaded: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'
            })),
            assessments,
            clos,
            plos,
            programs,
            recentActivity,
            charts: {
                departmentLabels: deptSummaries.map(d => d.name),
                departmentStudents: deptSummaries.map(d => d.totalStudents),
                departmentPassRates: deptSummaries.map(d => d.avgPassRate),
                gradeLabels: Object.keys(gradeCounts),
                gradeCounts: Object.values(gradeCounts),
                cloLabels: clos.map(c => c.code),
                cloAttainment: clos.map(c => Math.round(c.attainment || 0)),
                courseLabels: coursePerformance.map(c => c.code),
                courseAvgMarks: coursePerformance.map(c => c.avgMarks)
            }
        });
    } catch (error) {
        console.error('Dashboard overview error:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Faculties CRUD (proper Faculty collection)
app.get('/api/faculties', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });

        const { uniDb } = await getUniversityDatabase(token);
        const { User, Department, Faculty } = getUniModels(uniDb);

        let faculties = await Faculty.find({ isActive: true }).populate('dean', 'firstName lastName email').sort({ name: 1 });

        // Migrate legacy: if no Faculty docs, build from department.faculty strings
        if (!faculties.length) {
            const deptFacultyNames = [...new Set((await Department.find({ isActive: true })).map(d => d.faculty).filter(Boolean))];
            for (const name of deptFacultyNames) {
                await Faculty.create({
                    name,
                    code: facultyCodeFromName(name),
                    description: `${name} at the university`
                }).catch(() => {});
            }
            faculties = await Faculty.find({ isActive: true }).populate('dean', 'firstName lastName email').sort({ name: 1 });
        }

        const departments = await Department.find({ isActive: true });
        const result = faculties.map(f => {
            const depts = departments.filter(d =>
                (d.facultyRef && String(d.facultyRef) === String(f._id)) || d.faculty === f.name
            );
            const dean = f.dean;
            return {
                id: f._id,
                _id: f._id,
                name: f.name,
                code: f.code,
                description: f.description,
                deanId: dean?._id || null,
                deanName: dean ? `${dean.firstName} ${dean.lastName}`.trim() : null,
                deanEmail: dean?.email || null,
                departmentCount: depts.length,
                departments: depts.map(d => ({ id: d._id, name: d.name, code: d.code }))
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching faculties:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.post('/api/faculties', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { User, Faculty } = getUniModels(uniDb);

        const { name, code, description, deanId, createDean, deanName, deanEmail, deanPassword, deanDepartment } = req.body;
        if (!name) return res.status(400).json({ message: 'Faculty name is required' });

        let deanUserId = deanId || null;
        let deanCreated = null;

        if (createDean && deanEmail && deanPassword) {
            const parts = String(deanName || 'Dean User').trim().split(/\s+/);
            const hashed = await bcrypt.hash(deanPassword, 12);
            const dean = await User.create({
                firstName: parts[0],
                lastName: parts.slice(1).join(' ') || parts[0],
                email: deanEmail.toLowerCase(),
                password: hashed,
                role: 'dean',
                roles: ['dean', 'teacher'],
                phone: '3000000000',
                designation: 'Dean',
                qualification: 'PhD',
                employeeId: `DEAN${Date.now()}`.slice(-8)
            });
            deanUserId = dean._id;
            deanCreated = { email: dean.email, password: deanPassword, name: deanName };
        }

        const faculty = await Faculty.create({
            name: name.trim(),
            code: (code || facultyCodeFromName(name)).toUpperCase(),
            description: description || '',
            dean: deanUserId || undefined
        });

        if (deanUserId) {
            await User.findByIdAndUpdate(deanUserId, { $addToSet: { assignedFaculties: faculty._id } }).catch(() => {});
        }

        res.status(201).json({
            message: 'Faculty created',
            faculty,
            deanCreated,
            deanName: deanCreated?.name,
            deanEmail: deanCreated?.email,
            deanPassword: deanCreated?.password
        });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.put('/api/faculties/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { User, Department, Faculty } = getUniModels(uniDb);

        const updates = {};
        if (req.body.name) updates.name = req.body.name.trim();
        if (req.body.code) updates.code = req.body.code.toUpperCase();
        if (req.body.description !== undefined) updates.description = req.body.description;
        if (req.body.deanId) updates.dean = req.body.deanId;

        const faculty = await Faculty.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
            .populate('dean', 'firstName lastName email');
        if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

        if (updates.name) {
            await Department.updateMany({ facultyRef: faculty._id }, { $set: { faculty: faculty.name } });
            await Department.updateMany({ faculty: req.body.oldName }, { $set: { faculty: faculty.name, facultyRef: faculty._id } });
        }

        res.json({ message: 'Faculty updated', faculty });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.delete('/api/faculties/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { Department, Faculty } = getUniModels(uniDb);

        const faculty = await Faculty.findById(req.params.id);
        if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

        await Faculty.findByIdAndUpdate(faculty._id, { isActive: false });
        await Department.updateMany({ facultyRef: faculty._id }, { $unset: { facultyRef: '' } });
        res.json({ message: `Faculty "${faculty.name}" deactivated` });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

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
            if (university.logo && university.logo.data) {
                uniObj.logoUrl = '/api/my-university/logo';
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
                    if (university.logo && university.logo.data) {
                        uniObj.logoUrl = '/api/my-university/logo';
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
        const { Department } = getUniModels(uniDb);
        
        const departments = await Department.find({ isActive: true })
            .select('name code description faculty statistics contactInfo programs')
            .populate('chairman', 'firstName lastName email')
            .sort({ name: 1 });
        
        res.json(departments.map(d => {
            const obj = d.toObject();
            const chairman = obj.chairman;
            return {
                ...obj,
                id: obj._id,
                facultyName: obj.faculty,
                head: chairman ? `${chairman.firstName} ${chairman.lastName}`.trim() : null,
                headName: chairman ? `${chairman.firstName} ${chairman.lastName}`.trim() : null,
                chairmanId: chairman?._id || null
            };
        }));
        
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Change university super admin password (for Pro Admin)
app.post('/api/universities/:id/change-admin-password', proAdminAuth, async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }
        
        const university = await University.findById(req.params.id);
        if (!university) {
            return res.status(404).json({ message: 'University not found' });
        }
        
        const universityAdmin = await PlatformUser.findOne({
            university: university._id,
            role: 'university_superadmin'
        }) || await PlatformUser.findOne({
            email: university.superAdminEmail.toLowerCase(),
            role: 'university_superadmin'
        });
        
        if (!universityAdmin) {
            return res.status(404).json({ message: 'University super admin not found' });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        universityAdmin.password = hashedPassword;
        universityAdmin.email = university.superAdminEmail;
        universityAdmin.university = university._id;
        universityAdmin.universityCode = university.universityCode;
        universityAdmin.isActive = true;
        await universityAdmin.save();
        
        console.log(`✅ Password changed for university admin: ${universityAdmin.email}`);
        
        res.json({ 
            message: 'Password changed successfully',
            adminEmail: universityAdmin.email,
            newPassword: newPassword
        });
        
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

const UNI_COLLECTIONS = ['clos', 'plos', 'peos', 'programs', 'assessments', 'results', 'enrollments', 'university_settings'];

async function ensureUniCollections(uniDb) {
    const existing = (await uniDb.db.listCollections().toArray()).map(c => c.name);
    for (const name of UNI_COLLECTIONS) {
        if (!existing.includes(name)) {
            await uniDb.createCollection(name).catch(() => {});
        }
    }
}

// Run migrations (ensure OBE collections exist)
app.post('/api/run-migrations', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        await ensureUniCollections(uniDb);
        res.json({ message: 'Migrations completed successfully', collections: UNI_COLLECTIONS });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// University settings
app.get('/api/university-settings', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb, university } = await getUniversityDatabase(token);
        const settings = await uniDb.collection('university_settings').findOne({ universityCode: university.universityCode })
            || { universityCode: university.universityCode, academicYear: '2024-25', gradingScale: 'percentage' };
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.put('/api/university-settings', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb, university } = await getUniversityDatabase(token);
        await uniDb.collection('university_settings').updateOne(
            { universityCode: university.universityCode },
            { $set: { ...req.body, universityCode: university.universityCode, updatedAt: new Date() } },
            { upsert: true }
        );
        res.json({ message: 'Settings saved' });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Database debug info
app.get('/api/debug/database-info', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb, university } = await getUniversityDatabase(token);
        const cols = await uniDb.db.listCollections().toArray();
        const collections = {};
        for (const c of cols) {
            collections[c.name] = await uniDb.collection(c.name).countDocuments();
        }
        res.json({
            databaseName: university.databaseName,
            universityCode: university.universityCode,
            collections,
            totalDocuments: Object.values(collections).reduce((a, b) => a + b, 0)
        });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Departments CRUD
async function resolveDepartmentFaculty(uniDb, body) {
    const { Faculty } = getUniModels(uniDb);
    const facultyId = body.facultyId || body.facultyRef;
    if (facultyId) {
        const fac = await Faculty.findById(facultyId);
        if (fac) return { faculty: fac.name, facultyRef: fac._id };
    }
    if (body.faculty) {
        const fac = await Faculty.findOne({ name: body.faculty });
        if (fac) return { faculty: fac.name, facultyRef: fac._id };
        return { faculty: body.faculty, facultyRef: null };
    }
    return { faculty: 'General', facultyRef: null };
}

app.post('/api/departments', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { Department, User } = getUniModels(uniDb);

        const { name, code, description, chairmanId, contactInfo } = req.body;
        const facFields = await resolveDepartmentFaculty(uniDb, req.body);

        const payload = {
            name,
            code: String(code).toUpperCase(),
            description: description || `${name} department`,
            ...facFields,
            contactInfo: contactInfo || {
                email: `${String(code).toLowerCase()}@quest.edu.pk`,
                phone: '2449370367'
            },
            isActive: true
        };

        if (chairmanId) payload.chairman = chairmanId;

        const dept = await Department.create(payload);

        if (chairmanId) {
            await User.findByIdAndUpdate(chairmanId, {
                $addToSet: { roles: 'chairman', managedDepartments: dept._id },
                role: 'chairman'
            }).catch(() => {});
        }

        res.status(201).json({ message: 'Department created', department: dept });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.put('/api/departments/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { Department, User } = getUniModels(uniDb);

        const updates = { ...req.body };
        delete updates.head;
        delete updates.headName;
        delete updates.facultyName;

        if (updates.facultyId || updates.facultyRef || updates.faculty) {
            Object.assign(updates, await resolveDepartmentFaculty(uniDb, updates));
            delete updates.facultyId;
        }

        if (updates.chairmanId !== undefined) {
            updates.chairman = updates.chairmanId || null;
            delete updates.chairmanId;
            if (updates.chairman) {
                await User.findByIdAndUpdate(updates.chairman, {
                    $addToSet: { roles: 'chairman', managedDepartments: req.params.id }
                }).catch(() => {});
            }
        }

        const dept = await Department.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
            .populate('chairman', 'firstName lastName email');
        if (!dept) return res.status(404).json({ message: 'Department not found' });

        const obj = dept.toObject();
        res.json({
            message: 'Department updated',
            department: {
                ...obj,
                id: obj._id,
                facultyName: obj.faculty,
                head: obj.chairman ? `${obj.chairman.firstName} ${obj.chairman.lastName}`.trim() : null,
                headName: obj.chairman ? `${obj.chairman.firstName} ${obj.chairman.lastName}`.trim() : null
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.delete('/api/departments/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { Department } = getUniModels(uniDb);
        const dept = await Department.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!dept) return res.status(404).json({ message: 'Department not found' });
        res.json({ message: 'Department deactivated' });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Courses update/delete
app.put('/api/courses/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { Course, Department } = getUniModels(uniDb);
        const updates = { ...req.body };
        if (updates.name) {
            updates.title = updates.name;
            delete updates.name;
        }
        if (updates.creditHours) {
            updates.credits = Number(updates.creditHours);
            delete updates.creditHours;
        }
        if (updates.department && typeof updates.department === 'string') {
            const dept = await Department.findOne({ name: { $regex: new RegExp(`^${updates.department}$`, 'i') } });
            if (dept) updates.department = dept._id;
            else delete updates.department;
        }
        const course = await Course.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json({ message: 'Course updated', course: formatCourseResponse(course) });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.delete('/api/courses/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { Course } = getUniModels(uniDb);
        const course = await Course.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json({ message: 'Course deactivated' });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Programs delete
app.delete('/api/programs/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const result = await uniDb.collection('programs').deleteOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Program not found' });
        res.json({ message: 'Program deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Bulk import endpoints
async function handleBulkImport(req, res, type) {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const records = req.body.records || req.body.data || req.body;
        const items = Array.isArray(records) ? records : [];
        let imported = 0;

        if (type === 'users') {
            const { User, Department } = getUniModels(uniDb);
            for (const row of items) {
                try {
                    const parts = (row.name || row.Name || 'New User').trim().split(/\s+/);
                    const payload = {
                        firstName: parts[0],
                        lastName: parts.slice(1).join(' ') || parts[0],
                        email: (row.email || row.Email).toLowerCase(),
                        password: await bcrypt.hash(row.password || 'Demo@2025', 12),
                        role: (row.role || row.Role || 'student').toLowerCase(),
                        phone: row.phone || '923000000000',
                        isActive: true
                    };
                    if (payload.role === 'student') {
                        payload.studentId = row.studentId || `STU${Date.now()}${imported}`;
                        payload.semester = Number(row.semester) || 1;
                        payload.batch = row.batch || '2024';
                    }
                    if (['teacher', 'focal', 'chairman'].includes(payload.role)) {
                        payload.employeeId = row.employeeId || `EMP${Date.now()}${imported}`;
                        payload.designation = row.designation || 'Faculty';
                        payload.qualification = row.qualification || 'MSc';
                    }
                    if (row.department) {
                        const dept = await Department.findOne({ name: { $regex: new RegExp(row.department, 'i') } });
                        if (dept) payload.department = dept._id;
                    }
                    await User.create(payload);
                    imported++;
                } catch (e) { /* skip duplicate/invalid rows */ }
            }
        } else if (type === 'courses') {
            const { Course, Department, User } = getUniModels(uniDb);
            const teacher = await User.findOne({ role: 'teacher', isActive: true });
            for (const row of items) {
                try {
                    const dept = await Department.findOne({ name: { $regex: new RegExp(row.department || 'Computer', 'i') } });
                    if (!dept || !teacher) continue;
                    await Course.create({
                        title: row.name || row.title || row.Name,
                        code: (row.code || row.Code).toUpperCase(),
                        department: dept._id,
                        program: row.program || 'BS',
                        semester: Number(row.semester) || 1,
                        credits: Number(row.creditHours || row.credits) || 3,
                        hours: { theory: 3, practical: 0, total: 3 },
                        instructor: teacher._id,
                        isActive: true
                    });
                    imported++;
                } catch (e) { /* skip */ }
            }
        } else {
            const col = type === 'programs' ? 'programs' : type;
            if (items.length) {
                await uniDb.collection(col).insertMany(items.map(r => ({ ...r, createdAt: new Date(), isActive: true })));
                imported = items.length;
            }
        }

        res.json({ message: `Imported ${imported} ${type}`, imported, total: items.length });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
}

app.post('/api/users/bulk', (req, res) => handleBulkImport(req, res, 'users'));
app.post('/api/courses/bulk', (req, res) => handleBulkImport(req, res, 'courses'));
app.post('/api/departments/bulk', (req, res) => handleBulkImport(req, res, 'departments'));
app.post('/api/faculties/bulk', (req, res) => handleBulkImport(req, res, 'faculties'));
app.post('/api/programs/bulk', (req, res) => handleBulkImport(req, res, 'programs'));

function gradeFromPercentage(pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 85) return 'A';
    if (pct >= 80) return 'A-';
    if (pct >= 75) return 'B+';
    if (pct >= 70) return 'B';
    if (pct >= 65) return 'B-';
    if (pct >= 60) return 'C+';
    if (pct >= 55) return 'C';
    if (pct >= 50) return 'C-';
    return 'F';
}

// Create course in university database
app.post('/api/courses', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { User, Department, Course } = getUniModels(uniDb);

        const body = { ...req.body };
        if (body.name) body.title = body.name;
        if (body.creditHours) body.credits = Number(body.creditHours);

        if (body.department && typeof body.department === 'string') {
            let dept = await Department.findOne({ name: { $regex: new RegExp(body.department, 'i') } });
            if (!dept) {
                dept = await Department.findOne({ code: body.department.toUpperCase() });
            }
            body.department = dept?._id;
        }

        if (body.instructor && typeof body.instructor === 'string') {
            const teacher = await User.findOne({
                $or: [
                    { email: body.instructor.toLowerCase() },
                    { employeeId: body.instructor }
                ],
                role: 'teacher'
            });
            body.instructor = teacher?._id;
        }
        if (!body.instructor) {
            const teacher = await User.findOne({ role: 'teacher', isActive: true });
            body.instructor = teacher?._id;
        }

        body.code = (body.code || '').toUpperCase();
        body.program = body.program || 'BS';
        body.semester = Number(body.semester) || 1;
        body.credits = body.credits || 3;
        body.hours = body.hours || { theory: body.credits, practical: 0, total: body.credits };
        body.isActive = true;
        body.enrolledStudents = body.enrolledStudents || [];
        body.assessments = body.assessments || [];
        body.learningOutcomes = body.learningOutcomes || [];

        const course = await Course.create(body);
        res.status(201).json({ message: 'Course created', course: formatCourseResponse(course) });
    } catch (error) {
        console.error('Error creating course:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Course enrollments for templates / bulk upload
app.get('/api/courses/:code/enrollments', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { User, Course } = getUniModels(uniDb);

        const course = await Course.findOne({ code: req.params.code.toUpperCase(), isActive: true });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const studentIds = (course.enrolledStudents || []).map(e => e.student).filter(Boolean);
        const students = studentIds.length
            ? await User.find({ _id: { $in: studentIds }, role: 'student' }).select('-password')
            : [];

        res.json(students.map(s => ({
            ...formatUserResponse(s),
            id: s.studentId || s._id,
            studentId: s.studentId
        })));
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// CLOs filtered by course
app.get('/api/clos', async (req, res) => {
    if (req.query.courseCode) {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ message: 'No token' });
            const { uniDb } = await getUniversityDatabase(token);
            const clos = await uniDb.collection('clos').find({
                courseCode: req.query.courseCode.toUpperCase()
            }).sort({ code: 1 }).toArray();
            return res.json(clos.map((c, i) => ({ ...c, id: c._id, title: c.description })));
        } catch (error) {
            return res.status(500).json({ message: 'Error', error: error.message });
        }
    }
    return getUniCollectionData(req, res, 'clos');
});

app.post('/api/clos', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { courseCode, code, title, description, bloomLevel, assessmentMethod } = req.body;
        if (!courseCode || !code) {
            return res.status(400).json({ message: 'courseCode and code required' });
        }
        const doc = {
            courseCode: String(courseCode).toUpperCase(),
            code: String(code).toUpperCase(),
            title: title || description || code,
            description: description || title || '',
            bloomLevel: bloomLevel || 'Apply',
            assessmentMethod: assessmentMethod || 'Assignment',
            attainment: 0,
            isActive: true,
            createdAt: new Date()
        };
        const result = await uniDb.collection('clos').insertOne(doc);
        res.status(201).json({ message: 'CLO created', clo: { ...doc, _id: result.insertedId, id: result.insertedId } });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Assessments CRUD
app.post('/api/assessments', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { Course } = getUniModels(uniDb);

        const { courseCode, assessmentType, assessmentName, questions, totalMarks } = req.body;
        const course = await Course.findOne({ code: (courseCode || '').toUpperCase(), isActive: true });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const tMarks = totalMarks || (questions || []).reduce((s, q) => s + (q.maxMarks || 0), 0);
        const doc = {
            title: `${assessmentName || assessmentType} — ${course.code}`,
            name: assessmentName || assessmentType,
            course: course._id,
            courseCode: course.code,
            type: assessmentType,
            assessmentType,
            questions: questions || [],
            totalMarks: tMarks,
            maxMarks: tMarks,
            weightage: req.body.weight || 10,
            weight: req.body.weight || 10,
            dueDate: new Date(),
            isActive: true,
            createdAt: new Date()
        };

        const result = await uniDb.collection('assessments').insertOne(doc);
        await Course.findByIdAndUpdate(course._id, {
            $push: {
                assessments: {
                    name: doc.name,
                    type: assessmentType,
                    weight: doc.weight,
                    dueDate: doc.dueDate,
                    maxMarks: tMarks,
                    isActive: true
                }
            }
        });

        res.status(201).json({
            message: 'Assessment created',
            assessment: { ...doc, _id: result.insertedId, id: result.insertedId }
        });
    } catch (error) {
        console.error('Error creating assessment:', error);
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.put('/api/assessments/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);

        const updates = { ...req.body, updatedAt: new Date() };
        if (updates.totalMarks == null && updates.questions) {
            updates.totalMarks = updates.questions.reduce((s, q) => s + (q.maxMarks || 0), 0);
            updates.maxMarks = updates.totalMarks;
        }

        const result = await uniDb.collection('assessments').findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(req.params.id) },
            { $set: updates },
            { returnDocument: 'after' }
        );
        if (!result) return res.status(404).json({ message: 'Assessment not found' });
        res.json({ message: 'Assessment updated', assessment: { ...result, id: result._id } });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

app.delete('/api/assessments/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);

        const result = await uniDb.collection('assessments').deleteOne({
            _id: new mongoose.Types.ObjectId(req.params.id)
        });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Assessment not found' });
        res.json({ message: 'Assessment deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Import student results (individual or bulk CSV)
app.post('/api/results/import', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token' });
        const { uniDb } = await getUniversityDatabase(token);
        const { User, Course } = getUniModels(uniDb);

        const { courseCode, records } = req.body;
        if (!courseCode || !Array.isArray(records) || !records.length) {
            return res.status(400).json({ message: 'courseCode and records required' });
        }

        const course = await Course.findOne({ code: courseCode.toUpperCase(), isActive: true });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const inserted = [];
        for (const rec of records) {
            const student = await User.findOne({
                role: 'student',
                $or: [
                    { studentId: rec.studentId },
                    { email: String(rec.studentId).toLowerCase() }
                ]
            });
            if (!student) continue;

            const maxMarks = rec.maxMarks || 100;
            const obtained = rec.marksObtained ?? rec.marks ?? 0;
            const pct = maxMarks ? Math.round((obtained / maxMarks) * 100) : 0;

            const doc = {
                student: student._id,
                studentId: student.studentId,
                studentName: `${student.firstName} ${student.lastName}`,
                course: course._id,
                courseCode: course.code,
                courseTitle: course.title,
                assessmentName: rec.assessmentName || rec.assessment || 'Assessment',
                marksObtained: obtained,
                maxMarks,
                percentage: pct,
                grade: gradeFromPercentage(pct),
                semester: rec.semester || course.semesterName || 'Fall',
                academicYear: course.academicYear || '2024-25',
                createdAt: new Date()
            };
            await uniDb.collection('results').insertOne(doc);
            inserted.push(doc);

            const enIdx = (course.enrolledStudents || []).findIndex(e =>
                e.student && e.student.toString() === student._id.toString()
            );
            if (enIdx >= 0) {
                course.enrolledStudents[enIdx].totalMarks = (course.enrolledStudents[enIdx].totalMarks || 0) + obtained;
                course.enrolledStudents[enIdx].percentage = Math.min(100, course.enrolledStudents[enIdx].totalMarks);
                course.enrolledStudents[enIdx].finalGrade = gradeFromPercentage(course.enrolledStudents[enIdx].percentage);
                course.enrolledStudents[enIdx].status = course.enrolledStudents[enIdx].percentage >= 50 ? 'completed' : 'failed';
            }
        }

        if (inserted.length) await course.save();

        res.json({
            message: `Imported ${inserted.length} result record(s)`,
            imported: inserted.length,
            skipped: records.length - inserted.length
        });
    } catch (error) {
        console.error('Error importing results:', error);
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

// Multer / upload errors
app.use((err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Logo file too large (max 5MB)' });
    }
    if (err && err.message === 'Only images allowed') {
        return res.status(400).json({ message: 'Only PNG, JPG, or SVG images are allowed for logos' });
    }
    if (err) {
        console.error('Unhandled error:', err);
        return res.status(500).json({ message: err.message || 'Server error' });
    }
    next();
});

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
