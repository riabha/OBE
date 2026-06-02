/**
 * Seed a full Demo University with real MongoDB-linked data.
 * Usage: node scripts/seed-demo-university.js
 *        node scripts/seed-demo-university.js --reset   (drop and recreate demo DB)
 */
require('dotenv').config({ path: './config.env' });
require('dotenv').config({ path: './.env', override: false });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const universitySchema = require('../models/University');
const platformUserSchema = require('../models/PlatformUser');
const Subscription = require('../models/Subscription');
const UserSchema = require('../models/User');
const DepartmentSchema = require('../models/Department');
const CourseSchema = require('../models/Course');

function getPlatformModels() {
    return {
        University: mongoose.models.University || mongoose.model('University', universitySchema),
        PlatformUser: mongoose.models.PlatformUser || mongoose.model('PlatformUser', platformUserSchema),
        Subscription
    };
}

const DEMO = {
    code: 'DEMO',
    name: 'Quest Demo University',
    dbName: 'obe_university_demo',
    city: 'Islamabad',
    superAdminEmail: 'demo@demo.com',
    superAdminPassword: 'Admin@DEMO2025',
    userPassword: 'Demo@2025'
};

const COLLECTIONS = [
    '_metadata', 'departments', 'users', 'courses', 'sections',
    'enrollments', 'assessments', 'results', 'clos', 'plos',
    'peos', 'programs', 'attainments', 'reports', 'settings'
];

function splitName(full) {
    const parts = full.trim().split(/\s+/);
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ') || parts[0]
    };
}

async function connect() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not set in config.env');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');
}

