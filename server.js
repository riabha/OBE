const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const dbManager = require('./utils/database-manager');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Production environment detection
const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// CORS configuration for all environments
const cors = require('cors');
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Include routes
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);

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

// Platform Database Configuration (for metadata only)
const platformDbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'quest_obe', // Platform DB
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: false
};

// Initialize platform database connection
const pool = dbManager.initPlatformDatabase(platformDbConfig);

// Database initialization with CQI tables and multi-university support
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // Create universities table for multi-tenancy (PLATFORM DB - Metadata Only)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS universities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                universityName VARCHAR(255) UNIQUE NOT NULL,
                universityCode VARCHAR(50) UNIQUE NOT NULL,
                databaseName VARCHAR(100) UNIQUE NOT NULL,
                logo VARCHAR(500),
                primaryColor VARCHAR(20) DEFAULT '#2563eb',
                secondaryColor VARCHAR(20) DEFAULT '#7c3aed',
                address TEXT,
                city VARCHAR(100),
                country VARCHAR(100) DEFAULT 'Pakistan',
                contactEmail VARCHAR(255),
                contactPhone VARCHAR(50),
                website VARCHAR(255),
                superAdminEmail VARCHAR(255),
                subscriptionPlan VARCHAR(50) DEFAULT 'Basic',
                subscriptionStatus VARCHAR(50) DEFAULT 'Active',
                maxUsers INT DEFAULT 1000,
                maxCourses INT DEFAULT 100,
                isActive BOOLEAN DEFAULT TRUE,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_university_code (universityCode),
                INDEX idx_super_admin (superAdminEmail),
                INDEX idx_database_name (databaseName)
            )
        `);
        
        // Add databaseName column if it doesn't exist (for existing installations)
        try {
            await connection.execute(`
                ALTER TABLE universities ADD COLUMN databaseName VARCHAR(100) UNIQUE AFTER universityCode
            `);
            console.log('  ✅ Added databaseName column to universities table');
        } catch (err) {
            if (!err.message.includes('Duplicate column')) {
                console.log('  Note: databaseName column may already exist');
            }
        }
        
        // Platform database only stores PRO Super Admin users
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS platform_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                department VARCHAR(100),
                permissions TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_role (role)
            )
        `);
        console.log('  ✅ platform_users table created (metadata only)');
        
        // Platform settings table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS platform_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                settingKey VARCHAR(100) UNIQUE NOT NULL,
                settingValue TEXT,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ platform_settings table created');
        
        // Database connections table (for manually created databases)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS database_connections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                databaseName VARCHAR(100) UNIQUE NOT NULL,
                host VARCHAR(255) NOT NULL,
                port INT NOT NULL,
                username VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                databaseType ENUM('Platform', 'University') DEFAULT 'University',
                description TEXT,
                status ENUM('Active', 'Inactive', 'Testing') DEFAULT 'Active',
                isAvailable BOOLEAN DEFAULT TRUE,
                assignedUniversityId INT DEFAULT NULL,
                isPlatformDB BOOLEAN DEFAULT FALSE,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_database_name (databaseName),
                INDEX idx_status (status),
                INDEX idx_type (databaseType),
                UNIQUE KEY idx_assigned_university (assignedUniversityId)
            )
        `);
        console.log('  ✅ database_connections table created (for manual DB management)');
        
        // Add databaseType column if it doesn't exist (for existing installations)
        try {
            await connection.execute(`
                ALTER TABLE database_connections ADD COLUMN databaseType ENUM('Platform', 'University') DEFAULT 'University' AFTER password
            `);
        } catch (err) {
            // Column may already exist
        }
        
        try {
            await connection.execute(`
                ALTER TABLE database_connections ADD COLUMN isPlatformDB BOOLEAN DEFAULT FALSE AFTER assignedUniversityId
            `);
        } catch (err) {
            // Column may already exist
        }

        connection.release();
        console.log('✅ Enhanced database tables created successfully!');
        
        // Create only PRO Super Admin (no demo universities or users)
        await createProSuperAdmin();
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        console.log('🔄 Running in demo mode without database...');
    }
}

// Create only PRO Super Admin in PLATFORM database
async function createProSuperAdmin() {
    try {
        // First, remove any old PRO admin accounts
        const oldEmails = ['pro@obeportal.com', 'admin@obeportal.com'];
        for (const oldEmail of oldEmails) {
            const [oldAccount] = await pool.execute(
                'SELECT id FROM platform_users WHERE email = ?',
                [oldEmail]
            );
            
            if (oldAccount.length > 0) {
                await pool.execute(
                    'DELETE FROM platform_users WHERE email = ?',
                    [oldEmail]
                );
                console.log(`🗑️  Removed old account: ${oldEmail}`);
            }
        }
        
        // Now check if new PRO admin exists
        const [existingProAdmin] = await pool.execute(
            'SELECT id FROM platform_users WHERE email = ?',
            ['pro@obe.org.pk']
        );
        
        if (existingProAdmin.length === 0) {
            // Create new PRO admin
            await pool.execute(
                `INSERT INTO platform_users (email, password, role, name, department, permissions) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    'pro@obe.org.pk',
                    await bcrypt.hash('proadmin123', 10),
                    'pro_superadmin',
                    'OBE Portal Administrator',
                    'Platform Management',
                    JSON.stringify(['platform_all', 'manage_universities', 'view_all_data'])
                ]
            );
            console.log(`✅ Created PRO Super Admin: pro@obe.org.pk`);
            console.log(`   Password: proadmin123`);
            console.log(`   Stored in: platform_users table (platform database)`);
        } else {
            console.log(`✅ PRO Super Admin already exists: pro@obe.org.pk`);
        }
    } catch (error) {
        console.error(`❌ Error managing PRO Super Admin:`, error.message);
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Authentication Routes (Updated for Separate Databases)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Determine which database to use
        const dbInfo = await dbManager.getDatabaseForUser(email);
        const database = dbInfo.database;
        
        // Choose the correct table based on database type
        const tableName = dbInfo.type === 'platform' ? 'platform_users' : 'users';
        
        // Query the appropriate database and table
        const [users] = await database.execute(
            `SELECT * FROM ${tableName} WHERE email = ?`,
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Remove password from response
        delete user.password;

        // Generate JWT token with database information
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email, 
                role: user.role,
                databaseName: dbInfo.databaseName,
                databaseType: dbInfo.type,
                universityCode: dbInfo.universityCode || null
            },
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

// Enhanced Assessment Management API
app.post('/api/assessments', async (req, res) => {
    try {
        const { name, courseId, assessmentType, dueDate, totalMarks, description, createdBy, questions } = req.body;
        
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Create assessment
            const [assessmentResult] = await connection.execute(
                'INSERT INTO assessments (name, courseId, assessmentType, dueDate, totalMarks, description, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [name, courseId, assessmentType, dueDate, totalMarks, description, createdBy]
            );
            
            const assessmentId = assessmentResult.insertId;
            
            // Create assessment questions with CLO linking
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                await connection.execute(
                    'INSERT INTO assessment_questions (assessmentId, questionNumber, questionText, maxMarks, cloId) VALUES (?, ?, ?, ?, ?)',
                    [assessmentId, i + 1, question.questionText, question.maxMarks, question.cloId]
                );
            }
            
            await connection.commit();
            
            res.status(201).json({ 
                message: 'Assessment created successfully with CLO linking',
                assessmentId: assessmentId
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Error creating assessment:', error);
        res.status(500).json({ error: 'Failed to create assessment' });
    }
});

// Result Upload API with Excel/CSV support
app.post('/api/results/upload', upload.single('resultFile'), async (req, res) => {
    try {
        const { assessmentId, courseId, semester, year, uploadedBy } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Here you would parse the Excel/CSV file
        // For now, we'll simulate the parsing
        const results = [
            {
                studentId: 'QUEST-2024-001',
                studentName: 'Ahmad Ali',
                questionScores: { Q1: 8, Q2: 7, Q3: 9, Q4: 6, Q5: 8 },
                totalScore: 38,
                percentage: 76
            },
            {
                studentId: 'QUEST-2024-002',
                studentName: 'Sara Khan',
                questionScores: { Q1: 9, Q2: 8, Q3: 7, Q4: 8, Q5: 9 },
                totalScore: 41,
                percentage: 82
            }
        ];
        
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            for (const result of results) {
                await connection.execute(
                    'INSERT INTO results (studentId, assessmentId, courseId, semester, year, questionScores, totalScore, percentage, grade, uploadedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        result.studentId, assessmentId, courseId, semester, year,
                        JSON.stringify(result.questionScores), result.totalScore, result.percentage,
                        result.percentage >= 80 ? 'A' : result.percentage >= 70 ? 'B' : result.percentage >= 60 ? 'C' : 'F',
                        uploadedBy
                    ]
                );
            }
            
            await connection.commit();
            
            res.status(201).json({ 
                message: 'Results uploaded successfully',
                recordsProcessed: results.length
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Error uploading results:', error);
        res.status(500).json({ error: 'Failed to upload results' });
    }
});

// CLO Attainment Calculation API
app.post('/api/clo-attainment/calculate', async (req, res) => {
    try {
        const { courseId, semester, year } = req.body;
        
        // Get all CLOs for the course
        const [clos] = await pool.execute(
            'SELECT * FROM clos WHERE courseId = ?',
            [courseId]
        );
        
        // Get all results for the course
        const [results] = await pool.execute(
            'SELECT * FROM results WHERE courseId = ? AND semester = ? AND year = ?',
            [courseId, semester, year]
        );
        
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            for (const clo of clos) {
                // Get assessment questions linked to this CLO
                const [questions] = await connection.execute(
                    'SELECT aq.*, a.id as assessmentId FROM assessment_questions aq JOIN assessments a ON aq.assessmentId = a.id WHERE aq.cloId = ? AND a.courseId = ?',
                    [clo.id, courseId]
                );
                
                // Calculate attainment for each student
                for (const result of results) {
                    let totalMarks = 0;
                    let obtainedMarks = 0;
                    
                    const questionScores = JSON.parse(result.questionScores);
                    
                    for (const question of questions) {
                        totalMarks += question.maxMarks;
                        const questionKey = `Q${question.questionNumber}`;
                        obtainedMarks += questionScores[questionKey] || 0;
                    }
                    
                    const attainmentPercentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
                    const isAttained = attainmentPercentage >= 60;
                    
                    await connection.execute(
                        'INSERT INTO clo_attainment (studentId, cloId, courseId, semester, year, totalMarks, obtainedMarks, attainmentPercentage, isAttained) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [result.studentId, clo.id, courseId, semester, year, totalMarks, obtainedMarks, attainmentPercentage, isAttained]
                    );
                }
            }
            
            await connection.commit();
            
            res.status(200).json({ 
                message: 'CLO attainment calculated successfully'
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Error calculating CLO attainment:', error);
        res.status(500).json({ error: 'Failed to calculate CLO attainment' });
    }
});

// CQI Actions API
app.post('/api/cqi-actions', async (req, res) => {
    try {
        const { cloId, courseId, semester, year, actionType, description, reason, targetDate, responsiblePerson, priority, createdBy } = req.body;
        
        const [result] = await pool.execute(
            'INSERT INTO cqi_actions (cloId, courseId, semester, year, actionType, description, reason, targetDate, responsiblePerson, priority, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [cloId, courseId, semester, year, actionType, description, reason, targetDate, responsiblePerson, priority, createdBy]
        );
        
        res.status(201).json({ 
            message: 'CQI action created successfully',
            actionId: result.insertId
        });
        
    } catch (error) {
        console.error('Error creating CQI action:', error);
        res.status(500).json({ error: 'Failed to create CQI action' });
    }
});

// Get CQI Actions for Focal Person Dashboard
app.get('/api/cqi-actions', async (req, res) => {
    try {
        const { department, semester, year } = req.query;
        
        let query = `
            SELECT ca.*, c.name as courseName, c.code as courseCode, clo.code as cloCode, clo.title as cloTitle,
                   u.name as createdByName, u.name as responsiblePersonName
            FROM cqi_actions ca
            JOIN courses c ON ca.courseId = c.id
            JOIN clos clo ON ca.cloId = clo.id
            JOIN users u ON ca.createdBy = u.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (department) {
            query += ' AND c.department = ?';
            params.push(department);
        }
        
        if (semester) {
            query += ' AND ca.semester = ?';
            params.push(semester);
        }
        
        if (year) {
            query += ' AND ca.year = ?';
            params.push(year);
        }
        
        query += ' ORDER BY ca.createdAt DESC';
        
        const [actions] = await pool.execute(query, params);
        res.json(actions);
        
    } catch (error) {
        console.error('Error fetching CQI actions:', error);
        res.status(500).json({ error: 'Failed to fetch CQI actions' });
    }
});

// Attendance Upload Fallback API
app.post('/api/attendance/upload', upload.single('attendanceFile'), async (req, res) => {
    try {
        const { courseId, semester, year, uploadedBy } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Simulate attendance data parsing
        const attendanceData = [
            {
                studentId: 'QUEST-2024-001',
                totalClasses: 30,
                attendedClasses: 28,
                attendancePercentage: 93.33
            },
            {
                studentId: 'QUEST-2024-002',
                totalClasses: 30,
                attendedClasses: 25,
                attendancePercentage: 83.33
            }
        ];
        
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            for (const attendance of attendanceData) {
                await connection.execute(
                    'INSERT INTO attendance (studentId, courseId, semester, year, totalClasses, attendedClasses, attendancePercentage, uploadedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [attendance.studentId, courseId, semester, year, attendance.totalClasses, attendance.attendedClasses, attendance.attendancePercentage, uploadedBy]
                );
            }
            
            await connection.commit();
            
            res.status(201).json({ 
                message: 'Attendance uploaded successfully',
                recordsProcessed: attendanceData.length
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Error uploading attendance:', error);
        res.status(500).json({ error: 'Failed to upload attendance' });
    }
});

// Department Performance API
app.get('/api/department-performance', async (req, res) => {
    try {
        const { department, semester, year } = req.query;
        
        // Get department performance metrics
        const [performance] = await pool.execute(`
            SELECT 
                c.department,
                ca.semester,
                ca.year,
                COUNT(DISTINCT c.id) as totalCourses,
                COUNT(DISTINCT r.studentId) as totalStudents,
                AVG(ca.attainmentPercentage) as averageAttainment,
                COUNT(DISTINCT cqi.id) as cqiActionsCount
            FROM courses c
            LEFT JOIN clo_attainment ca ON c.id = ca.courseId
            LEFT JOIN results r ON c.id = r.courseId
            LEFT JOIN cqi_actions cqi ON c.id = cqi.courseId
            WHERE c.department = ? AND ca.semester = ? AND ca.year = ?
            GROUP BY c.department, ca.semester, ca.year
        `, [department, semester, year]);
        
        res.json(performance);
        
    } catch (error) {
        console.error('Error fetching department performance:', error);
        res.status(500).json({ error: 'Failed to fetch department performance' });
    }
});

// Get CLO Attainment Summary
app.get('/api/clo-attainment-summary', async (req, res) => {
    try {
        const { courseId, semester, year } = req.query;
        
        const [summary] = await pool.execute(`
            SELECT 
                clo.code as cloCode,
                clo.title as cloTitle,
                COUNT(DISTINCT ca.studentId) as totalStudents,
                SUM(CASE WHEN ca.isAttained = 1 THEN 1 ELSE 0 END) as attainedStudents,
                AVG(ca.attainmentPercentage) as averageAttainment,
                MIN(ca.attainmentPercentage) as minAttainment,
                MAX(ca.attainmentPercentage) as maxAttainment
            FROM clo_attainment ca
            JOIN clos clo ON ca.cloId = clo.id
            WHERE ca.courseId = ? AND ca.semester = ? AND ca.year = ?
            GROUP BY clo.id, clo.code, clo.title
            ORDER BY clo.code
        `, [courseId, semester, year]);
        
        res.json(summary);
        
    } catch (error) {
        console.error('Error fetching CLO attainment summary:', error);
        res.status(500).json({ error: 'Failed to fetch CLO attainment summary' });
    }
});

// Database Management APIs

// Get all database connections
app.get('/api/databases', async (req, res) => {
    try {
        const [databases] = await pool.execute(
            'SELECT * FROM database_connections ORDER BY createdAt DESC'
        );
        res.json(databases);
    } catch (error) {
        console.error('Error fetching databases:', error);
        res.status(500).json({ error: 'Failed to fetch databases' });
    }
});

// Get available (unassigned) databases (ONLY University type databases)
app.get('/api/databases/available', async (req, res) => {
    try {
        // Get databases that are either:
        // 1. Available (isAvailable = TRUE)
        // 2. Assigned but the university was deleted (orphaned)
        const [databases] = await pool.execute(
            `SELECT dc.id, dc.databaseName, dc.host, dc.port, dc.description,
                    dc.isAvailable, dc.assignedUniversityId,
                    u.id as universityExists
             FROM database_connections dc
             LEFT JOIN universities u ON dc.assignedUniversityId = u.id
             WHERE dc.status = "Active" 
               AND dc.databaseType = "University"
               AND dc.isPlatformDB = FALSE
               AND (dc.isAvailable = TRUE OR u.id IS NULL)
             ORDER BY dc.isAvailable DESC, dc.databaseName ASC`
        );
        
        // Mark databases as available if university was deleted
        const availableDatabases = databases.map(db => ({
            ...db,
            isOrphaned: !db.isAvailable && !db.universityExists,
            displayName: !db.isAvailable && !db.universityExists 
                ? `${db.databaseName} (Previously Used - Now Available)` 
                : db.databaseName
        }));
        
        res.json(availableDatabases);
    } catch (error) {
        console.error('Error fetching available databases:', error);
        res.status(500).json({ error: 'Failed to fetch databases' });
    }
});

// Add new database connection
app.post('/api/databases', async (req, res) => {
    try {
        const { databaseName, host, port, username, password, description, databaseType, isPlatformDB } = req.body;

        // Check if database name already exists
        const [existing] = await pool.execute(
            'SELECT id FROM database_connections WHERE databaseName = ?',
            [databaseName]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Database connection with this name already exists' });
        }

        // For platform database, mark as not available for university assignment
        const isAvailable = (databaseType === 'Platform' || isPlatformDB) ? false : true;

        // Save connection
        const [result] = await pool.execute(
            `INSERT INTO database_connections (databaseName, host, port, username, password, databaseType, description, status, isAvailable, isPlatformDB) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
            [databaseName, host, port, username, password, databaseType || 'University', description || '', isAvailable, isPlatformDB || false]
        );

        const typeLabel = (databaseType === 'Platform' || isPlatformDB) ? 'Platform' : 'University';
        console.log(`✅ Saved ${typeLabel} database connection: ${databaseName}`);
        res.status(201).json({ message: 'Database connection saved successfully', id: result.insertId, type: typeLabel });
    } catch (error) {
        console.error('Error saving database:', error);
        res.status(500).json({ message: 'Failed to save database connection', error: error.message });
    }
});

// Test database connection
app.post('/api/databases/test', async (req, res) => {
    try {
        const { host, port, username, password, databaseName } = req.body;

        // Try to connect
        const testConnection = await mysql.createConnection({
            host,
            port,
            user: username,
            password,
            database: databaseName
        });

        // Test query
        await testConnection.execute('SELECT 1');
        await testConnection.end();

        res.json({ success: true, message: 'Connection successful' });
    } catch (error) {
        console.error('Database test failed:', error);
        res.status(400).json({ success: false, message: error.message });
    }
});

// Test saved database connection
app.post('/api/databases/:id/test', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [databases] = await pool.execute(
            'SELECT * FROM database_connections WHERE id = ?',
            [id]
        );

        if (databases.length === 0) {
            return res.status(404).json({ success: false, message: 'Database not found' });
        }

        const db = databases[0];

        // Try to connect
        const testConnection = await mysql.createConnection({
            host: db.host,
            port: db.port,
            user: db.username,
            password: db.password,
            database: db.databaseName
        });

        // Test query
        await testConnection.execute('SELECT 1');
        await testConnection.end();

        res.json({ success: true, message: 'Connection successful' });
    } catch (error) {
        console.error('Database test failed:', error);
        res.status(400).json({ success: false, message: error.message });
    }
});

// Delete database connection
// Update database connection
app.put('/api/databases/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { databaseName, host, port, username, password, databaseType, description } = req.body;

        const isPlatformDB = databaseType === 'Platform';

        await pool.execute(
            `UPDATE database_connections SET 
            databaseName = ?, host = ?, port = ?, username = ?, password = ?,
            databaseType = ?, isPlatformDB = ?, description = ?
            WHERE id = ?`,
            [databaseName, host, port, username, password, databaseType, isPlatformDB, description, id]
        );

        console.log(`✅ Updated database connection ID: ${id}`);
        res.json({ message: 'Database connection updated successfully' });
    } catch (error) {
        console.error('Error updating database:', error);
        res.status(500).json({ message: 'Failed to update database connection', error: error.message });
    }
});

