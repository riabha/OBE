// University Database Schema Migrations
// This schema will be applied to each new university database

const universitySchema = {
    // Create all tables for a university database
    async runMigrations(connection) {
        console.log('📋 Running schema migrations...');

        // 1. Users Table (University-specific users)
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
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_role (role),
                INDEX idx_email (email)
            )
        `);
        console.log('  ✅ users table');

        // 2. Courses Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                creditHours INT DEFAULT 3,
                department VARCHAR(100),
                level VARCHAR(50),
                prerequisite VARCHAR(100),
                instructor VARCHAR(255),
                description TEXT,
                semester VARCHAR(50),
                sections INT DEFAULT 0,
                students INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'Active',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_code (code),
                INDEX idx_department (department)
            )
        `);
        console.log('  ✅ courses table');

        // 3. CLOs Table
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
                FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
                INDEX idx_course (courseId)
            )
        `);
        console.log('  ✅ clos table');

        // 4. Assessments Table
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
                FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_course (courseId)
            )
        `);
        console.log('  ✅ assessments table');

        // 5. Assessment Questions Table
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
                FOREIGN KEY (cloId) REFERENCES clos(id) ON DELETE CASCADE,
                INDEX idx_assessment (assessmentId)
            )
        `);
        console.log('  ✅ assessment_questions table');

        // 6. Results Table
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
                FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_student (studentId),
                INDEX idx_assessment (assessmentId)
            )
        `);
        console.log('  ✅ results table');

        // 7. CLO Attainment Table
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
                FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
                INDEX idx_student (studentId),
                INDEX idx_clo (cloId)
            )
        `);
        console.log('  ✅ clo_attainment table');

        // 8. CQI Actions Table
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
                FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_clo (cloId),
                INDEX idx_course (courseId)
            )
        `);
        console.log('  ✅ cqi_actions table');

        // 9. Attendance Table
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
                FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_student (studentId),
                INDEX idx_course (courseId)
            )
        `);
        console.log('  ✅ attendance table');

        // 10. Department Performance Table
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
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_department (department)
            )
        `);
        console.log('  ✅ department_performance table');

        // 11. PLOs Table (Program Learning Outcomes)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS plos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                bloomLevel VARCHAR(50),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ plos table');

        // 12. PEOs Table (Program Educational Objectives)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS peos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ peos table');

        // 13. Faculties Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS faculties (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) UNIQUE NOT NULL,
                deanId INT,
                deanEmail VARCHAR(255),
                deanName VARCHAR(255),
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_code (code)
            )
        `);
        console.log('  ✅ faculties table');

        // 14. Departments Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS departments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) UNIQUE NOT NULL,
                head VARCHAR(255),
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_code (code)
            )
        `);
        
        // Add facultyId column if it doesn't exist (for existing databases)
        try {
            await connection.execute(`ALTER TABLE departments ADD COLUMN facultyId INT AFTER code`);
            console.log('    ↳ Added facultyId column');
        } catch (err) {
            // Column already exists - that's OK
            if (err.code !== 'ER_DUP_FIELDNAME') {
                console.log('    Note:', err.message);
            }
        }
        
        // Add index if it doesn't exist
        try {
            await connection.execute(`ALTER TABLE departments ADD INDEX idx_faculty (facultyId)`);
        } catch (err) {
            // Index might already exist
        }
        
        console.log('  ✅ departments table');

        // 15. Programs Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS programs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                level VARCHAR(50),
                duration VARCHAR(50),
                creditHours INT,
                department VARCHAR(100),
                coordinator VARCHAR(255),
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_code (code),
                INDEX idx_department (department)
            )
        `);
        console.log('  ✅ programs table');

        // 16. Batches Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS batches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                programId INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                year VARCHAR(50) NOT NULL,
                semester VARCHAR(50) NOT NULL,
                totalStudents INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'Active',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (programId) REFERENCES programs(id) ON DELETE CASCADE,
                INDEX idx_program (programId)
            )
        `);
        console.log('  ✅ batches table');

        // 17. University Settings Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS university_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                settingKey VARCHAR(100) UNIQUE NOT NULL,
                settingValue TEXT,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ university_settings table');

        console.log('✅ All schema migrations completed successfully!');
    }
};

module.exports = universitySchema;

