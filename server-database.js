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

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

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

// Login endpoint - DATABASE MODE
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log(`🔐 Login attempt: ${email}`);
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        
        // Find user in database
        const user = await PlatformUser.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            console.log(`❌ User not found: ${email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Check if user is active
        if (!user.isActive) {
            console.log(`❌ User inactive: ${email}`);
            return res.status(401).json({ message: 'Account is inactive' });
        }
        
        // Compare password
        const isPasswordValid = await user.comparePassword(password);
        
        if (!isPasswordValid) {
            console.log(`❌ Invalid password for: ${email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        console.log(`✅ Login successful: ${email} (${user.role})`);
        
        // Create JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email, 
                role: user.role,
                permissions: user.permissions
            },
            process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024_very_secure_random_string',
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );
        
        // Remove password from response
        const userResponse = {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: user.permissions,
            isActive: user.isActive,
            lastLogin: user.lastLogin
        };
        
        return res.json({
            message: 'Login successful',
            token,
            user: userResponse
        });
        
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

// Get platform statistics
app.get('/api/platform-stats', async (req, res) => {
    try {
        const totalPlatformUsers = await PlatformUser.countDocuments();
        
        res.json({
            totalUniversities: 0,
            totalUsers: 0,
            totalCourses: 0,
            totalDepartments: 0,
            totalStudents: 0,
            totalTeachers: 0,
            platformUsers: totalPlatformUsers
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