app.delete('/api/databases/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query; // Support ?force=true for force delete

        // Check if assigned to any university (if not force delete)
        if (force !== 'true') {
            const [check] = await pool.execute(
                'SELECT assignedUniversityId FROM database_connections WHERE id = ?',
                [id]
            );

            if (check.length > 0 && check[0].assignedUniversityId) {
                return res.status(400).json({ 
                    message: 'Cannot delete: Database is assigned to a university', 
                    assignedUniversityId: check[0].assignedUniversityId,
                    canForceDelete: true
                });
            }
        }

        // Delete connection
        await pool.execute('DELETE FROM database_connections WHERE id = ?', [id]);

        console.log(`✅ ${force === 'true' ? 'Force ' : ''}Deleted database connection ID: ${id}`);
        res.json({ message: 'Database connection deleted successfully' });
    } catch (error) {
        console.error('Error deleting database:', error);
        res.status(500).json({ message: 'Failed to delete database connection', error: error.message });
    }
});

// Platform Users Management APIs

// Get all platform users
app.get('/api/platform-users', async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, name, email, role FROM platform_users ORDER BY role'
        );
        res.json(users);
    } catch (error) {
        console.error('Error fetching platform users:', error);
        res.status(500).json({ message: 'Failed to fetch platform users', error: error.message });
    }
});