async function ensurePlatformRecords(University, PlatformUser, Subscription) {
    let university = await University.findOne({ universityCode: DEMO.code });
    if (!university) {
        university = await University.create({
            universityName: DEMO.name,
            universityCode: DEMO.code,
            databaseName: DEMO.dbName,
            city: DEMO.city,
            country: 'Pakistan',
            address: 'Sector H-8, Islamabad',
            contactEmail: 'info@demo.edu',
            contactPhone: '923001234567',
            website: 'https://demo.edu',
            superAdminEmail: DEMO.superAdminEmail,
            subscriptionPlan: 'Premium',
            subscriptionStatus: 'Active',
            isActive: true
        });
        console.log('Created DEMO university in platform DB');
    } else {
        university.universityName = DEMO.name;
        university.databaseName = DEMO.dbName;
        university.isActive = true;
        university.city = university.city || DEMO.city;
        await university.save();
        console.log('Updated existing DEMO university');
    }

    let superAdmin = await PlatformUser.findOne({ email: DEMO.superAdminEmail });
    const hashedAdmin = await bcrypt.hash(DEMO.superAdminPassword, 12);
    if (!superAdmin) {
        superAdmin = await PlatformUser.create({
            email: DEMO.superAdminEmail,
            password: hashedAdmin,
            name: `${DEMO.name} - Administrator`,
            role: 'university_superadmin',
            university: university._id,
            universityCode: DEMO.code,
            permissions: ['all'],
            isActive: true
        });
        console.log('Created university super admin');
    } else {
        superAdmin.university = university._id;
        superAdmin.universityCode = DEMO.code;
        superAdmin.isActive = true;
        await superAdmin.save();
        console.log('Updated university super admin');
    }

    const existingSub = await Subscription.findOne({ universityCode: DEMO.code });
    if (!existingSub) {
        await Subscription.create({
            university: university._id,
            universityCode: DEMO.code,
            planType: 'Premium',
            planName: 'Premium Plan',
            status: 'Active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        });
        console.log('Created subscription');
    }

    return university;
}

async function resetUniDb(uniDb) {
    const existing = await uniDb.db.listCollections().toArray();
    for (const col of existing) {
        await uniDb.collection(col.name).drop().catch(() => {});
    }
    for (const name of COLLECTIONS) {
        await uniDb.createCollection(name).catch(() => {});
    }
}

async function seedUniversityData(university, reset) {
    const uniDb = mongoose.connection.useDb(DEMO.dbName);
    if (reset) {
        console.log(`Resetting database: ${DEMO.dbName}`);
        await resetUniDb(uniDb);
    }

    const Department = uniDb.model('Department', DepartmentSchema);
    const User = uniDb.model('User', UserSchema);
    const Course = uniDb.model('Course', CourseSchema);

    const existingUsers = await User.countDocuments();
    if (existingUsers > 0 && !reset) {
        console.log('Demo university data already exists. Use --reset to recreate.');
        return { skipped: true };
    }
    if (existingUsers > 0 && reset) {
        await User.deleteMany({});
        await Department.deleteMany({});
        await Course.deleteMany({});
        for (const col of ['clos', 'plos', 'peos', 'programs', 'assessments', 'results', 'enrollments']) {
            await uniDb.collection(col).deleteMany({});
        }
    }

    const pwd = DEMO.userPassword;
    const academicYear = '2024-25';
    const semesterName = 'Fall';

    // --- Departments (inactive first, activate after chairman assigned) ---
    const deptDefs = [
        {
            name: 'Computer Science',
            code: 'CS',
            faculty: 'Engineering',
            program: { name: 'Bachelor of Computer Science', code: 'BCS' },
            contactEmail: 'cs@demo.edu'
        },
        {
            name: 'Software Engineering',
            code: 'SE',
            faculty: 'Engineering',
            program: { name: 'Bachelor of Software Engineering', code: 'BSE' },
            contactEmail: 'se@demo.edu'
        },
        {
            name: 'Business Administration',
            code: 'BA',
            faculty: 'Management',
            program: { name: 'Bachelor of Business Administration', code: 'BBA' },
            contactEmail: 'ba@demo.edu'
        }
    ];

    const departments = [];
    for (const d of deptDefs) {
        const dept = await Department.create({
            name: d.name,
            code: d.code,
            description: `${d.name} department at ${DEMO.name}`,
            faculty: d.faculty,
            contactInfo: { email: d.contactEmail, phone: '923001234567' },
            programs: [{
                name: d.program.name,
                code: d.program.code,
                level: 'Undergraduate',
                duration: 4,
                credits: 130,
                isActive: true
            }],
            isActive: false
        });
        departments.push({ ...d, doc: dept });
    }

    // --- Management & staff ---
    const dean = await User.create({
        ...splitName('Dr. Ahmed Hassan'),
        email: 'dean@demo.edu',
        password: pwd,
        role: 'dean',
        phone: '923001234501',
        assignedFaculties: departments.filter(d => d.faculty === 'Engineering').map(d => d.doc._id),
        designation: 'Dean of Engineering',
        qualification: 'PhD Computer Science',
        employeeId: 'DEAN001'
    });

    const controller = await User.create({
        ...splitName('Mr. Usman Khan'),
        email: 'controller@demo.edu',
        password: pwd,
        role: 'controller',
        phone: '923001234502',
        designation: 'Controller of Examinations',
        qualification: 'MSc Statistics',
        employeeId: 'CTRL001'
    });

    const chairmen = [];
    const focals = [];
    for (let i = 0; i < departments.length; i++) {
        const d = departments[i];
        const chairman = await User.create({
            ...splitName(`Dr. ${['Sara Malik', 'Imran Qureshi', 'Fatima Noor'][i]}`),
            email: `chairman.${d.code.toLowerCase()}@demo.edu`,
            password: pwd,
            role: 'chairman',
            department: d.doc._id,
            phone: `92300123450${3 + i}`,
            designation: 'Chairman',
            qualification: 'PhD',
            employeeId: `CHAIR${d.code}`,
            managedDepartments: [d.doc._id]
        });
        chairmen.push(chairman);

        const focal = await User.create({
            ...splitName(`Ms. ${['Ayesha Raza', 'Bilal Ahmed', 'Hina Shah'][i]}`),
            email: `focal.${d.code.toLowerCase()}@demo.edu`,
            password: pwd,
            role: 'focal',
            department: d.doc._id,
            phone: `92300123451${i}`,
            designation: 'OBE Focal Person',
            qualification: 'MPhil',
            employeeId: `FOCAL${d.code}`,
            assignedDepartments: [d.doc._id]
        });
        focals.push(focal);

        d.doc.chairman = chairman._id;
        d.doc.focalPersons = [{ user: focal._id, responsibilities: ['academic', 'examination'] }];
        d.doc.isActive = true;
        d.doc.statistics = { totalStudents: 0, totalTeachers: 0, totalCourses: 0, activePrograms: 1 };
        await d.doc.save();
    }

    const teachers = [];
    const teacherDefs = [
        { name: 'Dr. Ali Raza', email: 'ali.raza@demo.edu', dept: 0, emp: 'TCS001' },
        { name: 'Prof. Sana Iqbal', email: 'sana.iqbal@demo.edu', dept: 0, emp: 'TCS002' },
        { name: 'Dr. Kamran Siddiqui', email: 'kamran.siddiqui@demo.edu', dept: 1, emp: 'TSE001' },
        { name: 'Dr. Nadia Farooq', email: 'nadia.farooq@demo.edu', dept: 2, emp: 'TBA001' },
        { name: 'Mr. Hassan Mehmood', email: 'hassan.mehmood@demo.edu', dept: 0, emp: 'TCS003' }
    ];
    for (const t of teacherDefs) {
        teachers.push(await User.create({
            ...splitName(t.name),
            email: t.email,
            password: pwd,
            role: 'teacher',
            department: departments[t.dept].doc._id,
            phone: '923001234600',
            designation: 'Assistant Professor',
            qualification: 'PhD',
            employeeId: t.emp
        }));
    }

    const students = [];
    const studentDefs = [
        { name: 'Hamza Akram', email: 'hamza.akram@demo.edu', id: 'CS2021001', dept: 0, sem: 5, batch: '2021' },
        { name: 'Zainab Tariq', email: 'zainab.tariq@demo.edu', id: 'CS2021002', dept: 0, sem: 5, batch: '2021' },
        { name: 'Omar Farooq', email: 'omar.farooq@demo.edu', id: 'CS2021003', dept: 0, sem: 3, batch: '2022' },
        { name: 'Maryam Khalid', email: 'maryam.khalid@demo.edu', id: 'CS2021004', dept: 0, sem: 3, batch: '2022' },
        { name: 'Saad Hussain', email: 'saad.hussain@demo.edu', id: 'SE2021001', dept: 1, sem: 5, batch: '2021' },
        { name: 'Aisha Mahmood', email: 'aisha.mahmood@demo.edu', id: 'SE2021002', dept: 1, sem: 3, batch: '2022' },
        { name: 'Bilal Sheikh', email: 'bilal.sheikh@demo.edu', id: 'BA2021001', dept: 2, sem: 5, batch: '2021' },
        { name: 'Sana Javed', email: 'sana.javed@demo.edu', id: 'BA2021002', dept: 2, sem: 3, batch: '2022' },
        { name: 'Fahad Ali', email: 'fahad.ali@demo.edu', id: 'CS2022001', dept: 0, sem: 1, batch: '2024' },
        { name: 'Hira Naz', email: 'hira.naz@demo.edu', id: 'CS2022002', dept: 0, sem: 1, batch: '2024' },
        { name: 'Usman Ghani', email: 'usman.ghani@demo.edu', id: 'BA2022001', dept: 2, sem: 1, batch: '2024' },
        { name: 'Rabia Ansari', email: 'rabia.ansari@demo.edu', id: 'SE2022001', dept: 1, sem: 1, batch: '2024' }
    ];
    for (const s of studentDefs) {
        students.push(await User.create({
            ...splitName(s.name),
            email: s.email,
            password: pwd,
            role: 'student',
            department: departments[s.dept].doc._id,
            phone: '923001234700',
            studentId: s.id,
            semester: s.sem,
            batch: s.batch
        }));
    }

    // Update department statistics
    for (const d of departments) {
        d.doc.statistics.totalStudents = students.filter(s => s.department.equals(d.doc._id)).length;
        d.doc.statistics.totalTeachers = teachers.filter(t => t.department.equals(d.doc._id)).length;
        await d.doc.save();
    }

    // --- PLOs & PEOs ---
    const plos = [
        { code: 'PLO1', description: 'Apply knowledge of computing and mathematics to solve complex problems.', program: 'BCS', department: departments[0].doc._id, attainment: 74.2 },
        { code: 'PLO2', description: 'Design and evaluate solutions using modern engineering tools.', program: 'BCS', department: departments[0].doc._id, attainment: 71.5 },
        { code: 'PLO3', description: 'Communicate effectively in professional and technical contexts.', program: 'BBA', department: departments[2].doc._id, attainment: 78.0 },
        { code: 'PLO4', description: 'Demonstrate ethical and professional responsibility.', program: 'BSE', department: departments[1].doc._id, attainment: 69.8 }
    ];
    await uniDb.collection('plos').insertMany(plos.map(p => ({ ...p, isActive: true, createdAt: new Date() })));

    const peos = [
        { code: 'PEO1', description: 'Graduates excel in computing careers within 3-5 years.', program: 'BCS', department: departments[0].doc._id },
        { code: 'PEO2', description: 'Graduates pursue lifelong learning and graduate studies.', program: 'BCS', department: departments[0].doc._id },
        { code: 'PEO3', description: 'Graduates lead teams in business and entrepreneurial ventures.', program: 'BBA', department: departments[2].doc._id }
    ];
    await uniDb.collection('peos').insertMany(peos.map(p => ({ ...p, isActive: true, createdAt: new Date() })));

    await uniDb.collection('programs').insertMany(departments.map(d => ({
        name: d.program.name,
        code: d.program.code,
        department: d.doc._id,
        departmentCode: d.code,
        level: 'Undergraduate',
        duration: 4,
        credits: 130,
        isActive: true,
        createdAt: new Date()
    })));

    // --- Courses with enrollments, assessments, CLOs, results ---
    const courseDefs = [
        { title: 'Programming Fundamentals', code: 'CS101', dept: 0, teacher: 0, program: 'BCS', sem: 1, credits: 3 },
        { title: 'Data Structures & Algorithms', code: 'CS201', dept: 0, teacher: 1, program: 'BCS', sem: 3, credits: 3 },
        { title: 'Database Systems', code: 'CS301', dept: 0, teacher: 0, program: 'BCS', sem: 5, credits: 3 },
        { title: 'Software Engineering', code: 'CS401', dept: 0, teacher: 4, program: 'BCS', sem: 7, credits: 3 },
        { title: 'Introduction to Software Engineering', code: 'SE101', dept: 1, teacher: 2, program: 'BSE', sem: 1, credits: 3 },
        { title: 'Principles of Management', code: 'BA101', dept: 2, teacher: 3, program: 'BBA', sem: 1, credits: 3 },
        { title: 'Marketing Management', code: 'BA201', dept: 2, teacher: 3, program: 'BBA', sem: 3, credits: 3 }
    ];

    const csStudents = students.filter(s => s.department.equals(departments[0].doc._id));
    const seStudents = students.filter(s => s.department.equals(departments[1].doc._id));
    const baStudents = students.filter(s => s.department.equals(departments[2].doc._id));

    const gradeFromPct = (pct) => {
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
    };

    const courses = [];
    const allClos = [];
    const allAssessments = [];
    const allResults = [];

    for (const c of courseDefs) {
        const deptStudents = c.dept === 0 ? csStudents : c.dept === 1 ? seStudents : baStudents;
        const enrolled = deptStudents.slice(0, Math.min(6, deptStudents.length)).map((s, idx) => {
            const quiz = 15 + (idx * 3) % 10;
            const assignment = 20 + (idx * 4) % 15;
            const midterm = 30 + (idx * 5) % 20;
            const final = 35 + (idx * 2) % 25;
            const total = quiz + assignment + midterm + final;
            const pct = Math.min(100, Math.round((total / 100) * 100));
            return {
                student: s._id,
                enrollmentDate: new Date('2024-09-01'),
                status: pct >= 50 ? 'completed' : 'failed',
                totalMarks: total,
                percentage: pct,
                finalGrade: gradeFromPct(pct)
            };
        });

        const learningOutcomes = [
            { outcome: `Explain core concepts of ${c.title}`, level: 'Understand', weight: 25, isActive: true },
            { outcome: `Apply techniques taught in ${c.title} to practical problems`, level: 'Apply', weight: 35, isActive: true },
            { outcome: `Analyze and evaluate solutions in ${c.title}`, level: 'Analyze', weight: 40, isActive: true }
        ];

        const assessments = [
            { name: 'Quiz 1', type: 'Quiz', weight: 10, dueDate: new Date('2024-10-15'), maxMarks: 10, isActive: true },
            { name: 'Assignment 1', type: 'Assignment', weight: 20, dueDate: new Date('2024-11-01'), maxMarks: 20, isActive: true },
            { name: 'Midterm Exam', type: 'Midterm', weight: 30, dueDate: new Date('2024-11-20'), maxMarks: 30, isActive: true },
            { name: 'Final Exam', type: 'Final', weight: 40, dueDate: new Date('2024-12-15'), maxMarks: 40, isActive: true }
        ];

        const course = await Course.create({
            title: c.title,
            code: c.code,
            description: `${c.title} — ${semesterName} ${academicYear}`,
            department: departments[c.dept].doc._id,
            program: c.program,
            semester: c.sem,
            credits: c.credits,
            hours: { theory: c.credits, practical: 0, total: c.credits },
            instructor: teachers[c.teacher]._id,
            learningOutcomes,
            assessments,
            enrolledStudents: enrolled,
            schedule: { days: ['Monday', 'Wednesday'], time: { start: '09:00', end: '10:30' }, room: 'A-101' },
            academicYear,
            semesterName,
            isActive: true,
            statistics: {
                totalEnrolled: enrolled.length,
                totalCompleted: enrolled.filter(e => e.status === 'completed').length,
                averageGrade: enrolled.reduce((s, e) => s + e.percentage, 0) / (enrolled.length || 1),
                passRate: (enrolled.filter(e => e.percentage >= 50).length / (enrolled.length || 1)) * 100
            }
        });
        courses.push(course);

        learningOutcomes.forEach((lo, i) => {
            allClos.push({
                code: `${c.code}-CLO${i + 1}`,
                description: lo.outcome,
                course: course._id,
                courseCode: c.code,
                level: lo.level,
                weight: lo.weight,
                attainment: 65 + Math.random() * 25,
                isActive: true,
                createdAt: new Date()
            });
        });

        for (const a of assessments) {
            const assessmentDoc = {
                title: `${a.name} — ${c.code}`,
                name: a.name,
                course: course._id,
                courseCode: c.code,
                type: a.type,
                totalMarks: a.maxMarks,
                maxMarks: a.maxMarks,
                weightage: a.weight,
                weight: a.weight,
                dueDate: a.dueDate,
                isActive: true,
                createdAt: new Date()
            };
            allAssessments.push(assessmentDoc);
        }

        for (const en of enrolled) {
            const student = deptStudents.find(s => s._id.equals(en.student));
            const marks = [
                { name: 'Quiz 1', max: 10, obtained: Math.min(10, Math.round(en.totalMarks * 0.15)) },
                { name: 'Assignment 1', max: 20, obtained: Math.min(20, Math.round(en.totalMarks * 0.20)) },
                { name: 'Midterm Exam', max: 30, obtained: Math.min(30, Math.round(en.totalMarks * 0.30)) },
                { name: 'Final Exam', max: 40, obtained: Math.min(40, Math.round(en.totalMarks * 0.35)) }
            ];
            for (const m of marks) {
                allResults.push({
                    student: en.student,
                    studentId: student.studentId,
                    studentName: `${student.firstName} ${student.lastName}`,
                    course: course._id,
                    courseCode: c.code,
                    courseTitle: c.title,
                    assessmentName: m.name,
                    marksObtained: m.obtained,
                    maxMarks: m.max,
                    percentage: Math.round((m.obtained / m.max) * 100),
                    grade: gradeFromPct(Math.round((m.obtained / m.max) * 100)),
                    semester: semesterName,
                    academicYear,
                    createdAt: new Date()
                });
            }
        }

        departments[c.dept].doc.statistics.totalCourses += 1;
        await departments[c.dept].doc.save();
    }

    await uniDb.collection('clos').insertMany(allClos);
    await uniDb.collection('assessments').insertMany(allAssessments);
    await uniDb.collection('results').insertMany(allResults);

    await uniDb.collection('_metadata').insertOne({
        universityId: university._id,
        universityName: university.universityName,
        universityCode: university.universityCode,
        seededAt: new Date(),
        collections: COLLECTIONS,
        counts: {
            departments: departments.length,
            users: 1 + 1 + chairmen.length + focals.length + teachers.length + students.length,
            courses: courses.length,
            clos: allClos.length,
            plos: plos.length,
            assessments: allAssessments.length,
            results: allResults.length
        },
        version: '2.0'
    });

    return {
        departments: departments.length,
        users: 2 + chairmen.length + focals.length + teachers.length + students.length,
        courses: courses.length,
        clos: allClos.length,
        results: allResults.length
    };
}

function printCredentials() {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║           DEMO UNIVERSITY — LOGIN CREDENTIALS            ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log('University Super Admin:');
    console.log(`  ${DEMO.superAdminEmail} / ${DEMO.superAdminPassword}\n`);
    console.log(`All other roles use password: ${DEMO.userPassword}\n`);
    console.log('Management:');
    console.log('  dean@demo.edu              — Dean of Engineering');
    console.log('  controller@demo.edu        — Controller of Examinations');
    console.log('  chairman.cs@demo.edu       — Chairman, Computer Science');
    console.log('  chairman.se@demo.edu       — Chairman, Software Engineering');
    console.log('  chairman.ba@demo.edu       — Chairman, Business Administration');
    console.log('  focal.cs@demo.edu          — OBE Focal Person (CS)');
    console.log('  focal.se@demo.edu          — OBE Focal Person (SE)');
    console.log('  focal.ba@demo.edu          — OBE Focal Person (BA)\n');
    console.log('Teachers:');
    console.log('  ali.raza@demo.edu, sana.iqbal@demo.edu, kamran.siddiqui@demo.edu');
    console.log('  nadia.farooq@demo.edu, hassan.mehmood@demo.edu\n');
    console.log('Students (sample):');
    console.log('  hamza.akram@demo.edu, zainab.tariq@demo.edu, omar.farooq@demo.edu');
    console.log('  maryam.khalid@demo.edu, saad.hussain@demo.edu, bilal.sheikh@demo.edu\n');
    console.log(`Database: ${DEMO.dbName}`);
    console.log(`University code: ${DEMO.code}\n`);
}

async function main() {
    const reset = process.argv.includes('--reset');
    try {
        await connect();
        const { University, PlatformUser, Subscription } = getPlatformModels();

        console.log('=== Seeding Demo University ===\n');
        const university = await ensurePlatformRecords(University, PlatformUser, Subscription);
        const stats = await seedUniversityData(university, reset);

        if (stats.skipped) {
            console.log('\nNo changes made.');
        } else {
            console.log('\nSeed complete:');
            console.log(`  Departments: ${stats.departments}`);
            console.log(`  Users:       ${stats.users}`);
            console.log(`  Courses:     ${stats.courses}`);
            console.log(`  CLOs:        ${stats.clos}`);
            console.log(`  Results:     ${stats.results}`);
        }
        printCredentials();
    } catch (err) {
        console.error('Seed failed:', err);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

main();
