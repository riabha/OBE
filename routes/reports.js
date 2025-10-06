const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'mysql.gb.stackcp.com',
    port: process.env.DB_PORT || 39558,
    user: process.env.DB_USER || 'questobe',
    password: process.env.DB_PASSWORD || 'Quest123@',
    database: process.env.DB_NAME || 'questobe-35313139c836'
};

// Helper function to get database connection
async function getConnection() {
    try {
        return await mysql.createConnection(dbConfig);
    } catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
}

// Helper function to execute query
async function executeQuery(query, params = []) {
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute(query, params);
        return rows;
    } finally {
        await connection.end();
    }
}

// ==================== REPORT FILTERS ====================

// Get academic years
router.get('/academic-years', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT academic_year as value, 
                   CONCAT('Academic Year ', academic_year) as text
            FROM courses 
            ORDER BY academic_year DESC
        `;
        const years = await executeQuery(query);
        res.json(years);
    } catch (error) {
        console.error('Error fetching academic years:', error);
        res.status(500).json({ error: 'Failed to fetch academic years' });
    }
});

// Get courses
router.get('/courses', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT course_code as value, 
                   CONCAT(course_code, ' - ', course_name) as text
            FROM courses 
            ORDER BY course_code
        `;
        const courses = await executeQuery(query);
        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Get students
router.get('/students', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT student_id as value, 
                   CONCAT(student_id, ' - ', student_name) as text
            FROM students 
            ORDER BY student_name
        `;
        const students = await executeQuery(query);
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// ==================== STUDENT WISE REPORTS ====================

// Generate Semester Report
router.post('/semester', async (req, res) => {
    try {
        const { academicYear, semester, course, student, startDate, endDate } = req.body;
        
        let query = `
            SELECT 
                s.student_id as id,
                s.student_name as name,
                c.course_code as course,
                a.midterm_score as midterm,
                a.final_score as final,
                a.assignment_score as assignments,
                (a.midterm_score + a.final_score + a.assignment_score) as total,
                CASE 
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 90 THEN 'A'
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 80 THEN 'B'
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 70 THEN 'C'
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 60 THEN 'D'
                    ELSE 'F'
                END as grade,
                ROUND(((a.midterm_score + a.final_score + a.assignment_score) / 100) * 4, 2) as gpa,
                COALESCE(att.attendance_percentage, 85) as attendance
            FROM students s
            JOIN assessments a ON s.student_id = a.student_id
            JOIN courses c ON a.course_id = c.course_id
            LEFT JOIN attendance att ON s.student_id = att.student_id AND c.course_id = att.course_id
            WHERE c.academic_year = ? AND c.semester = ?
        `;
        
        const params = [academicYear, semester];
        
        if (course !== 'all') {
            query += ' AND c.course_code = ?';
            params.push(course);
        }
        
        if (student !== 'all') {
            query += ' AND s.student_id = ?';
            params.push(student);
        }
        
        query += ' ORDER BY s.student_name';
        
        const students = await executeQuery(query, params);
        
        // Calculate grade distribution
        const gradeDistribution = calculateGradeDistribution(students);
        
        // Calculate attendance data
        const attendanceData = calculateAttendanceData(students);
        
        res.json({
            students,
            gradeDistribution,
            attendanceData,
            summary: {
                totalStudents: students.length,
                averageGPA: students.reduce((sum, s) => sum + s.gpa, 0) / students.length,
                averageAttendance: students.reduce((sum, s) => sum + s.attendance, 0) / students.length
            }
        });
        
    } catch (error) {
        console.error('Error generating semester report:', error);
        res.status(500).json({ error: 'Failed to generate semester report' });
    }
});

// Generate GPA Transcript
router.post('/gpa-transcript', async (req, res) => {
    try {
        const { student } = req.body;
        
        if (student === 'all') {
            return res.status(400).json({ error: 'Student must be specified for GPA transcript' });
        }
        
        const query = `
            SELECT 
                s.student_name as studentName,
                c.academic_year,
                c.semester,
                c.course_code as code,
                c.course_name as name,
                c.credits,
                CASE 
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 90 THEN 'A'
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 80 THEN 'B'
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 70 THEN 'C'
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 60 THEN 'D'
                    ELSE 'F'
                END as grade,
                ROUND(((a.midterm_score + a.final_score + a.assignment_score) / 100) * 4, 2) as gpaPoints,
                CASE 
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 60 THEN 'Completed'
                    ELSE 'Failed'
                END as status
            FROM students s
            JOIN assessments a ON s.student_id = a.student_id
            JOIN courses c ON a.course_id = c.course_id
            WHERE s.student_id = ?
            ORDER BY c.academic_year DESC, c.semester DESC
        `;
        
        const courses = await executeQuery(query, [student]);
        
        if (courses.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        const studentName = courses[0].studentName;
        const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);
        const completedCourses = courses.filter(course => course.status === 'Completed').length;
        const overallGPA = courses.reduce((sum, course) => sum + course.gpaPoints, 0) / courses.length;
        
        // Generate GPA history
        const gpaHistory = generateGPAHistory(courses);
        
        res.json({
            studentName,
            overallGPA: overallGPA.toFixed(2),
            totalCredits,
            completedCourses,
            courses,
            gpaHistory
        });
        
    } catch (error) {
        console.error('Error generating GPA transcript:', error);
        res.status(500).json({ error: 'Failed to generate GPA transcript' });
    }
});

// Generate OBE Transcript
router.post('/obe-transcript', async (req, res) => {
    try {
        const { student } = req.body;
        
        if (student === 'all') {
            return res.status(400).json({ error: 'Student must be specified for OBE transcript' });
        }
        
        // Get CLO attainment
        const cloQuery = `
            SELECT 
                clo.clo_code as code,
                clo.description,
                COALESCE(oa.attainment_level, 0) as attainment
            FROM clos clo
            LEFT JOIN outcome_attainments oa ON clo.clo_id = oa.clo_id AND oa.student_id = ?
            ORDER BY clo.clo_code
        `;
        
        const clos = await executeQuery(cloQuery, [student]);
        
        // Get PLO attainment
        const ploQuery = `
            SELECT 
                plo.plo_code as code,
                plo.description,
                COALESCE(oa.attainment_level, 0) as attainment
            FROM plos plo
            LEFT JOIN outcome_attainments oa ON plo.plo_id = oa.plo_id AND oa.student_id = ?
            ORDER BY plo.plo_code
        `;
        
        const plos = await executeQuery(ploQuery, [student]);
        
        // Get student name
        const studentQuery = 'SELECT student_name FROM students WHERE student_id = ?';
        const studentResult = await executeQuery(studentQuery, [student]);
        const studentName = studentResult[0]?.student_name || 'Unknown Student';
        
        res.json({
            studentName,
            clos,
            plos
        });
        
    } catch (error) {
        console.error('Error generating OBE transcript:', error);
        res.status(500).json({ error: 'Failed to generate OBE transcript' });
    }
});

// ==================== COURSE WISE REPORTS ====================

// Generate Course CLO Attainment
router.post('/course-clo-attainment', async (req, res) => {
    try {
        const { course, academicYear, semester } = req.body;
        
        if (course === 'all') {
            return res.status(400).json({ error: 'Course must be specified for CLO attainment report' });
        }
        
        // Get course information
        const courseQuery = `
            SELECT 
                c.course_code,
                c.course_name,
                c.instructor_name,
                c.semester,
                c.academic_year,
                COUNT(DISTINCT s.student_id) as totalStudents
            FROM courses c
            LEFT JOIN assessments a ON c.course_id = a.course_id
            LEFT JOIN students s ON a.student_id = s.student_id
            WHERE c.course_code = ? AND c.academic_year = ? AND c.semester = ?
            GROUP BY c.course_id
        `;
        
        const courseInfo = await executeQuery(courseQuery, [course, academicYear, semester]);
        
        if (courseInfo.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }
        
        const courseData = courseInfo[0];
        
        // Get CLO attainment data
        const cloQuery = `
            SELECT 
                clo.clo_code as code,
                clo.description,
                clo.assessment_method as assessmentMethod,
                clo.target_attainment as target,
                COALESCE(AVG(oa.attainment_level), 0) as actual,
                COUNT(CASE WHEN oa.attainment_level >= clo.target_attainment THEN 1 END) as studentsAchieved
            FROM clos clo
            LEFT JOIN outcome_attainments oa ON clo.clo_id = oa.clo_id
            LEFT JOIN assessments a ON oa.assessment_id = a.assessment_id
            LEFT JOIN courses c ON a.course_id = c.course_id
            WHERE c.course_code = ? AND c.academic_year = ? AND c.semester = ?
            GROUP BY clo.clo_id
            ORDER BY clo.clo_code
        `;
        
        const clos = await executeQuery(cloQuery, [course, academicYear, semester]);
        
        // Get student performance data
        const studentPerformanceQuery = `
            SELECT 
                s.student_id,
                s.student_name,
                COALESCE(att.attendance_percentage, 85) as attendance,
                CASE 
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 90 THEN 4.0
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 80 THEN 3.0
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 70 THEN 2.0
                    WHEN (a.midterm_score + a.final_score + a.assignment_score) >= 60 THEN 1.0
                    ELSE 0.0
                END as grade
            FROM students s
            JOIN assessments a ON s.student_id = a.student_id
            JOIN courses c ON a.course_id = c.course_id
            LEFT JOIN attendance att ON s.student_id = att.student_id AND c.course_id = att.course_id
            WHERE c.course_code = ? AND c.academic_year = ? AND c.semester = ?
            ORDER BY s.student_name
        `;
        
        const studentPerformance = await executeQuery(studentPerformanceQuery, [course, academicYear, semester]);
        
        res.json({
            courseName: `${courseData.course_code} - ${courseData.course_name}`,
            courseCode: courseData.course_code,
            instructor: courseData.instructor_name,
            semester: courseData.semester,
            academicYear: courseData.academic_year,
            totalStudents: courseData.totalStudents,
            clos,
            studentPerformance
        });
        
    } catch (error) {
        console.error('Error generating course CLO attainment:', error);
        res.status(500).json({ error: 'Failed to generate course CLO attainment report' });
    }
});

// ==================== OBE MAPPING REPORTS ====================

// Generate Vision & Mission Report
router.post('/vision-mission', async (req, res) => {
    try {
        // Get institutional vision and mission
        const visionMissionQuery = `
            SELECT 
                vision_statement as vision,
                mission_statement as mission
            FROM institutional_info
            LIMIT 1
        `;
        
        const visionMission = await executeQuery(visionMissionQuery);
        
        if (visionMission.length === 0) {
            // Return default values if no data exists
            return res.json({
                vision: "To be a leading institution in providing quality education and research.",
                mission: "To provide excellent education and develop competent professionals.",
                visionAlignment: 85,
                missionAlignment: 90,
                peos: [
                    {
                        code: "PEO1",
                        description: "Graduates will be successful professionals",
                        visionAlignment: 90,
                        missionAlignment: 85,
                        overallAlignment: 87.5
                    },
                    {
                        code: "PEO2",
                        description: "Graduates will contribute to society",
                        visionAlignment: 80,
                        missionAlignment: 95,
                        overallAlignment: 87.5
                    }
                ]
            });
        }
        
        const data = visionMission[0];
        
        // Get PEOs with alignment data
        const peoQuery = `
            SELECT 
                peo_code as code,
                description,
                vision_alignment as visionAlignment,
                mission_alignment as missionAlignment,
                (vision_alignment + mission_alignment) / 2 as overallAlignment
            FROM peos
            ORDER BY peo_code
        `;
        
        const peos = await executeQuery(peoQuery);
        
        res.json({
            vision: data.vision,
            mission: data.mission,
            visionAlignment: 85,
            missionAlignment: 90,
            peos
        });
        
    } catch (error) {
        console.error('Error generating vision & mission report:', error);
        res.status(500).json({ error: 'Failed to generate vision & mission report' });
    }
});

// ==================== HELPER FUNCTIONS ====================

// Calculate grade distribution
function calculateGradeDistribution(students) {
    const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    
    students.forEach(student => {
        distribution[student.grade]++;
    });
    
    return {
        labels: Object.keys(distribution),
        values: Object.values(distribution)
    };
}

// Calculate attendance data
function calculateAttendanceData(students) {
    const attendanceRanges = {
        '90-100%': 0,
        '80-89%': 0,
        '70-79%': 0,
        '60-69%': 0,
        'Below 60%': 0
    };
    
    students.forEach(student => {
        const attendance = student.attendance;
        if (attendance >= 90) attendanceRanges['90-100%']++;
        else if (attendance >= 80) attendanceRanges['80-89%']++;
        else if (attendance >= 70) attendanceRanges['70-79%']++;
        else if (attendance >= 60) attendanceRanges['60-69%']++;
        else attendanceRanges['Below 60%']++;
    });
    
    return {
        labels: Object.keys(attendanceRanges),
        values: Object.values(attendanceRanges)
    };
}

// Generate GPA history
function generateGPAHistory(courses) {
    const semesterGPA = {};
    
    courses.forEach(course => {
        const key = `${course.academic_year} ${course.semester}`;
        if (!semesterGPA[key]) {
            semesterGPA[key] = { total: 0, count: 0 };
        }
        semesterGPA[key].total += course.gpaPoints;
        semesterGPA[key].count++;
    });
    
    const labels = Object.keys(semesterGPA).sort();
    const values = labels.map(label => 
        (semesterGPA[label].total / semesterGPA[label].count).toFixed(2)
    );
    
    return { labels, values };
}

module.exports = router;