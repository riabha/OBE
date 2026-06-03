/**
 * Scrape quest.edu.pk and seed Quaid-e-Awam University into obe_quest.
 *
 * Usage:
 *   node scripts/seed-quest-university.js --scrape-only     # save JSON only
 *   node scripts/seed-quest-university.js --reset             # scrape + seed (clears uni DB first)
 *   node scripts/seed-quest-university.js --import=scripts/data/quest-scraped.json --reset  # VPS (no scrape)
 *   npm run scrape-quest   # dev machine only — refresh JSON, commit, then git pull on VPS
 *
 * Default DB: obe_quest (override with --db=obe_quest)
 * Default password for seeded users: quest123
 */
require('dotenv').config({ path: './config.env' });
require('dotenv').config({ path: './.env', override: false });

const fs = require('fs');
const path = require('path');
const { facultyCodeFromName } = require('../utils/faculty-code');
const { scrapeAll, buildSeedPayload } = require('./lib/quest-scraper');

const DEFAULT_DB = 'obe_quest';
const DEFAULT_PASSWORD = 'quest123';
const DATA_FILE = path.join(__dirname, 'data', 'quest-scraped.json');

const COLLECTIONS = [
  '_metadata', 'faculties', 'departments', 'users', 'courses', 'sections',
  'enrollments', 'assessments', 'results', 'clos', 'plos',
  'peos', 'programs', 'attainments', 'reports', 'settings'
];

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    reset: args.includes('--reset'),
    scrapeOnly: args.includes('--scrape-only'),
    importPath: args.find(a => a.startsWith('--import='))?.split('=')[1],
    dbName: args.find(a => a.startsWith('--db='))?.split('=')[1] || DEFAULT_DB
  };
}

async function connect() {
  const mongoose = require('mongoose');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');
  return mongoose;
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

async function loadPayload(options) {
  if (options.importPath) {
    const raw = fs.readFileSync(path.resolve(options.importPath), 'utf8');
    const scraped = JSON.parse(raw);
    return buildSeedPayload(scraped);
  }

  console.log('🌐 Scraping public data from quest.edu.pk …\n');
  const scraped = await scrapeAll({
    onProgress: (msg) => console.log(msg)
  });

  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(scraped, null, 2));
  console.log(`\n💾 Raw scrape saved → ${DATA_FILE}`);

  return buildSeedPayload(scraped);
}

