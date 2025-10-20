const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Production environment detection
const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     🎓 QUEST OBE Portal - DEMO MODE                    ║');
console.log('║     📝 No Database Required - Local Demo Only          ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// CORS configuration
app.use(cors({
    origin: '*',
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
// DEMO PRO SUPER ADMIN ACCOUNT (LOCAL ONLY)
// ============================================
const DEMO_PRO_ADMIN = {
    id: 'demo-pro-admin-001',
    email: 'pro@obe.org.pk',
    password: 'proadmin123',
    name: 'OBE Portal Administrator',
    role: 'pro_superadmin',
    permissions: ['all'],
    isActive: true
};

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

// Login endpoint - DEMO MODE (No Database)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log(`🔐 Login attempt: ${email}`);
        
        // Check against demo Pro Super Admin
        if (email === DEMO_PRO_ADMIN.email && password === DEMO_PRO_ADMIN.password) {
            console.log(`✅ Pro Super Admin login successful (DEMO MODE)`);
            
            const { password: _, ...userWithoutPassword } = DEMO_PRO_ADMIN;
            
            const token = jwt.sign(
                { 
                    userId: userWithoutPassword.id, 
                    email: userWithoutPassword.email, 
                    role: userWithoutPassword.role,
                    mode: 'demo'
                },
                process.env.JWT_SECRET || 'demo_secret_key',
                { expiresIn: '24h' }
            );

            return res.json({
                message: 'Login successful',
                token,
                user: userWithoutPassword,
                mode: 'demo'
            });
        }
        
        // Invalid credentials
        console.log(`❌ Invalid login attempt: ${email}`);
        return res.status(401).json({ 
            message: 'Invalid credentials',
            hint: 'Use: pro@obe.org.pk / proadmin123'
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Check authentication status
app.get('/api/auth/check', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ authenticated: false });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo_secret_key');
        res.json({ 
            authenticated: true,
            user: {
                id: decoded.userId,
                email: decoded.email,
                role: decoded.role
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
// DEMO DATA APIs (No Database Required)
// ============================================

// Get universities list (demo data)
app.get('/api/universities', (req, res) => {
    res.json([]);
});

// Get public universities (demo data)
app.get('/api/universities/public', (req, res) => {
    res.json([]);
});

// Get platform statistics (demo data)
app.get('/api/platform-stats', (req, res) => {
    res.json({
        totalUniversities: 0,
        totalUsers: 1,
        totalCourses: 0,
        totalDepartments: 0,
        totalStudents: 0,
        totalTeachers: 0,
        platformUsers: 1
    });
});

// Get users (demo data)
app.get('/api/users', (req, res) => {
    res.json([DEMO_PRO_ADMIN]);
});

// Get courses (demo data)
app.get('/api/courses', (req, res) => {
    res.json([]);
});

// Get departments (demo data)
app.get('/api/departments', (req, res) => {
    res.json([]);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'QUEST OBE Portal - DEMO MODE',
        mode: 'demo',
        database: 'none',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API is working - DEMO MODE', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        mode: 'demo'
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

function startServer() {
    try {
        console.log('🚀 Starting OBE Portal - DEMO MODE...');
        console.log(`📊 Database: None (Demo Mode)`);
        console.log(`🏛️  Architecture: Standalone Demo\n`);
        
        app.listen(PORT, () => {
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log(`║  🌐 Server Running: ${baseUrl.padEnd(38)} ║`);
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            
            console.log('🔗 Access Points:');
            console.log(`   📱 Homepage: ${baseUrl}`);
            console.log(`   🔐 Login: ${baseUrl}/login.html`);
            console.log(`   🏥 Health: ${baseUrl}/api/health\n`);
            
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║  🔐 DEMO PRO SUPER ADMIN CREDENTIALS                    ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            console.log('║  📧 Email:    pro@obe.org.pk                            ║');
            console.log('║  🔑 Password: proadmin123                               ║');
            console.log('║  👑 Role:     Pro Super Admin                           ║');
            console.log('║  💾 Storage:  Local/Hardcoded (No Database)             ║');
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            
            console.log('✨ Website is ready! Open the login URL above.\n');
            console.log('💡 Note: This is DEMO mode - no database required');
            console.log('💡 Only Pro Super Admin login works in demo mode\n');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 Server shutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer();
