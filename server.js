const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
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

// Include routes
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);

// CORS configuration for production
if (isProduction) {
    const cors = require('cors');
    app.use(cors({
        origin: process.env.CORS_ORIGIN || baseUrl,
        credentials: true
    }));
}

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

// Database Configuration
const dbConfig = {
    host: process.env.DB_HOST || 'mysql.gb.stackcp.com',
    port: process.env.DB_PORT || 39558,
    user: process.env.DB_USER || 'questobe',
    password: process.env.DB_PASSWORD || 'Quest123@',
    database: process.env.DB_NAME || 'questobe-35313139c836',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: false
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Database initialization with CQI tables
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // Create existing tables if they don't exist
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                employeeId VARCHAR(100),
                studentId VARCHAR(100),
                department VARCHAR(100),
                semester VARCHAR(50),
                batch VARCHAR(50),
                designation VARCHAR(100),
                subjects TEXT,
                permissions TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                credits INT NOT NULL,
                department VARCHAR(100) NOT NULL,
                semester VARCHAR(50) NOT NULL,
                description TEXT,
                sections INT DEFAULT 0,
                students INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'Active',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS clos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                courseId INT NOT NULL,
                code VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                bloomLevel VARCHAR(50) NOT NULL,
                assessmentMethod VARCHAR(100) NOT NULL,
                weight DECIMAL(5,2),
                status VARCHAR(50) DEFAULT 'Active',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
            )
        `);

        // Enhanced Assessment table with question-CLO linking
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS assessments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                courseId INT NOT NULL,
                assessmentType VARCHAR(100) NOT NULL,
                dueDate DATE,
                totalMarks INT NOT NULL,
                description TEXT,
                createdBy INT NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                status VARCHAR(50) DEFAULT 'Active',
                FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
                FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Assessment Questions table for CLO linking
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS assessment_questions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                assessmentId INT NOT NULL,
                questionNumber INT NOT NULL,
                questionText TEXT,
                maxMarks DECIMAL(5,2) NOT NULL,
                cloId INT NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assessmentId) REFERENCES assessments(id) ON DELETE CASCADE,
                FOREIGN KEY (cloId) REFERENCES clos(id) ON DELETE CASCADE
            )
        `);

        // Enhanced Results table with question-wise scores
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                studentId VARCHAR(100) NOT NULL,
                assessmentId INT NOT NULL,
                courseId INT NOT NULL,
                semester VARCHAR(50) NOT NULL,
                year VARCHAR(50) NOT NULL,
                questionScores TEXT NOT NULL,
                totalScore DECIMAL(5,2) NOT NULL,
                percentage DECIMAL(5,2) NOT NULL,
                grade VARCHAR(10),
                uploadedBy INT NOT NULL,
                uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assessmentId) REFERENCES assessments(id) ON DELETE CASCADE,
                FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
                FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // CLO Attainment table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS clo_attainment (
                id INT AUTO_INCREMENT PRIMARY KEY,
                studentId VARCHAR(100) NOT NULL,
                cloId INT NOT NULL,
                courseId INT NOT NULL,
                semester VARCHAR(50) NOT NULL,
                year VARCHAR(50) NOT NULL,
                totalMarks DECIMAL(5,2) NOT NULL,
                obtainedMarks DECIMAL(5,2) NOT NULL,
                attainmentPercentage DECIMAL(5,2) NOT NULL,
                isAttained BOOLEAN DEFAULT FALSE,
                calculatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cloId) REFERENCES clos(id) ON DELETE CASCADE,
                FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
            )
        `);

        // CQI Actions table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS cqi_actions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cloId INT NOT NULL,
                courseId INT NOT NULL,
                semester VARCHAR(50) NOT NULL,
                year VARCHAR(50) NOT NULL,
                actionType ENUM('Corrective', 'Preventive') NOT NULL,
                description TEXT NOT NULL,
                reason TEXT NOT NULL,
                targetDate DATE NOT NULL,
                responsiblePerson VARCHAR(255) NOT NULL,
                status ENUM('Open', 'In Progress', 'Closed') DEFAULT 'Open',
                priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
                createdBy INT NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (cloId) REFERENCES clos(id) ON DELETE CASCADE,
                FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
                FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Attendance table for fallback option
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                studentId VARCHAR(100) NOT NULL,
                courseId INT NOT NULL,
                semester VARCHAR(50) NOT NULL,
                year VARCHAR(50) NOT NULL,
                totalClasses INT NOT NULL,
                attendedClasses INT NOT NULL,
                attendancePercentage DECIMAL(5,2) NOT NULL,
                uploadedBy INT NOT NULL,
                uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
                FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Department Performance table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS department_performance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                department VARCHAR(100) NOT NULL,
                semester VARCHAR(50) NOT NULL,
                year VARCHAR(50) NOT NULL,
                totalCourses INT NOT NULL,
                totalStudents INT NOT NULL,
                averageAttainment DECIMAL(5,2) NOT NULL,
                cqiActionsCount INT DEFAULT 0,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        connection.release();
        console.log('✅ Enhanced database tables created successfully!');
        
        // Create default data
        await createDefaultUsers();
        await createDefaultOBEData();
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        console.log('🔄 Running in demo mode without database...');
    }
}

// Create default users
async function createDefaultUsers() {
    const users = [
        {
            email: 'admin@quest.edu.pk',
            password: await bcrypt.hash('admin123', 10),
            role: 'superadmin',
            name: 'System Administrator',
            employeeId: 'ADMIN-001',
            department: 'Administration',
            permissions: JSON.stringify(['all'])
        },
        {
            email: 'student@quest.edu.pk',
            password: await bcrypt.hash('pass', 10),
            role: 'student',
            name: 'Ahmad Ali',
            studentId: 'QUEST-2024-001',
            department: 'Computer Science',
            semester: '7th',
            batch: '2021'
        },
        {
            email: 'teacher@quest.edu.pk',
            password: await bcrypt.hash('pass', 10),
            role: 'teacher',
            name: 'Dr. Muhammad Hassan',
            employeeId: 'EMP-001',
            department: 'Computer Science',
            designation: 'Assistant Professor',
            subjects: JSON.stringify(['Data Structures', 'Algorithms'])
        },
        {
            email: 'focal@quest.edu.pk',
            password: await bcrypt.hash('pass', 10),
            role: 'focal',
            name: 'Dr. Fatima Sheikh',
            employeeId: 'EMP-003',
            department: 'Computer Science',
            designation: 'Assistant Professor'
        },
        {
            email: 'chairman@quest.edu.pk',
            password: await bcrypt.hash('pass', 10),
            role: 'chairman',
            name: 'Prof. Dr. Ali Raza',
            employeeId: 'EMP-005',
            department: 'Computer Science',
            designation: 'Professor & Chairman'
        },
        {
            email: 'dean@quest.edu.pk',
            password: await bcrypt.hash('pass', 10),
            role: 'dean',
            name: 'Prof. Dr. Zulfiqar Ali',
            employeeId: 'EMP-007',
            department: 'Engineering',
            designation: 'Dean of Engineering'
        },
        {
            email: 'controller@quest.edu.pk',
            password: await bcrypt.hash('pass', 10),
            role: 'controller',
            name: 'Dr. Khalid Mahmood',
            employeeId: 'EMP-008',
            department: 'Examination',
            designation: 'Controller of Examinations'
        }
    ];

    for (const userData of users) {
        try {
            const [existingUser] = await pool.execute(
                'SELECT id FROM users WHERE email = ?',
                [userData.email]
            );
            
            if (existingUser.length === 0) {
                await pool.execute(
                    `INSERT INTO users (email, password, role, name, employeeId, studentId, department, semester, batch, designation, subjects, permissions) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userData.email, userData.password, userData.role, userData.name,
                        userData.employeeId, userData.studentId, userData.department,
                        userData.semester, userData.batch, userData.designation,
                        userData.subjects, userData.permissions
                    ]
                );
                console.log(`✅ Created user: ${userData.email}`);
            }
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
            description: 'Introduction to data structures and algorithms'
        },
        {
            code: 'CS-302',
            name: 'Algorithms',
            credits: 3,
            department: 'Computer Science',
            semester: '6th',
            description: 'Algorithm design and analysis'
        }
    ];

    for (const courseData of courses) {
        try {
            const [existingCourse] = await pool.execute(
                'SELECT id FROM courses WHERE code = ?',
                [courseData.code]
            );
            
            if (existingCourse.length === 0) {
                const [result] = await pool.execute(
                    'INSERT INTO courses (code, name, credits, department, semester, description) VALUES (?, ?, ?, ?, ?, ?)',
                    [courseData.code, courseData.name, courseData.credits, courseData.department, courseData.semester, courseData.description]
                );
                
                // Create CLOs for this course
                const clos = [
                    {
                        courseId: result.insertId,
                        code: 'CLO1',
                        title: 'Data Structure Analysis',
                        description: 'Analyze and implement various data structures efficiently',
                        bloomLevel: 'Analyze',
                        assessmentMethod: 'Exams, Assignments',
                        weight: 30
                    },
                    {
                        courseId: result.insertId,
                        code: 'CLO2',
                        title: 'Algorithm Design',
                        description: 'Design algorithms for complex computational problems',
                        bloomLevel: 'Create',
                        assessmentMethod: 'Projects, Exams',
                        weight: 40
                    },
                    {
                        courseId: result.insertId,
                        code: 'CLO3',
                        title: 'Problem Solving',
                        description: 'Apply data structures to solve real-world problems',
                        bloomLevel: 'Apply',
                        assessmentMethod: 'Assignments, Labs',
                        weight: 30
                    }
                ];

                for (const cloData of clos) {
                    await pool.execute(
                        'INSERT INTO clos (courseId, code, title, description, bloomLevel, assessmentMethod, weight) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [cloData.courseId, cloData.code, cloData.title, cloData.description, cloData.bloomLevel, cloData.assessmentMethod, cloData.weight]
                    );
                }
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

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
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

// Get all existing API routes
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

app.get('/api/courses', async (req, res) => {
    try {
        const [courses] = await pool.execute('SELECT * FROM courses');
        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

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

// Dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Start server
async function startServer() {
    try {
        console.log('🚀 Starting QUEST OBE Portal with Enhanced CQI Integration...');
        console.log(`📊 Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
        
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log(`🌐 Server running on ${baseUrl}`);
            console.log(`🔑 Login: ${baseUrl}/login`);
            console.log(`📊 Dashboard: ${baseUrl}/dashboard`);
            
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
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await pool.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down server...');
    await pool.end();
    process.exit(0);
});

startServer().catch(console.error);