async function seedDatabase(dbName, payload, reset) {
  const mongoose = require('mongoose');
  const bcrypt = require('bcryptjs');
  const universitySchema = require('../models/University');
  const UserSchema = require('../models/User');
  const DepartmentSchema = require('../models/Department');
  const CourseSchema = require('../models/Course');
  const FacultySchema = require('../models/Faculty');

  const University = mongoose.models.University || mongoose.model('University', universitySchema);
  const university = await University.findOne({ databaseName: dbName });
  if (!university) {
    throw new Error(`University with databaseName "${dbName}" not found in platform DB. Create it in Pro Admin first.`);
  }

  console.log(`\n🏫 Seeding ${university.universityName} → ${dbName}`);
  const uniDb = mongoose.connection.useDb(dbName);
  const Department = uniDb.models.Department || uniDb.model('Department', DepartmentSchema);
  const User = uniDb.models.User || uniDb.model('User', UserSchema);
  const Course = uniDb.models.Course || uniDb.model('Course', CourseSchema);
  const Faculty = uniDb.models.Faculty || uniDb.model('Faculty', FacultySchema);

  if (reset) {
    console.log('🗑️  Resetting university database…');
    await resetUniDb(uniDb);
  } else {
    const existing = await User.countDocuments();
    if (existing > 0) {
      console.log(`⚠️  ${existing} users already exist. Use --reset to replace, or --import only on empty DB.`);
      return;
    }
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const deptIdByCode = new Map();
  const userIdByEmail = new Map();
  const facultyIdByName = new Map();
  const usedFacultyCodes = new Set();

  // Faculties
  const facultyList = payload.faculties?.length ? payload.faculties : [...new Map(
    payload.departments.map(d => [d.facultyName || d.faculty, { name: d.facultyName || d.faculty }])
  ).values()].map(f => ({
    name: f.name,
    code: facultyCodeFromName(f.name, usedFacultyCodes),
    questFacultyId: f.questFacultyId || null
  }));

  for (const f of facultyList) {
    const code = f.code || facultyCodeFromName(f.name, usedFacultyCodes);
    const fac = await Faculty.create({
      name: f.name,
      code,
      description: `${f.name} — QUEST Nawabshah`,
      questFacultyId: f.questFacultyId || null
    });
    facultyIdByName.set(f.name, fac._id);
    console.log(`  ✅ Faculty: ${f.name}`);
  }

  // Departments
  for (const d of payload.departments) {
    const facultyName = d.facultyName || d.faculty;
    const dept = await Department.create({
      name: d.name,
      code: d.code,
      description: `${d.name} — ${facultyName}`,
      faculty: facultyName,
      facultyRef: facultyIdByName.get(facultyName) || null,
      contactInfo: {
        email: `${d.code.toLowerCase()}@quest.edu.pk`,
        phone: '2449370367'
      },
      programs: [{
        name: d.program.name,
        code: d.program.code,
        level: d.program.level,
        duration: d.program.duration,
        credits: d.program.credits,
        isActive: true
      }],
      isActive: false,
      statistics: { totalStudents: 0, totalTeachers: 0, totalCourses: 0, activePrograms: 1 }
    });
    deptIdByCode.set(d.code, dept._id);
    console.log(`  ✅ Department: ${d.code} — ${d.name}`);
  }

  // Users
  for (const u of payload.users) {
    const deptId = u.departmentCode ? deptIdByCode.get(u.departmentCode) : null;
    const roles = u.roles?.length ? u.roles : [u.role || 'teacher'];
    const doc = {
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      password: hashedPassword,
      role: roles[0],
      roles,
      phone: '3000000000',
      designation: u.designation || 'Faculty',
      qualification: 'Graduate',
      employeeId: u.employeeId || `EMP${userIdByEmail.size + 1}`,
      isActive: true
    };
    if (deptId && !roles.includes('dean')) doc.department = deptId;
    if (roles.includes('chairman') && deptId) doc.managedDepartments = [deptId];
    if (roles.includes('focal') && deptId) doc.assignedDepartments = [deptId];
    if (roles.includes('dean')) {
      const facDeptIds = payload.departments
        .filter(d => d.facultyName === u.facultyName)
        .map(d => deptIdByCode.get(d.code))
        .filter(Boolean);
      doc.assignedFaculties = facDeptIds.length ? facDeptIds : [...deptIdByCode.values()].slice(0, 3);
    }

    try {
      const user = await User.create(doc);
      userIdByEmail.set(u.email, user._id);
    } catch (err) {
      console.warn(`  ⚠️  Skip user ${u.email}: ${err.message}`);
    }
  }
  console.log(`  ✅ Users: ${userIdByEmail.size}`);

  // Assign chairmen & focal placeholders
  for (const d of payload.departments) {
    const deptId = deptIdByCode.get(d.code);
    const chairman = payload.users.find(u =>
      u.departmentCode === d.code && (u.roles || []).includes('chairman')
    );
    const focal = payload.users.find(u =>
      u.departmentCode === d.code && (u.roles || []).includes('focal')
    );
    const update = { isActive: true };
    if (chairman && userIdByEmail.get(chairman.email)) {
      update.chairman = userIdByEmail.get(chairman.email);
    } else {
      const anyTeacher = payload.users.find(u => u.departmentCode === d.code);
      if (anyTeacher && userIdByEmail.get(anyTeacher.email)) {
        update.chairman = userIdByEmail.get(anyTeacher.email);
      }
    }
    if (focal && userIdByEmail.get(focal.email)) {
      update.focalPersons = [{ user: userIdByEmail.get(focal.email), responsibilities: ['academic', 'examination'] }];
    }
    await Department.findByIdAndUpdate(deptId, update);
  }

  // Assign deans to faculties
  for (const f of facultyList) {
    const dean = payload.users.find(u =>
      u.facultyName === f.name && (u.roles || []).includes('dean')
    );
    if (dean && userIdByEmail.get(dean.email)) {
      const facId = facultyIdByName.get(f.name);
      await Faculty.findByIdAndUpdate(facId, { dean: userIdByEmail.get(dean.email) });
      const deptIds = payload.departments
        .filter(d => (d.facultyName || d.faculty) === f.name)
        .map(d => deptIdByCode.get(d.code))
        .filter(Boolean);
      await User.findByIdAndUpdate(userIdByEmail.get(dean.email), {
        $addToSet: { assignedFaculties: { $each: deptIds } }
      });
    }
  }

  // Courses
  const instructorByDept = new Map();
  for (const d of payload.departments) {
    const teacher = payload.users.find(u =>
      u.departmentCode === d.code && (u.roles || []).some(r => ['teacher', 'chairman', 'focal'].includes(r))
    );
    if (teacher && userIdByEmail.get(teacher.email)) {
      instructorByDept.set(d.code, userIdByEmail.get(teacher.email));
    }
  }

  let courseCount = 0;
  let courseSkipped = 0;
  for (const c of payload.courses) {
    const deptId = deptIdByCode.get(c.departmentCode);
    if (!deptId) { courseSkipped++; continue; }
    const credits = Math.max(1, Math.min(6, c.credits || 3));

    try {
      await Course.create({
        code: c.code,
        title: c.title,
        description: `${c.title} (${c.code}) — QUEST scheme of studies`,
        department: deptId,
        instructor: instructorByDept.get(c.departmentCode) || undefined,
        credits,
        hours: { theory: credits, practical: 0, total: credits },
        semester: 1,
        program: c.departmentCode,
        isActive: true,
        academicYear: '2024-25',
        semesterName: 'Fall'
      });
      courseCount++;
    } catch (err) {
      courseSkipped++;
      if (!String(err.message).includes('duplicate')) {
        console.warn(`  ⚠️  Course ${c.code} (${c.departmentCode}): ${err.message}`);
      }
    }
  }
  console.log(`  ✅ Courses: ${courseCount} (${courseSkipped} skipped)`);

  for (const [code, deptId] of deptIdByCode) {
    const totalCourses = await Course.countDocuments({ department: deptId, isActive: true });
    const totalTeachers = await User.countDocuments({ department: deptId, isActive: true, role: { $in: ['teacher', 'focal', 'chairman'] } });
    await Department.findByIdAndUpdate(deptId, {
      'statistics.totalCourses': totalCourses,
      'statistics.totalTeachers': totalTeachers
    });
  }

  // Metadata + batch programs
  await uniDb.collection('_metadata').updateOne(
    { key: 'quest_import' },
    {
      $set: {
        key: 'quest_import',
        source: 'https://quest.edu.pk',
        importedAt: new Date(),
        batches: ['2022', '2023', '2024', '2025'],
        defaultUserPassword: DEFAULT_PASSWORD,
        note: 'Students not imported — not public. Use admissions/Excel import for student rosters.'
      }
    },
    { upsert: true }
  );

  await uniDb.collection('programs').insertMany(
    payload.departments.map(d => ({
      name: d.program.name,
      code: d.program.code,
      department: d.name,
      departmentCode: d.code,
      departmentId: deptIdByCode.get(d.code),
      batches: d.program.batches || ['2022', '2023', '2024', '2025'],
      level: d.program.level || 'Undergraduate',
      duration: d.program.duration || 4,
      creditHours: d.program.credits || 130,
      credits: d.program.credits || 130,
      isActive: true,
      createdAt: new Date()
    })),
    { ordered: false }
  ).catch(() => {});

  const { seedObeForUniversity, recalculateAttainment } = require('../utils/obe-engine');
  const deptDocs = await Department.find({ isActive: true }).lean();
  const programs = await uniDb.collection('programs').find({}).toArray();
  const obeStats = await seedObeForUniversity(uniDb, deptDocs, programs);
  console.log(`  ✅ OBE outcomes: ${obeStats.plos} PLOs, ${obeStats.peos} PEOs, ${obeStats.clos} CLOs`);

  await seedObeDemoSample(uniDb, User, Course, deptIdByCode, hashedPassword, recalculateAttainment);

  console.log(`\n✅ Seed complete for ${dbName}`);
  console.log(`   Login password for scraped staff: ${DEFAULT_PASSWORD}`);
  console.log('   Students: NOT scraped (private data). Import separately.');
}

/** Demo students + assessments + results for one course so attainment/CQI are visible after seed. */
async function seedObeDemoSample(uniDb, User, Course, deptIdByCode, hashedPassword, recalculateAttainment) {
  const deptCode = deptIdByCode.has('CSE') ? 'CSE' : [...deptIdByCode.keys()][0];
  const deptId = deptIdByCode.get(deptCode);
  if (!deptId) return;

  const course = await Course.findOne({ department: deptId, isActive: true }).sort({ code: 1 });
  if (!course) return;

  const demoStudents = [
    { firstName: 'Ali', lastName: 'Ahmed', studentId: 'QUEST-DEMO-001' },
    { firstName: 'Sara', lastName: 'Khan', studentId: 'QUEST-DEMO-002' },
    { firstName: 'Usman', lastName: 'Malik', studentId: 'QUEST-DEMO-003' },
    { firstName: 'Fatima', lastName: 'Shah', studentId: 'QUEST-DEMO-004' },
    { firstName: 'Hassan', lastName: 'Raza', studentId: 'QUEST-DEMO-005' }
  ];

  let studentCount = 0;
  for (const s of demoStudents) {
    const exists = await User.findOne({ studentId: s.studentId });
    if (exists) continue;
    await User.create({
      firstName: s.firstName,
      lastName: s.lastName,
      email: `${s.studentId.toLowerCase()}@demo.quest.edu.pk`,
      password: hashedPassword,
      role: 'student',
      department: deptId,
      studentId: s.studentId,
      semester: 4,
      batch: '2024',
      isActive: true
    });
    studentCount++;
  }

  const assessments = [
    { name: 'Quiz 1', totalMarks: 10 },
    { name: 'Midterm', totalMarks: 30 },
    { name: 'Final Exam', totalMarks: 50 }
  ];

  for (const a of assessments) {
    const exists = await uniDb.collection('assessments').findOne({ courseCode: course.code, name: a.name });
    if (exists) continue;
    await uniDb.collection('assessments').insertOne({
      courseCode: course.code,
      name: a.name,
      title: a.name,
      type: a.name.includes('Final') ? 'final' : a.name.includes('Mid') ? 'midterm' : 'quiz',
      totalMarks: a.totalMarks,
      maxMarks: a.totalMarks,
      departmentCode: deptCode,
      isActive: true,
      createdAt: new Date()
    });
  }

  const marksMatrix = {
    'QUEST-DEMO-001': { 'Quiz 1': 8, 'Midterm': 24, 'Final Exam': 42 },
    'QUEST-DEMO-002': { 'Quiz 1': 9, 'Midterm': 27, 'Final Exam': 45 },
    'QUEST-DEMO-003': { 'Quiz 1': 5, 'Midterm': 15, 'Final Exam': 28 },
    'QUEST-DEMO-004': { 'Quiz 1': 7, 'Midterm': 21, 'Final Exam': 38 },
    'QUEST-DEMO-005': { 'Quiz 1': 6, 'Midterm': 18, 'Final Exam': 32 }
  };

  let resultCount = 0;
  for (const [sid, marks] of Object.entries(marksMatrix)) {
    for (const [assessmentName, obtained] of Object.entries(marks)) {
      const exists = await uniDb.collection('results').findOne({ courseCode: course.code, studentId: sid, assessmentName });
      if (exists) continue;
      const maxMarks = assessments.find(a => a.name === assessmentName)?.totalMarks || 100;
      await uniDb.collection('results').insertOne({
        courseCode: course.code,
        studentId: sid,
        assessmentName,
        marksObtained: obtained,
        maxMarks,
        percentage: Math.round((obtained / maxMarks) * 100),
        createdAt: new Date()
      });
      resultCount++;
    }
  }

  if (studentCount || resultCount) {
    const summary = await recalculateAttainment(uniDb, { courseCode: course.code });
    console.log(`  ✅ OBE demo: ${studentCount} students, ${resultCount} results on ${course.code} (CQI alerts: ${summary.cqiAlerts || 0})`);
  }
}

async function main() {
  const options = parseArgs();
  try {
    if (options.scrapeOnly && !options.importPath) {
      console.log('🌐 Scraping public data from quest.edu.pk …\n');
      const scraped = await scrapeAll({ onProgress: (msg) => console.log(msg) });
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(scraped, null, 2));
      console.log(`\n💾 Raw scrape saved → ${DATA_FILE}`);
      const preview = buildSeedPayload(scraped);
      console.log('\nPreview counts:', preview.stats);
      console.log('\nDone (--scrape-only). Run with --reset --db=obe_quest on VPS to seed.');
      return;
    }

    await connect();
    const mongoose = require('mongoose');
    const payload = await loadPayload(options);
    if (!payload) return;

    const emptyDepts = payload.departments.filter(d =>
      !payload.courses.some(c => c.departmentCode === d.code)
    );
    if (emptyDepts.length) {
      console.warn(`\n⚠️  ${emptyDepts.length} department(s) have no courses in payload. Run: npm run validate-quest`);
    }
    console.log(`\n📊 Payload: ${payload.faculties?.length || 0} faculties, ${payload.departments.length} depts, ${payload.users.length} users, ${payload.courses.length} courses`);
    console.log('   Tip: run npm run validate-quest before seeding on production.\n');

    await seedDatabase(options.dbName, payload, options.reset);
  } catch (err) {
    console.error('❌', err.message);
    process.exitCode = 1;
  } finally {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  }
}

main();
