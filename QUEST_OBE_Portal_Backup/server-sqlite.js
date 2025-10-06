const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Production environment detection
const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = isProduction ? 'https://your-domain.com' : `http://localhost:${PORT}`;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// File upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// SQLite Database Configuration
const dbPath = path.join(__dirname, 'quest_database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// Database initialization with CQI tables
async function initializeDatabase() {
    try {
        console.log('🔧 Initializing database tables...');
        
        // Create users table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                name TEXT NOT NULL,
                employeeId TEXT,
                studentId TEXT,
                department TEXT,
                semester TEXT,
                batch TEXT,
                designation TEXT,
                subjects TEXT,
                permissions TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create courses table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                credits INTEGER NOT NULL,
                department TEXT NOT NULL,
                semester TEXT NOT NULL,
                teacherId INTEGER,
                description TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (teacherId) REFERENCES users (id)
            )
        `);

        // Create CLOs table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS clos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                courseId INTEGER NOT NULL,
                code TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (courseId) REFERENCES courses (id)
            )
        `);

        // Create assessments table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                courseId INTEGER NOT NULL,
                assessmentType TEXT NOT NULL,
                dueDate DATE,
                totalMarks INTEGER NOT NULL,
                description TEXT,
                createdBy INTEGER NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (courseId) REFERENCES courses (id),
                FOREIGN KEY (createdBy) REFERENCES users (id)
            )
        `);

        // Create assessment questions table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS assessment_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assessmentId INTEGER NOT NULL,
                questionText TEXT NOT NULL,
                maxMarks INTEGER NOT NULL,
                cloId INTEGER,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assessmentId) REFERENCES assessments (id),
                FOREIGN KEY (cloId) REFERENCES clos (id)
            )
        `);

        // Create results table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assessmentId INTEGER NOT NULL,
                studentId INTEGER NOT NULL,
                marks INTEGER NOT NULL,
                grade TEXT,
                percentage REAL,
                uploadedBy INTEGER NOT NULL,
                uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assessmentId) REFERENCES assessments (id),
                FOREIGN KEY (studentId) REFERENCES users (id),
                FOREIGN KEY (uploadedBy) REFERENCES users (id)
            )
        `);

        // Create CLO attainment table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS clo_attainment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cloId INTEGER NOT NULL,
                courseId INTEGER NOT NULL,
                studentId INTEGER NOT NULL,
                semester TEXT NOT NULL,
                year TEXT NOT NULL,
                attainment REAL NOT NULL,
                calculatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cloId) REFERENCES clos (id),
                FOREIGN KEY (courseId) REFERENCES courses (id),
                FOREIGN KEY (studentId) REFERENCES users (id)
            )
        `);

        // Create CQI actions table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS cqi_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cloId INTEGER NOT NULL,
                courseId INTEGER NOT NULL,
                semester TEXT NOT NULL,
                year TEXT NOT NULL,
                actionType TEXT NOT NULL,
                description TEXT NOT NULL,
                reason TEXT,
                targetDate DATE,
                responsiblePerson TEXT,
                priority TEXT DEFAULT 'Medium',
                status TEXT DEFAULT 'Pending',
                createdBy INTEGER NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cloId) REFERENCES clos (id),
                FOREIGN KEY (courseId) REFERENCES courses (id),
                FOREIGN KEY (createdBy) REFERENCES users (id)
            )
        `);

        // Create attendance table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                courseId INTEGER NOT NULL,
                studentId INTEGER NOT NULL,
                date DATE NOT NULL,
                status TEXT NOT NULL,
                uploadedBy INTEGER NOT NULL,
                uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (courseId) REFERENCES courses (id),
                FOREIGN KEY (studentId) REFERENCES users (id),
                FOREIGN KEY (uploadedBy) REFERENCES users (id)
            )
        `);

        console.log('✅ Database tables created successfully');
        
        // Create default data
        await createDefaultUsers();
        await createDefaultOBEData();
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        throw error;
    }
}

// Helper function to run SQLite queries
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