// Create platform user
app.post('/api/platform-users', async (req, res) => {
    try {
        const { name, email, role, password } = req.body;

        // Check if email already exists
        const [existing] = await pool.execute(
            'SELECT id FROM platform_users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        await pool.execute(
            'INSERT INTO platform_users (name, email, role, password, department, permissions) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, role, hashedPassword, 'Platform Management', JSON.stringify(['manage_universities'])]
        );

        console.log(`✅ Created platform user: ${email} (${role})`);
        res.json({ message: 'Platform user created successfully' });
    } catch (error) {
        console.error('Error creating platform user:', error);
        res.status(500).json({ message: 'Failed to create platform user', error: error.message });
    }
});

// Delete platform user
app.delete('/api/platform-users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent deletion of PRO Super Admin
        const [user] = await pool.execute(
            'SELECT role FROM platform_users WHERE id = ?',
            [id]
        );

        if (user.length > 0 && user[0].role === 'pro_superadmin') {
            return res.status(403).json({ message: 'Cannot delete PRO Super Admin' });
        }

        // Delete user
        await pool.execute('DELETE FROM platform_users WHERE id = ?', [id]);

        console.log(`✅ Deleted platform user ID: ${id}`);
        res.json({ message: 'Platform user deleted successfully' });
    } catch (error) {
        console.error('Error deleting platform user:', error);
        res.status(500).json({ message: 'Failed to delete platform user', error: error.message });
    }
});

// Platform Settings APIs

// Get platform settings
app.get('/api/platform-settings', async (req, res) => {
    try {
        const [settings] = await pool.execute(
            'SELECT * FROM platform_settings WHERE id = 1'
        );
        
        if (settings.length > 0) {
            res.json(settings[0]);
        } else {
            // Return default settings
            res.json({
                platformName: 'OBE Portal',
                platformEmail: 'admin@obe.org.pk',
                supportEmail: 'support@obe.org.pk',
                platformUrl: 'https://obe.org.pk'
            });
        }
    } catch (error) {
        console.error('Error fetching platform settings:', error);
        res.status(500).json({ message: 'Failed to fetch platform settings', error: error.message });
    }
});

