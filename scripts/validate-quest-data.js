/**
 * Validate QUEST scrape/seed payload before importing.
 * Usage: node scripts/validate-quest-data.js [--import=scripts/data/quest-scraped.json]
 */
require('dotenv').config({ path: './config.env' });
require('dotenv').config({ path: './.env', override: false });

const fs = require('fs');
const path = require('path');
const { buildSeedPayload } = require('./lib/quest-scraper');

const importPath = process.argv.find(a => a.startsWith('--import='))?.split('=')[1]
  || path.join(__dirname, 'data', 'quest-scraped.json');

function main() {
  if (!fs.existsSync(importPath)) {
    console.error(`❌ File not found: ${importPath}`);
    process.exit(1);
  }

  const scraped = JSON.parse(fs.readFileSync(path.resolve(importPath), 'utf8'));
  const payload = buildSeedPayload(scraped);

  let errors = 0;
  let warnings = 0;

  console.log('\n📋 QUEST Data Validation Report');
  console.log('═'.repeat(50));

  if (payload.faculties.length !== 6) {
    console.log(`⚠️  Expected 6 faculties, got ${payload.faculties.length}`);
    warnings++;
  } else {
    console.log(`✅ Faculties: ${payload.faculties.length}`);
    payload.faculties.forEach(f => console.log(`   • ${f.name} (${f.code})`));
  }

  console.log(`\n✅ Departments: ${payload.departments.length}`);
  const deptCodes = new Set();
  for (const d of payload.departments) {
    if (deptCodes.has(d.code)) {
      console.log(`❌ Duplicate department code: ${d.code}`);
      errors++;
    }
    deptCodes.add(d.code);
    if (!d.faculty || d.faculty.startsWith('Faculty of') === false && !d.facultyName?.startsWith('Faculty of')) {
      console.log(`⚠️  ${d.code}: faculty name may be abbreviated → ${d.faculty}`);
      warnings++;
    }
  }

  const coursesByDept = {};
  const globalCourseKeys = new Set();
  for (const c of payload.courses) {
    coursesByDept[c.departmentCode] = (coursesByDept[c.departmentCode] || 0) + 1;
    const key = `${c.departmentCode}:${c.code}`;
    if (globalCourseKeys.has(key)) {
      console.log(`❌ Duplicate course in payload: ${key}`);
      errors++;
    }
    globalCourseKeys.add(key);
  }

  console.log(`\n📚 Courses: ${payload.courses.length} total`);
  const emptyDepts = payload.departments.filter(d => !coursesByDept[d.code]);
  if (emptyDepts.length) {
    console.log(`⚠️  ${emptyDepts.length} departments with NO courses:`);
    emptyDepts.forEach(d => console.log(`   • ${d.name} (${d.code})`));
    warnings += emptyDepts.length;
  }
  payload.departments.forEach(d => {
    const n = coursesByDept[d.code] || 0;
    const icon = n === 0 ? '⚠️ ' : '   ';
    console.log(`${icon}${d.code}: ${n} courses`);
  });

  const chairmen = payload.users.filter(u => (u.roles || []).includes('chairman'));
  console.log(`\n👤 Users: ${payload.users.length} (${chairmen.length} chairmen)`);
  for (const d of payload.departments) {
    const hasChairman = payload.users.some(u =>
      u.departmentCode === d.code && (u.roles || []).includes('chairman')
    );
    if (!hasChairman) {
      console.log(`⚠️  No chairman for ${d.name} (${d.code})`);
      warnings++;
    }
  }

  const emails = new Set();
  for (const u of payload.users) {
    if (emails.has(u.email)) {
      console.log(`❌ Duplicate email: ${u.email}`);
      errors++;
    }
    emails.add(u.email);
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`Summary: ${errors} error(s), ${warnings} warning(s)`);
  if (errors > 0) {
    console.log('❌ Fix errors before seeding.');
    process.exit(1);
  }
  if (warnings > 0) {
    console.log('⚠️  Warnings present — seed may proceed but review empty departments.');
  } else {
    console.log('✅ Data looks good for seeding.');
  }
}

main();
