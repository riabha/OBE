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
const { scrapeAll, buildSeedPayload } = require('./lib/quest-scraper');

const DEFAULT_DB = 'obe_quest';
const DEFAULT_PASSWORD = 'quest123';
const DATA_FILE = path.join(__dirname, 'data', 'quest-scraped.json');

const COLLECTIONS = [
  '_metadata', 'departments', 'users', 'courses', 'sections',
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

  // Departments
  for (const d of payload.departments) {
    const dept = await Department.create({
      name: d.name,
      code: d.code,
      description: `${d.name} — ${d.facultyName}`,
      faculty: d.faculty,
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

  // Courses
  let courseCount = 0;
  for (const c of payload.courses) {
    const deptId = deptIdByCode.get(c.departmentCode);
    if (!deptId) continue;
    const instructor = payload.users.find(u => u.departmentCode === c.departmentCode);
    const instructorId = instructor ? userIdByEmail.get(instructor.email) : null;

    try {
      await Course.create({
        code: c.code,
        title: c.title,
        description: `${c.title} (${c.code}) — QUEST scheme of studies`,
        department: deptId,
        instructor: instructorId || undefined,
        credits: c.credits || 3,
        semester: 1,
        program: c.departmentCode,
        isActive: true,
        academicYear: '2024-25',
        semesterName: 'Fall'
      });
      courseCount++;
    } catch (err) {
      if (!String(err.message).includes('duplicate')) {
        console.warn(`  ⚠️  Course ${c.code}: ${err.message}`);
      }
    }
  }
  console.log(`  ✅ Courses: ${courseCount}`);

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
      departmentCode: d.code,
      batches: d.program.batches,
      level: 'Undergraduate',
      isActive: true,
      createdAt: new Date()
    })),
    { ordered: false }
  ).catch(() => {});

  console.log(`\n✅ Seed complete for ${dbName}`);
  console.log(`   Login password for scraped staff: ${DEFAULT_PASSWORD}`);
  console.log('   Students: NOT scraped (private data). Import separately.');
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