// Save platform settings
app.post('/api/platform-settings', async (req, res) => {
    try {
        const {
            platformName,
            platformEmail,
            supportEmail,
            platformUrl,
            smtpHost,
            smtpPort,
            smtpUsername,
            smtpPassword,
            smtpFromName,
            smtpFromEmail
        } = req.body;

        // Check if settings exist
        const [existing] = await pool.execute('SELECT id FROM platform_settings WHERE id = 1');

        if (existing.length > 0) {
            // Update existing settings
            await pool.execute(
                `UPDATE platform_settings SET 
                platformName = ?, platformEmail = ?, supportEmail = ?, platformUrl = ?,
                smtpHost = ?, smtpPort = ?, smtpUsername = ?, smtpPassword = ?,
                smtpFromName = ?, smtpFromEmail = ?, updated_at = NOW()
                WHERE id = 1`,
                [platformName, platformEmail, supportEmail, platformUrl,
                 smtpHost, smtpPort, smtpUsername, smtpPassword,
                 smtpFromName, smtpFromEmail]
            );
        } else {
            // Insert new settings
            await pool.execute(
                `INSERT INTO platform_settings (id, platformName, platformEmail, supportEmail, platformUrl,
                 smtpHost, smtpPort, smtpUsername, smtpPassword, smtpFromName, smtpFromEmail)
                 VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [platformName, platformEmail, supportEmail, platformUrl,
                 smtpHost, smtpPort, smtpUsername, smtpPassword,
                 smtpFromName, smtpFromEmail]
            );
        }

        console.log('✅ Platform settings saved');
        res.json({ message: 'Platform settings saved successfully' });
    } catch (error) {
        console.error('Error saving platform settings:', error);
        res.status(500).json({ message: 'Failed to save platform settings', error: error.message });
    }
});

// Create new university (PRO Super Admin only)
app.post('/api/universities/create', upload.single('logo'), async (req, res) => {
    try {
        const {
            universityName,
            universitySlug,
            city,
            country,
            superAdminEmail,
            contactPhone,
            contactEmail,
            subscriptionPlan,
            databaseConnectionId,
            address
        } = req.body;

        // Validate required fields
        if (!universityName || !universitySlug || !city || !superAdminEmail || !databaseConnectionId) {
            return res.status(400).json({ message: 'Missing required fields (including database connection)' });
        }

        // Check if university with this slug already exists
        const [existingUni] = await pool.execute(
            'SELECT id FROM universities WHERE universityCode = ?',
            [universitySlug]
        );

        if (existingUni.length > 0) {
            return res.status(400).json({ message: 'University with this slug already exists' });
        }

        // Get database connection details
        const [dbConnections] = await pool.execute(
            'SELECT * FROM database_connections WHERE id = ? AND isAvailable = TRUE',
            [databaseConnectionId]
        );

        if (dbConnections.length === 0) {
            return res.status(400).json({ message: 'Selected database is not available' });
        }

        const dbConn = dbConnections[0];

        // Get logo path
        let logoPath = null;
        if (req.file) {
            logoPath = '/uploads/' + req.file.filename;
        }

        // Generate random password for super admin
        const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();

        // Connect to the selected database and run migrations
        const uniConnection = await mysql.createConnection({
            host: dbConn.host,
            port: dbConn.port,
            user: dbConn.username,
            password: dbConn.password,
            database: dbConn.databaseName
        });

        // Run schema migrations on the database
        const universitySchema = require('./migrations/university-schema');
        await universitySchema.runMigrations(uniConnection);

        // Check if super admin already exists (database might have been reused)
        const [existingAdmin] = await uniConnection.execute(
            'SELECT id, email FROM users WHERE email = ?',
            [superAdminEmail]
        );

        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        if (existingAdmin.length > 0) {
            // Update existing super admin with new password
            await uniConnection.execute(
                `UPDATE users SET password = ?, name = ?, role = 'superadmin', department = 'Administration', permissions = ? WHERE email = ?`,
                [hashedPassword, `${universityName} Administrator`, JSON.stringify(['all']), superAdminEmail]
            );
            console.log(`✅ Updated existing super admin: ${superAdminEmail} in ${dbConn.databaseName}`);
        } else {
            // Create new super admin
            await uniConnection.execute(
                `INSERT INTO users (email, password, role, name, department, permissions) 
                 VALUES (?, ?, 'superadmin', ?, 'Administration', ?)`,
                [
                    superAdminEmail,
                    hashedPassword,
                    `${universityName} Administrator`,
                    JSON.stringify(['all'])
                ]
            );
            console.log(`✅ Created new super admin: ${superAdminEmail} in ${dbConn.databaseName}`);
        }

        await uniConnection.end();

        // Create university record in PLATFORM database
        const [result] = await pool.execute(
            `INSERT INTO universities (universityName, universityCode, logo, address, city, country, 
             contactEmail, contactPhone, website, superAdminEmail, subscriptionPlan, subscriptionStatus, 
             isActive, databaseName) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', TRUE, ?)`,
            [
                universityName,
                universitySlug,
                logoPath,
                address || '',
                city,
                country || 'Pakistan',
                contactEmail || superAdminEmail,
                contactPhone || '',
                '',
                superAdminEmail,
                subscriptionPlan || 'Premium',
                dbConn.databaseName
            ]
        );

        const universityId = result.insertId;

        // Mark database as assigned
        await pool.execute(
            'UPDATE database_connections SET isAvailable = FALSE, assignedUniversityId = ? WHERE id = ?',
            [universityId, databaseConnectionId]
        );

        console.log(`✅ Created university: ${universityName} (${universitySlug})`);
        console.log(`✅ Using database: ${dbConn.databaseName}`);
        console.log(`✅ Super admin: ${superAdminEmail} with password: ${randomPassword}`);

        // Return success response
        res.status(201).json({
            message: 'University created successfully',
            university: {
                id: universityId,
                universityName,
                universityCode: universitySlug,
                city,
                country,
                superAdminEmail,
                logoPath,
                subscriptionPlan
            },
            superAdminPassword: randomPassword,
            note: 'Database obe_university_' + universitySlug + ' schema ready. Super admin credentials have been generated.'
        });

    } catch (error) {
        console.error('Error creating university:', error);
        res.status(500).json({ 
            message: 'Failed to create university', 
            error: error.message 
        });
    }
});

// Get all universities (PRO Super Admin only) - with counts from separate DBs
app.get('/api/universities', async (req, res) => {
    try {
        const [universities] = await pool.execute(
            'SELECT * FROM universities ORDER BY createdAt DESC'
        );
        
        // Get counts from each university's database
        for (const uni of universities) {
            try {
                if (uni.databaseName) {
                    const uniDB = await dbManager.getUniversityConnection(uni.databaseName);
                    const [userCount] = await uniDB.execute('SELECT COUNT(*) as count FROM users');
                    const [courseCount] = await uniDB.execute('SELECT COUNT(*) as count FROM courses');
                    
                    uni.totalUsers = userCount[0].count;
                    uni.totalCourses = courseCount[0].count;
                } else {
                    uni.totalUsers = 0;
                    uni.totalCourses = 0;
                }
            } catch (error) {
                console.error(`Error querying ${uni.databaseName}:`, error.message);
                uni.totalUsers = 0;
                uni.totalCourses = 0;
            }
        }
        
        res.json(universities);
    } catch (error) {
        console.error('Error fetching universities:', error);
        res.status(500).json({ error: 'Failed to fetch universities' });
    }
});

// Get public universities list (for front page - no auth required)
app.get('/api/universities/public', async (req, res) => {
    try {
        const [universities] = await pool.execute(
            `SELECT id, universityName, universityCode, logo, city, country, website
             FROM universities 
             WHERE isActive = TRUE
             ORDER BY universityName ASC`
        );
        res.json(universities);
    } catch (error) {
        console.error('Error fetching public universities:', error);
        res.status(500).json({ error: 'Failed to fetch universities' });
    }
});

// Get platform statistics (for front page - queries across all university DBs)
app.get('/api/platform-stats', async (req, res) => {
    try {
        const stats = await dbManager.getPlatformStatistics();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching platform stats:', error);
        res.status(500).json({ 
            totalUniversities: 0,
            totalUsers: 1,
            totalCourses: 0
        });
    }
});

// Get current user's university info (for university super admins)
app.get('/api/my-university', async (req, res) => {
    try {
        // Get email from request header sent by frontend
        const userEmail = req.headers['x-user-email'];
        
        if (!userEmail) {
            return res.status(400).json({ message: 'User email not provided' });
        }

        // Find university by super admin email in platform database
        const [universities] = await pool.execute(
            'SELECT * FROM universities WHERE superAdminEmail = ?',
            [userEmail]
        );

        if (universities.length === 0) {
            return res.status(404).json({ message: 'University not found' });
        }

        res.json(universities[0]);
    } catch (error) {
        console.error('Error fetching university info:', error);
        res.status(500).json({ message: 'Failed to fetch university info', error: error.message });
    }
});

// Get single university by ID (PRO Super Admin only) - with counts from separate DB
app.get('/api/universities/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [universities] = await pool.execute(
            'SELECT * FROM universities WHERE id = ?',
            [id]
        );

        if (universities.length === 0) {
            return res.status(404).json({ message: 'University not found' });
        }

        const uni = universities[0];
        
        // Get counts from university's database
        try {
            if (uni.databaseName) {
                const uniDB = await dbManager.getUniversityConnection(uni.databaseName);
                const [userCount] = await uniDB.execute('SELECT COUNT(*) as count FROM users');
                const [courseCount] = await uniDB.execute('SELECT COUNT(*) as count FROM courses');
                
                uni.totalUsers = userCount[0].count;
                uni.totalCourses = courseCount[0].count;
            } else {
                uni.totalUsers = 0;
                uni.totalCourses = 0;
            }
        } catch (error) {
            console.error(`Error querying ${uni.databaseName}:`, error.message);
            uni.totalUsers = 0;
            uni.totalCourses = 0;
        }

        res.json(uni);
    } catch (error) {
        console.error('Error fetching university:', error);
        res.status(500).json({ error: 'Failed to fetch university' });
    }
});