// Helper function to get SQLite query results
function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Create default users
async function createDefaultUsers() {
    const users = [
        {
            email: 'admin@quest.edu.pk',
            password: await bcrypt.hash('admin123', 12),
            role: 'superadmin',
            name: 'System Administrator',
            employeeId: 'ADMIN001',
            department: 'IT',
            designation: 'System Administrator'
        },
        {
            email: 'teacher@quest.edu.pk',
            password: await bcrypt.hash('pass', 12),
            role: 'teacher',
            name: 'Dr. Ahmad Ali',
            employeeId: 'TCH001',
            department: 'Computer Science',
            designation: 'Assistant Professor',
            subjects: 'CS-301,CS-302,CS-401'
        },
        {
            email: 'student@quest.edu.pk',
            password: await bcrypt.hash('pass', 12),
            role: 'student',
            name: 'Muhammad Hassan',
            studentId: 'QUEST-2024-001',
            department: 'Computer Science',
            semester: '7th',
            batch: '2024'
        },
        {
            email: 'focal@quest.edu.pk',
            password: await bcrypt.hash('pass', 12),
            role: 'focal',
            name: 'Dr. Sara Khan',
            employeeId: 'FOCAL001',
            department: 'Computer Science',
            designation: 'Focal Person'
        }
    ];

    for (const userData of users) {
        try {
            await runQuery(`
                INSERT OR IGNORE INTO users (email, password, role, name, employeeId, studentId, department, semester, batch, designation, subjects)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userData.email, userData.password, userData.role, userData.name,
                userData.employeeId, userData.studentId, userData.department,
                userData.semester, userData.batch, userData.designation, userData.subjects
            ]);
        } catch (error) {
            console.error(`❌ Error creating user ${userData.email}:`, error.message);
        }
    }
}

// Create default OBE data
async function createDefaultOBEData() {
    // Create sample courses
    const courses = [
        {
            code: 'CS-301',
            name: 'Data Structures',
            credits: 3,
            department: 'Computer Science',
            semester: '5th',
            teacherId: 2,
            description: 'Introduction to data structures and algorithms'
        },
        {
            code: 'CS-302',
            name: 'Algorithms',
            credits: 3,
            department: 'Computer Science',
            semester: '5th',
            teacherId: 2,
            description: 'Algorithm design and analysis'
        },
        {
            code: 'CS-401',
            name: 'Database Systems',
            credits: 3,
            department: 'Computer Science',
            semester: '7th',
            teacherId: 2,
            description: 'Database design and management'
        }
    ];

    for (const courseData of courses) {
        try {
            const result = await runQuery(`
                INSERT OR IGNORE INTO courses (code, name, credits, department, semester, teacherId, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                courseData.code, courseData.name, courseData.credits,
                courseData.department, courseData.semester, courseData.teacherId, courseData.description
            ]);

            // Create CLOs for each course
            const courseId = result.id;
            const clos = [
                { code: 'CLO1', title: 'Understand basic data structures', description: 'Students will understand arrays, linked lists, stacks, and queues' },
                { code: 'CLO2', title: 'Implement data structures', description: 'Students will implement various data structures in programming' },
                { code: 'CLO3', title: 'Analyze algorithm complexity', description: 'Students will analyze time and space complexity of algorithms' }
            ];

            for (const clo of clos) {
                await runQuery(`
                    INSERT OR IGNORE INTO clos (courseId, code, title, description)
                    VALUES (?, ?, ?, ?)
                `, [courseId, clo.code, clo.title, clo.description]);
            }
        } catch (error) {
            console.error(`❌ Error creating course ${courseData.code}:`, error.message);
        }
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authentication route
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const users = await getQuery('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024',
            { expiresIn: process.env.JWT_EXPIRE || '24h' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                department: user.department,
                employeeId: user.employeeId,
                studentId: user.studentId
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const users = await getQuery('SELECT id, email, role, name, employeeId, studentId, department, semester, batch, designation, subjects, permissions, createdAt FROM users');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get all courses
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await getQuery('SELECT * FROM courses');
        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Get courses by teacher
app.get('/api/courses/teacher', async (req, res) => {
    try {
        const courses = await getQuery(`
            SELECT c.*, u.name as teacherName 
            FROM courses c 
            LEFT JOIN users u ON c.teacherId = u.id 
            WHERE c.teacherId = ?
        `, [req.query.teacherId || 2]);
        res.json({ success: true, data: { courses } });
    } catch (error) {
        console.error('Error fetching teacher courses:', error);
        res.status(500).json({ error: 'Failed to fetch teacher courses' });
    }
});

// Get all CLOs
app.get('/api/clos', async (req, res) => {
    try {
        const clos = await getQuery(`
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
        const assessments = await getQuery(`
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

// Create assessment
app.post('/api/assessments', async (req, res) => {
    try {
        const { name, courseId, assessmentType, dueDate, totalMarks, description, createdBy, questions } = req.body;
        
        const result = await runQuery(`
            INSERT INTO assessments (name, courseId, assessmentType, dueDate, totalMarks, description, createdBy)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [name, courseId, assessmentType, dueDate, totalMarks, description, createdBy]);
        
        const assessmentId = result.id;
        
        // Insert questions
        if (questions && questions.length > 0) {
            for (const question of questions) {
                await runQuery(`
                    INSERT INTO assessment_questions (assessmentId, questionText, maxMarks, cloId)
                    VALUES (?, ?, ?, ?)
                `, [assessmentId, question.questionText, question.maxMarks, question.cloId]);
            }
        }
        
        res.json({ success: true, assessmentId });
        
    } catch (error) {
        console.error('Error creating assessment:', error);
        res.status(500).json({ error: 'Failed to create assessment' });
    }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Start server
async function startServer() {
    try {
        console.log('🚀 Starting QUEST OBE Portal with SQLite Database...');
        
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log(`🌐 Server running on ${baseUrl}`);
            console.log(`🔑 Login: ${baseUrl}/login`);
            console.log(`📊 Dashboard: ${baseUrl}/dashboard`);
            console.log(`💾 Database: SQLite (${dbPath})`);
            
            if (isProduction) {
                console.log(`🚀 Production mode: ${baseUrl}`);
            } else {
                console.log('\n💡 Test Accounts:');
                console.log('   Admin: admin@quest.edu.pk / admin123');
                console.log('   Student: student@quest.edu.pk / pass');
                console.log('   Teacher: teacher@quest.edu.pk / pass');
                console.log('   Focal Person: focal@quest.edu.pk / pass');
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('✅ Database connection closed');
        }
    });
    process.exit(0);
});

startServer().catch(console.error);
