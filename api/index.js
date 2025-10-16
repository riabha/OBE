const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const cors = require('cors');
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Database Configuration
const dbConfig = {
    host: process.env.DB_HOST || 'mysql.gb.stackcp.com',
    port: process.env.DB_PORT || 40063,
    user: process.env.DB_USER || 'obe',
    password: process.env.DB_PASSWORD || 'quest-db',
    database: process.env.DB_NAME || 'vercel_db-31383355e3',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: false
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Fallback users for demo mode
const fallbackUsers = [
    {
        id: 0,
        email: 'admin@quest.edu.pk',
        password: 'admin123',
        role: 'superadmin',
        name: 'System Administrator',
        employeeId: 'ADMIN-001',
        department: 'Administration',
        permissions: ['all']
    },
    {
        id: 1,
        email: 'student@quest.edu.pk',
        password: 'pass',
        role: 'student',
        name: 'Ahmad Ali',
        studentId: 'QUEST-2024-001',
        department: 'Computer Science',
        semester: '7th',
        batch: '2021'
    },
    {
        id: 2,
        email: 'teacher@quest.edu.pk',
        password: 'pass',
        role: 'teacher',
        name: 'Dr. Muhammad Hassan',
        employeeId: 'EMP-001',
        department: 'Computer Science',
        designation: 'Assistant Professor',
        subjects: ['Data Structures', 'Algorithms']
    },
    {
        id: 3,
        email: 'focal@quest.edu.pk',
        password: 'pass',
        role: 'focal',
        name: 'Dr. Fatima Sheikh',
        employeeId: 'EMP-003',
        department: 'Computer Science',
        designation: 'Assistant Professor'
    },
    {
        id: 4,
        email: 'chairman@quest.edu.pk',
        password: 'pass',
        role: 'chairman',
        name: 'Prof. Dr. Ali Raza',
        employeeId: 'EMP-005',
        department: 'Computer Science',
        designation: 'Professor & Chairman'
    },
    {
        id: 5,
        email: 'dean@quest.edu.pk',
        password: 'pass',
        role: 'dean',
        name: 'Prof. Dr. Zulfiqar Ali',
        employeeId: 'EMP-007',
        department: 'Engineering',
        designation: 'Dean of Engineering'
    },
    {
        id: 6,
        email: 'controller@quest.edu.pk',
        password: 'pass',
        role: 'controller',
        name: 'Dr. Khalid Mahmood',
        employeeId: 'EMP-008',
        department: 'Examination',
        designation: 'Controller of Examinations'
    }
];

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        let user = null;
        
        // Try database authentication first
        try {
            const [users] = await pool.execute(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );
            
            if (users.length > 0) {
                const dbUser = users[0];
                const isPasswordValid = await bcrypt.compare(password, dbUser.password);
                
                if (isPasswordValid) {
                    delete dbUser.password;
                    user = dbUser;
                }
            }
        } catch (dbError) {
            console.log('Database authentication failed, using fallback:', dbError.message);
        }
        
        // Fallback to local authentication if database fails
        if (!user) {
            const fallbackUser = fallbackUsers.find(u => u.email === email && u.password === password);
            if (fallbackUser) {
                const { password: _, ...userWithoutPassword } = fallbackUser;
                user = userWithoutPassword;
            }
        }
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'quest_secret_key',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: user
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, email, role, name, employeeId, studentId, department, semester, batch, designation, subjects, permissions, createdAt FROM users'
        );
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get all courses
app.get('/api/courses', async (req, res) => {
    try {
        const [courses] = await pool.execute('SELECT * FROM courses');
        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Get all CLOs
app.get('/api/clos', async (req, res) => {
    try {
        const [clos] = await pool.execute(`
            SELECT c.*, co.name as courseName, co.code as courseCode 
            FROM clos c 
            LEFT JOIN courses co ON c.courseId = co.id
        `);
        res.json(clos);
    } catch (error) {
        console.error('Error fetching CLOs:', error);
        res.status(500).json({ error: 'Failed to fetch CLOs' });
    }
});

// Get all assessments
app.get('/api/assessments', async (req, res) => {
    try {
        const [assessments] = await pool.execute(`
            SELECT a.*, c.name as courseName, c.code as courseCode, u.name as createdByName
            FROM assessments a 
            LEFT JOIN courses c ON a.courseId = c.id
            LEFT JOIN users u ON a.createdBy = u.id
        `);
        res.json(assessments);
    } catch (error) {
        console.error('Error fetching assessments:', error);
        res.status(500).json({ error: 'Failed to fetch assessments' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'QUEST OBE Portal API is running' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API is working!', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Database connection test endpoint
app.get('/api/db-test', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        
        // Try to query users table
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
        
        connection.release();
        
        res.json({ 
            status: 'success',
            message: 'Database connection successful',
            database: {
                host: dbConfig.host,
                port: dbConfig.port,
                database: dbConfig.database,
                userCount: users[0].count
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Database connection failed',
            error: error.message,
            config: {
                host: dbConfig.host,
                port: dbConfig.port,
                database: dbConfig.database,
                user: dbConfig.user
            },
            fallbackMode: 'Using fallback authentication',
            timestamp: new Date().toISOString()
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Export the Express app for Vercel
module.exports = app;