// Update university (PRO Super Admin only)
app.put('/api/universities/:id', upload.single('logo'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            universityName,
            city,
            country,
            superAdminEmail,
            contactPhone,
            contactEmail,
            website,
            subscriptionPlan,
            isActive,
            address,
            resetPassword,
            newPassword
        } = req.body;

        // Check if university exists
        const [existing] = await pool.execute(
            'SELECT id, universityCode FROM universities WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'University not found' });
        }

        // Get logo path
        let logoPath = null;
        if (req.file) {
            logoPath = '/uploads/' + req.file.filename;
        }

        // Build update query
        let updateQuery = `UPDATE universities SET 
            universityName = ?,
            city = ?,
            country = ?,
            superAdminEmail = ?,
            contactPhone = ?,
            contactEmail = ?,
            website = ?,
            subscriptionPlan = ?,
            isActive = ?,
            address = ?`;
        
        let updateParams = [
            universityName,
            city,
            country,
            superAdminEmail,
            contactPhone || '',
            contactEmail || '',
            website || '',
            subscriptionPlan,
            isActive === '1' ? 1 : 0,
            address || ''
        ];

        // Add logo if uploaded
        if (logoPath) {
            updateQuery += ', logo = ?';
            updateParams.push(logoPath);
        }

        updateQuery += ', updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
        updateParams.push(id);

        // Update university
        await pool.execute(updateQuery, updateParams);

        console.log(`✅ Updated university ID ${id}: ${universityName}`);

        // Handle password reset if requested
        let newPasswordGenerated = null;
        if (resetPassword === 'true' && newPassword) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            // Get university database name
            const [uniData] = await pool.execute(
                'SELECT databaseName FROM universities WHERE id = ?',
                [id]
            );
            
            if (uniData.length > 0 && uniData[0].databaseName) {
                // Connect to university database and update password
                const uniDB = await dbManager.getUniversityConnection(uniData[0].databaseName);
                await uniDB.execute(
                    'UPDATE users SET password = ? WHERE role = "superadmin"',
                    [hashedPassword]
                );
                
                newPasswordGenerated = newPassword;
                console.log(`✅ Reset password for super admin in ${uniData[0].databaseName}`);
            }
        }

        // Prepare response
        const response = {
            message: 'University updated successfully',
            universityName,
            superAdminEmail
        };

        if (newPasswordGenerated) {
            response.newPassword = newPasswordGenerated;
        }

        if (logoPath) {
            response.logoPath = logoPath;
        }

        res.json(response);
    } catch (error) {
        console.error('Error updating university:', error);
        res.status(500).json({ 
            message: 'Failed to update university', 
            error: error.message 
        });
    }
});

// Delete university (PRO Super Admin only)
app.delete('/api/universities/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if university exists and get database info
        const [existing] = await pool.execute(
            'SELECT universityName, universityCode, databaseName FROM universities WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'University not found' });
        }

        const universityName = existing[0].universityName;
        const databaseName = existing[0].databaseName;

        // Delete university (cascade will delete related records)
        await pool.execute('DELETE FROM universities WHERE id = ?', [id]);

        // CRITICAL: Mark the database as available again so it can be reused
        if (databaseName) {
            await pool.execute(
                `UPDATE database_connections 
                 SET isAvailable = TRUE, 
                     assignedUniversityId = NULL 
                 WHERE databaseName = ?`,
                [databaseName]
            );
            console.log(`✅ Database ${databaseName} marked as available again`);
        }

        console.log(`✅ Deleted university ID ${id}: ${universityName}`);
        res.json({ 
            message: 'University deleted successfully', 
            universityName 
        });
    } catch (error) {
        console.error('Error deleting university:', error);
        res.status(500).json({ 
            message: 'Failed to delete university', 
            error: error.message 
        });
    }
});

// ==================== University-Specific APIs (use university database) ====================

// Get all users in university database
app.get('/api/users', async (req, res) => {
    try {
        // Get user email from header
        const userEmail = req.headers['x-user-email'];
        
        if (!userEmail) {
            return res.status(400).json({ error: 'User email required' });
        }

        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        const [users] = await uniDB.execute(
            'SELECT id, email, role, name, department, permissions, createdAt FROM users ORDER BY createdAt DESC'
        );
        
        console.log(`📋 Fetched ${users.length} users from ${dbInfo.databaseName}`);
        if (users.length > 0) {
            console.log('   Users:', users.map(u => `${u.email} (${u.role})`).join(', '));
        }
        
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users', message: error.message });
    }
});

// Add single user (University Super Admin)
app.post('/api/users', async (req, res) => {
    try {
        const { name, email, role, department, password } = req.body;

        // Validate required fields
        if (!name || !email || !role || !password) {
            return res.status(400).json({ message: 'Missing required fields: name, email, role, and password are required' });
        }

        // Get user's university database
        const userEmail = req.headers['x-user-email'];
        
        if (!userEmail) {
            return res.status(401).json({ message: 'Authentication required. Please login again.' });
        }

        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ message: 'Access denied. University Super Admin access required.' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Check if user already exists
        const [existing] = await uniDB.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        await uniDB.execute(
            `INSERT INTO users (email, password, role, name, department, permissions, createdAt) 
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [email, hashedPassword, role, name, department || '', JSON.stringify(['basic'])]
        );

        console.log(`✅ Created user: ${email} (${role}) in ${dbInfo.databaseName}`);
        res.status(201).json({ message: 'User created successfully', email, name, role });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: error.message || 'Failed to create user. Please try again.' });
    }
});

// Bulk upload users
app.post('/api/users/bulk', async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ message: 'Invalid or empty data' });
        }

        // Get user's university database
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        let inserted = 0;
        let failed = 0;
        const errors = [];

        for (const user of data) {
            try {
                const { name, email, role, department, password } = user;

                // Validate required fields
                if (!name || !email || !role || !password) {
                    errors.push({ email, error: 'Missing required fields' });
                    failed++;
                    continue;
                }

                // Check if exists
                const [existing] = await uniDB.execute(
                    'SELECT id FROM users WHERE email = ?',
                    [email]
                );

                if (existing.length > 0) {
                    errors.push({ email, error: 'User already exists' });
                    failed++;
                    continue;
                }

                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Insert user
                await uniDB.execute(
                    `INSERT INTO users (email, password, role, name, department, permissions, createdAt) 
                     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                    [email, hashedPassword, role, name, department || '', JSON.stringify(['basic'])]
                );

                inserted++;
            } catch (error) {
                errors.push({ email: user.email, error: error.message });
                failed++;
            }
        }

        console.log(`✅ Bulk user upload: ${inserted} inserted, ${failed} failed in ${dbInfo.databaseName}`);
        res.json({ 
            message: 'Bulk upload completed',
            inserted,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error in bulk user upload:', error);
        res.status(500).json({ error: 'Failed to upload users', message: error.message });
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, department, password } = req.body;

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Update user data
        let query = 'UPDATE users SET name = ?, email = ?, role = ?, department = ?';
        let params = [name, email, role, department];

        // If password is provided, hash and update it
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await uniDB.execute(query, params);

        console.log(`✅ Updated user ID ${id} in ${dbInfo.databaseName}`);
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user', message: error.message });
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get user's university database
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Prevent deletion of super admin
        const [user] = await uniDB.execute(
            'SELECT role FROM users WHERE id = ?',
            [id]
        );

        if (user.length > 0 && user[0].role === 'superadmin') {
            return res.status(403).json({ message: 'Cannot delete super admin' });
        }

        // Delete user
        await uniDB.execute('DELETE FROM users WHERE id = ?', [id]);

        console.log(`✅ Deleted user ID: ${id} from ${dbInfo.databaseName}`);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Failed to delete user', error: error.message });
    }
});

// Get all courses in university database
app.get('/api/courses', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        const [courses] = await uniDB.execute('SELECT * FROM courses');
        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Add single course
app.post('/api/courses', async (req, res) => {
    try {
        const { code, name, creditHours, department, level, prerequisite, instructor, description } = req.body;

        if (!code || !name) {
            return res.status(400).json({ message: 'Course code and name are required' });
        }

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Check if exists
        const [existing] = await uniDB.execute('SELECT id FROM courses WHERE code = ?', [code]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Course with this code already exists' });
        }

        // Insert course
        await uniDB.execute(
            `INSERT INTO courses (code, name, creditHours, department, level, prerequisite, instructor, description, createdAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [code, name, creditHours || 3, department || '', level || '', prerequisite || '', instructor || '', description || '']
        );

        console.log(`✅ Created course: ${code} in ${dbInfo.databaseName}`);
        res.status(201).json({ message: 'Course created successfully', code, name });
    } catch (error) {
        console.error('Error creating course:', error);
        res.status(500).json({ error: 'Failed to create course', message: error.message });
    }
});

// Update course
app.put('/api/courses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, creditHours, department, level, prerequisite, instructor, description } = req.body;

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        await uniDB.execute(
            `UPDATE courses SET code = ?, name = ?, creditHours = ?, department = ?, level = ?, prerequisite = ?, instructor = ?, description = ? WHERE id = ?`,
            [code, name, creditHours, department, level, prerequisite, instructor, description, id]
        );

        console.log(`✅ Updated course ID ${id} in ${dbInfo.databaseName}`);
        res.json({ message: 'Course updated successfully' });
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ error: 'Failed to update course', message: error.message });
    }
});

// Delete course
app.delete('/api/courses/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        await uniDB.execute('DELETE FROM courses WHERE id = ?', [id]);

        console.log(`✅ Deleted course ID ${id} from ${dbInfo.databaseName}`);
        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).json({ error: 'Failed to delete course', message: error.message });
    }
});

// Bulk upload courses
app.post('/api/courses/bulk', async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ message: 'Invalid or empty data' });
        }

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        let inserted = 0;
        let failed = 0;
        const errors = [];

        for (const course of data) {
            try {
                const { code, name, creditHours, department, level, prerequisite, description } = course;

                if (!code || !name) {
                    errors.push({ code, error: 'Missing required fields (code, name)' });
                    failed++;
                    continue;
                }

                // Check if exists
                const [existing] = await uniDB.execute(
                    'SELECT id FROM courses WHERE code = ?',
                    [code]
                );

                if (existing.length > 0) {
                    errors.push({ code, error: 'Course already exists' });
                    failed++;
                    continue;
                }

                // Insert course
                await uniDB.execute(
                    `INSERT INTO courses (code, name, creditHours, department, level, prerequisite, description, createdAt) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [code, name, creditHours || 3, department || '', level || '', prerequisite || '', description || '']
                );

                inserted++;
            } catch (error) {
                errors.push({ code: course.code, error: error.message });
                failed++;
            }
        }

        console.log(`✅ Bulk course upload: ${inserted} inserted, ${failed} failed in ${dbInfo.databaseName}`);
        res.json({ 
            message: 'Bulk upload completed',
            inserted,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error in bulk course upload:', error);
        res.status(500).json({ error: 'Failed to upload courses', message: error.message });
    }
});

// Get faculties
app.get('/api/faculties', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        
        // Check if faculties table exists
        const [tables] = await uniDB.execute(`SHOW TABLES LIKE 'faculties'`);
        
        if (tables.length === 0) {
            // Create faculties table if not exists
            await uniDB.execute(`
                CREATE TABLE IF NOT EXISTS faculties (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    name VARCHAR(255) NOT NULL,
                    code VARCHAR(50) UNIQUE NOT NULL,
                    deanId INT,
                    deanEmail VARCHAR(255),
                    deanName VARCHAR(255),
                    description TEXT,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            res.json([]);
        } else {
            // Get faculties with department counts
            const [faculties] = await uniDB.execute(`
                SELECT f.*, 
                       (SELECT COUNT(*) FROM departments WHERE facultyId = f.id) as departmentCount
                FROM faculties f
                ORDER BY f.createdAt DESC
            `);
            res.json(faculties);
        }
    } catch (error) {
        console.error('Error fetching faculties:', error);
        res.status(500).json({ error: 'Failed to fetch faculties' });
    }
});

// Add single faculty (with optional Dean user creation)
app.post('/api/faculties', async (req, res) => {
    try {
        const { name, code, description, createDean, deanName, deanEmail, deanPassword, deanDepartment, deanId } = req.body;

        console.log('📝 Faculty creation request:', { name, code, createDean, deanEmail });

        if (!name || !code) {
            return res.status(400).json({ message: 'Faculty name and code are required' });
        }

        const userEmail = req.headers['x-user-email'];
        
        if (!userEmail) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ message: 'Access denied. University Super Admin access required.' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        console.log('✅ Connected to database:', dbInfo.databaseName);

        // Ensure faculties table exists
        await uniDB.execute(`
            CREATE TABLE IF NOT EXISTS faculties (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) UNIQUE NOT NULL,
                deanId INT,
                deanEmail VARCHAR(255),
                deanName VARCHAR(255),
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if faculty exists
        const [existing] = await uniDB.execute('SELECT id FROM faculties WHERE code = ?', [code]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Faculty with this code already exists' });
        }

        let finalDeanId = deanId;
        let finalDeanEmail = deanEmail;
        let finalDeanName = deanName;
        let generatedPassword = null;

        // Create Dean user if requested
        if (createDean && deanName && deanEmail && deanPassword) {
            console.log('👤 Creating new Dean user...', deanEmail);
            
            // Check if dean email already exists
            const [existingDean] = await uniDB.execute('SELECT id FROM users WHERE email = ?', [deanEmail]);
            
            if (existingDean.length > 0) {
                console.log('❌ Dean email already exists:', deanEmail);
                return res.status(400).json({ message: `Dean email ${deanEmail} already exists. Use existing dean option instead.` });
            }

            console.log('🔐 Hashing password...');
            // Hash password
            const hashedPassword = await bcrypt.hash(deanPassword, 10);

            console.log('💾 Inserting Dean into database...');
            // Create Dean user
            const [deanResult] = await uniDB.execute(
                `INSERT INTO users (email, password, role, name, department, permissions, createdAt) 
                 VALUES (?, ?, 'dean', ?, ?, ?, NOW())`,
                [deanEmail, hashedPassword, deanName, deanDepartment || 'Administration', JSON.stringify(['faculty_admin'])]
            );

            finalDeanId = deanResult.insertId;
            finalDeanEmail = deanEmail;
            finalDeanName = deanName;
            generatedPassword = deanPassword;

            console.log(`✅ Created Dean user: ${deanEmail} (ID: ${finalDeanId}) for faculty ${code}`);
        }

        // Insert faculty
        await uniDB.execute(
            `INSERT INTO faculties (name, code, deanId, deanEmail, deanName, description, createdAt) 
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [name, code, finalDeanId || null, finalDeanEmail || null, finalDeanName || null, description || '']
        );

        console.log(`✅ Created faculty: ${code} in ${dbInfo.databaseName}`);
        
        const response = { 
            message: 'Faculty created successfully', 
            code, 
            name 
        };

        if (generatedPassword) {
            response.deanPassword = generatedPassword;
            response.deanCreated = true;
            response.deanEmail = finalDeanEmail;
            response.deanName = finalDeanName;
            console.log(`📦 Returning dean credentials in response`);
        }

        console.log('✅ Faculty creation complete, sending response');
        res.status(201).json(response);
    } catch (error) {
        console.error('❌ Error creating faculty:', error);
        res.status(500).json({ message: error.message || 'Failed to create faculty' });
    }
});

// Delete faculty
app.delete('/api/faculties/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Unlink departments (set facultyId to NULL)
        await uniDB.execute('UPDATE departments SET facultyId = NULL WHERE facultyId = ?', [id]);

        // Delete faculty
        await uniDB.execute('DELETE FROM faculties WHERE id = ?', [id]);

        console.log(`✅ Deleted faculty ID ${id} from ${dbInfo.databaseName}`);
        res.json({ message: 'Faculty deleted successfully' });
    } catch (error) {
        console.error('Error deleting faculty:', error);
        res.status(500).json({ error: 'Failed to delete faculty', message: error.message });
    }
});

// Bulk upload faculties
app.post('/api/faculties/bulk', async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ message: 'Invalid or empty data' });
        }

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Ensure table exists
        await uniDB.execute(`
            CREATE TABLE IF NOT EXISTS faculties (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) UNIQUE NOT NULL,
                deanId INT,
                deanEmail VARCHAR(255),
                deanName VARCHAR(255),
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        let inserted = 0;
        let failed = 0;
        const errors = [];

        for (const faculty of data) {
            try {
                const { name, code, deanEmail, description } = faculty;

                if (!name || !code) {
                    errors.push({ code, error: 'Missing required fields (name, code)' });
                    failed++;
                    continue;
                }

                // Find dean by email if provided
                let deanId = null, deanName = null;
                if (deanEmail) {
                    const [deanUser] = await uniDB.execute(
                        'SELECT id, name FROM users WHERE email = ? AND role = "dean"',
                        [deanEmail]
                    );
                    if (deanUser.length > 0) {
                        deanId = deanUser[0].id;
                        deanName = deanUser[0].name;
                    } else {
                        errors.push({ code, error: 'Dean not found with email: ' + deanEmail });
                        failed++;
                        continue;
                    }
                }

                // Check if exists
                const [existing] = await uniDB.execute('SELECT id FROM faculties WHERE code = ?', [code]);
                if (existing.length > 0) {
                    errors.push({ code, error: 'Faculty already exists' });
                    failed++;
                    continue;
                }

                // Insert faculty
                await uniDB.execute(
                    `INSERT INTO faculties (name, code, deanId, deanEmail, deanName, description, createdAt) 
                     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                    [name, code, deanId, deanEmail, deanName, description || '']
                );

                inserted++;
            } catch (error) {
                errors.push({ code: faculty.code, error: error.message });
                failed++;
            }
        }

        console.log(`✅ Bulk faculty upload: ${inserted} inserted, ${failed} failed in ${dbInfo.databaseName}`);
        res.json({ 
            message: 'Bulk upload completed',
            inserted,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error in bulk faculty upload:', error);
        res.status(500).json({ error: 'Failed to upload faculties', message: error.message });
    }
});

// Get departments
app.get('/api/departments', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        
        // Check if departments table exists
        const [tables] = await uniDB.execute(`SHOW TABLES LIKE 'departments'`);
        
        if (tables.length === 0) {
            // Create departments table if not exists
            await uniDB.execute(`
                CREATE TABLE IF NOT EXISTS departments (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    name VARCHAR(255) NOT NULL,
                    code VARCHAR(50) UNIQUE,
                    facultyId INT,
                    head VARCHAR(255),
                    description TEXT,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            res.json([]);
        } else {
            // Get departments with faculty names
            const [departments] = await uniDB.execute(`
                SELECT d.*, f.name as facultyName, f.code as facultyCode
                FROM departments d
                LEFT JOIN faculties f ON d.facultyId = f.id
                ORDER BY d.createdAt DESC
            `);
            res.json(departments);
        }
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
});

// Add single department
app.post('/api/departments', async (req, res) => {
    try {
        const { name, code, facultyId, head, description } = req.body;

        if (!name || !code || !facultyId) {
            return res.status(400).json({ message: 'Department name, code, and faculty are required' });
        }

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Ensure table exists
        await uniDB.execute(`
            CREATE TABLE IF NOT EXISTS departments (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) UNIQUE,
                facultyId INT,
                head VARCHAR(255),
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if exists
        const [existing] = await uniDB.execute('SELECT id FROM departments WHERE code = ?', [code]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Department with this code already exists' });
        }

        // Insert department
        await uniDB.execute(
            `INSERT INTO departments (name, code, facultyId, head, description, createdAt) VALUES (?, ?, ?, ?, ?, NOW())`,
            [name, code, facultyId, head || '', description || '']
        );

        console.log(`✅ Created department: ${code} in ${dbInfo.databaseName}`);
        res.status(201).json({ message: 'Department created successfully', code, name });
    } catch (error) {
        console.error('Error creating department:', error);
        res.status(500).json({ error: 'Failed to create department', message: error.message });
    }
});

// Bulk upload departments
app.post('/api/departments/bulk', async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ message: 'Invalid or empty data' });
        }

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Ensure departments table exists
        await uniDB.execute(`
            CREATE TABLE IF NOT EXISTS departments (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) UNIQUE,
                facultyId INT,
                head VARCHAR(255),
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        let inserted = 0;
        let failed = 0;
        const errors = [];

        for (const dept of data) {
            try {
                const { name, code, facultyCode, head, description } = dept;

                if (!name) {
                    errors.push({ name, error: 'Missing required field (name)' });
                    failed++;
                    continue;
                }

                // Find faculty by code if provided
                let facultyId = null;
                if (facultyCode) {
                    const [faculty] = await uniDB.execute(
                        'SELECT id FROM faculties WHERE code = ?',
                        [facultyCode]
                    );
                    if (faculty.length > 0) {
                        facultyId = faculty[0].id;
                    } else {
                        errors.push({ code, error: 'Faculty not found: ' + facultyCode });
                        failed++;
                        continue;
                    }
                }

                // Check if exists
                if (code) {
                    const [existing] = await uniDB.execute(
                        'SELECT id FROM departments WHERE code = ?',
                        [code]
                    );

                    if (existing.length > 0) {
                        errors.push({ code, error: 'Department already exists' });
                        failed++;
                        continue;
                    }
                }

                // Insert department
                await uniDB.execute(
                    `INSERT INTO departments (name, code, facultyId, head, description, createdAt) 
                     VALUES (?, ?, ?, ?, ?, NOW())`,
                    [name, code || '', facultyId, head || '', description || '']
                );

                inserted++;
            } catch (error) {
                errors.push({ name: dept.name, error: error.message });
                failed++;
            }
        }

        console.log(`✅ Bulk department upload: ${inserted} inserted, ${failed} failed in ${dbInfo.databaseName}`);
        res.json({ 
            message: 'Bulk upload completed',
            inserted,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error in bulk department upload:', error);
        res.status(500).json({ error: 'Failed to upload departments', message: error.message });
    }
});

// Get programs
app.get('/api/programs', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        
        // Check if programs table exists
        const [tables] = await uniDB.execute(`SHOW TABLES LIKE 'programs'`);
        
        if (tables.length === 0) {
            // Create programs table if not exists
            await uniDB.execute(`
                CREATE TABLE IF NOT EXISTS programs (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    code VARCHAR(50) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    level VARCHAR(100),
                    duration INT DEFAULT 4,
                    department VARCHAR(255),
                    creditHours INT,
                    coordinator VARCHAR(255),
                    description TEXT,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            res.json([]);
        } else {
            const [programs] = await uniDB.execute('SELECT * FROM programs');
            res.json(programs);
        }
    } catch (error) {
        console.error('Error fetching programs:', error);
        res.status(500).json({ error: 'Failed to fetch programs' });
    }
});

// Add single program
app.post('/api/programs', async (req, res) => {
    try {
        const { code, name, level, duration, creditHours, department, coordinator, description } = req.body;

        if (!code || !name) {
            return res.status(400).json({ message: 'Program code and name are required' });
        }

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Ensure table exists
        await uniDB.execute(`
            CREATE TABLE IF NOT EXISTS programs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                level VARCHAR(100),
                duration INT DEFAULT 4,
                department VARCHAR(255),
                creditHours INT,
                coordinator VARCHAR(255),
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if exists
        const [existing] = await uniDB.execute('SELECT id FROM programs WHERE code = ?', [code]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Program with this code already exists' });
        }

        // Insert program
        await uniDB.execute(
            `INSERT INTO programs (code, name, level, duration, creditHours, department, coordinator, description, createdAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [code, name, level || 'Undergraduate', duration || 4, creditHours || 136, department || '', coordinator || '', description || '']
        );

        console.log(`✅ Created program: ${code} in ${dbInfo.databaseName}`);
        res.status(201).json({ message: 'Program created successfully', code, name });
    } catch (error) {
        console.error('Error creating program:', error);
        res.status(500).json({ error: 'Failed to create program', message: error.message });
    }
});

// Delete program
app.delete('/api/programs/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        await uniDB.execute('DELETE FROM programs WHERE id = ?', [id]);

        console.log(`✅ Deleted program ID ${id} from ${dbInfo.databaseName}`);
        res.json({ message: 'Program deleted successfully' });
    } catch (error) {
        console.error('Error deleting program:', error);
        res.status(500).json({ error: 'Failed to delete program', message: error.message });
    }
});

// Bulk upload programs
app.post('/api/programs/bulk', async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ message: 'Invalid or empty data' });
        }

        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Ensure programs table exists
        await uniDB.execute(`
            CREATE TABLE IF NOT EXISTS programs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                level VARCHAR(100),
                duration INT DEFAULT 4,
                department VARCHAR(255),
                creditHours INT,
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        let inserted = 0;
        let failed = 0;
        const errors = [];

        for (const program of data) {
            try {
                const { code, name, level, duration, department, creditHours, description } = program;

                if (!code || !name) {
                    errors.push({ code, error: 'Missing required fields (code, name)' });
                    failed++;
                    continue;
                }

                // Check if exists
                const [existing] = await uniDB.execute(
                    'SELECT id FROM programs WHERE code = ?',
                    [code]
                );

                if (existing.length > 0) {
                    errors.push({ code, error: 'Program already exists' });
                    failed++;
                    continue;
                }

                // Insert program
                await uniDB.execute(
                    `INSERT INTO programs (code, name, level, duration, department, creditHours, description, createdAt) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [code, name, level || 'Undergraduate', duration || 4, department || '', creditHours || 136, description || '']
                );

                inserted++;
            } catch (error) {
                errors.push({ code: program.code, error: error.message });
                failed++;
            }
        }

        console.log(`✅ Bulk program upload: ${inserted} inserted, ${failed} failed in ${dbInfo.databaseName}`);
        res.json({ 
            message: 'Bulk upload completed',
            inserted,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error in bulk program upload:', error);
        res.status(500).json({ error: 'Failed to upload programs', message: error.message });
    }
});

app.get('/api/clos', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        const [clos] = await uniDB.execute(`
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

// PLOs endpoint
app.get('/api/plos', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        const [plos] = await uniDB.execute('SELECT * FROM plos');
        res.json(plos);
    } catch (error) {
        console.error('Error fetching PLOs:', error);
        res.json([]); // Return empty array if table doesn't exist
    }
});

// PEOs endpoint
app.get('/api/peos', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        const [peos] = await uniDB.execute('SELECT * FROM peos');
        res.json(peos);
    } catch (error) {
        console.error('Error fetching PEOs:', error);
        res.json([]); // Return empty array if table doesn't exist
    }
});

app.get('/api/assessments', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        const [assessments] = await uniDB.execute(`
            SELECT a.*, c.name as courseName, c.code as courseCode
            FROM assessments a 
            LEFT JOIN courses c ON a.courseId = c.id
        `);
        res.json(assessments);
    } catch (error) {
        console.error('Error fetching assessments:', error);
        res.status(500).json({ error: 'Failed to fetch assessments' });
    }
});

// Get results/performance data
app.get('/api/results', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        
        // Check if results table exists
        const [tables] = await uniDB.execute(`SHOW TABLES LIKE 'results'`);
        
        if (tables.length === 0) {
            res.json([]);
        } else {
            const [results] = await uniDB.execute(`
                SELECT r.*, c.code as courseCode, c.name as courseName
                FROM results r
                LEFT JOIN courses c ON r.courseId = c.id
                ORDER BY r.uploadedAt DESC
            `);
            res.json(results);
        }
    } catch (error) {
        console.error('Error fetching results:', error);
        res.json([]);
    }
});

// Save university settings
app.post('/api/university-settings', async (req, res) => {
    try {
        const { academicYear, currentSemester } = req.body;
        const userEmail = req.headers['x-user-email'];
        
        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);

        // Create settings table if not exists
        await uniDB.execute(`
            CREATE TABLE IF NOT EXISTS university_settings (
                id INT PRIMARY KEY DEFAULT 1,
                academicYear VARCHAR(50),
                currentSemester VARCHAR(100),
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Check if settings exist
        const [existing] = await uniDB.execute('SELECT id FROM university_settings WHERE id = 1');

        if (existing.length > 0) {
            // Update
            await uniDB.execute(
                'UPDATE university_settings SET academicYear = ?, currentSemester = ? WHERE id = 1',
                [academicYear, currentSemester]
            );
        } else {
            // Insert
            await uniDB.execute(
                'INSERT INTO university_settings (id, academicYear, currentSemester) VALUES (1, ?, ?)',
                [academicYear, currentSemester]
            );
        }

        console.log(`✅ Saved university settings for ${dbInfo.databaseName}`);
        res.json({ message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Error saving university settings:', error);
        res.status(500).json({ error: 'Failed to save settings', message: error.message });
    }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Debug endpoint: Check database credentials
app.get('/api/debug/database-info', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        
        if (!userEmail) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ message: 'University Super Admin access required' });
        }

        // Get database connection details (use pool directly)
        const [dbConfig] = await pool.execute(
            'SELECT id, databaseName, host, port, username, description FROM database_connections WHERE databaseName = ?',
            [dbInfo.databaseName]
        );

        // Get university details
        const [uniDetails] = await pool.execute(
            'SELECT id, universityName, universityCode, databaseName, superAdminEmail FROM universities WHERE databaseName = ?',
            [dbInfo.databaseName]
        );

        res.json({
            university: uniDetails[0] || null,
            databaseConnection: dbConfig[0] || null,
            databaseName: dbInfo.databaseName
        });
    } catch (error) {
        console.error('Error fetching debug info:', error);
        res.status(500).json({ message: error.message });
    }
});

// Utility endpoint: Run migrations on existing university database
app.post('/api/run-migrations', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        
        if (!userEmail) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const dbInfo = await dbManager.getDatabaseForUser(userEmail);
        
        if (!dbInfo || dbInfo.type !== 'university') {
            return res.status(403).json({ message: 'University Super Admin access required' });
        }

        const uniDB = await dbManager.getUniversityConnection(dbInfo.databaseName);
        
        // Import university schema
        const universitySchema = require('./migrations/university-schema');
        
        // Run migrations
        await universitySchema.runMigrations(uniDB);
        
        // CRITICAL: Close and reopen connection to refresh schema cache
        console.log('🔄 Refreshing database connection...');
        await dbManager.closeUniversityConnection(dbInfo.databaseName);
        await dbManager.getUniversityConnection(dbInfo.databaseName);
        console.log('✅ Database connection refreshed!');
        
        console.log(`✅ Migrations completed for: ${dbInfo.databaseName}`);
        res.json({ message: 'Migrations completed successfully', database: dbInfo.databaseName });
    } catch (error) {
        console.error('Error running migrations:', error);
        res.status(500).json({ message: error.message || 'Failed to run migrations' });
    }
});

// Start server
async function startServer() {
    try {
        console.log('🚀 Starting OBE Portal - Multi-University SaaS Platform...');
        console.log(`📊 Platform Database: ${platformDbConfig.host}:${platformDbConfig.port}/${platformDbConfig.database}`);
        console.log(`🏛️  Architecture: Separate database per university`);
        
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log(`🌐 Server running on ${baseUrl}`);
            console.log(`🔑 Login: ${baseUrl}/login`);
            console.log(`📊 Dashboard: ${baseUrl}/dashboard`);
            
            if (isProduction) {
                console.log(`🚀 Production mode: ${baseUrl}`);
            } else {
                console.log('\n👑 PRO Super Admin (Platform Management):');
                console.log('   Email: pro@obe.org.pk');
                console.log('   Password: proadmin123');
                console.log('   Access: Manage all universities\n');
                
                console.log('📝 NOTE: No demo accounts created.');
                console.log('   Use PRO admin to create universities and their super admins.\n');
            }
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await dbManager.closeAll();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down server...');
    await dbManager.closeAll();
    process.exit(0);
});

startServer().catch(console.error);