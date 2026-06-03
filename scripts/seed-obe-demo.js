/**
 * Add demo students, assessments, and results for attainment/CQI testing
 * without resetting the full QUEST database.
 *
 * Usage: node scripts/seed-obe-demo.js [--db=obe_quest]
 */
require('dotenv').config({ path: './config.env' });
require('dotenv').config({ path: './.env', override: false });

const DEFAULT_DB = 'obe_quest';

function parseArgs() {
  const dbName = process.argv.find(a => a.startsWith('--db='))?.split('=')[1] || DEFAULT_DB;
  return { dbName };
}

async function main() {
  const { dbName } = parseArgs();
  const mongoose = require('mongoose');
  const bcrypt = require('bcryptjs');
  const UserSchema = require('../models/User');
  const DepartmentSchema = require('../models/Department');
  const CourseSchema = require('../models/Course');
  const { recalculateAttainment } = require('../utils/obe-engine');

  await mongoose.connect(process.env.MONGODB_URI);
  const uniDb = mongoose.connection.useDb(dbName);
  const User = uniDb.models.User || uniDb.model('User', UserSchema);
  const Department = uniDb.models.Department || uniDb.model('Department', DepartmentSchema);
  const Course = uniDb.models.Course || uniDb.model('Course', CourseSchema);

  const dept = await Department.findOne({ code: 'CSE', isActive: true })
    || await Department.findOne({ isActive: true }).sort({ code: 1 });
  if (!dept) throw new Error('No active department found');

  const course = await Course.findOne({ department: dept._id, isActive: true }).sort({ code: 1 });
  if (!course) throw new Error(`No course found for ${dept.code}`);

  const hashedPassword = await bcrypt.hash('quest123', 12);
  const demoStudents = [
    { firstName: 'Ali', lastName: 'Ahmed', studentId: 'QUEST-DEMO-001', phone: '3001234001' },
    { firstName: 'Sara', lastName: 'Khan', studentId: 'QUEST-DEMO-002', phone: '3001234002' },
    { firstName: 'Usman', lastName: 'Malik', studentId: 'QUEST-DEMO-003', phone: '3001234003' },
    { firstName: 'Fatima', lastName: 'Shah', studentId: 'QUEST-DEMO-004', phone: '3001234004' },
    { firstName: 'Hassan', lastName: 'Raza', studentId: 'QUEST-DEMO-005', phone: '3001234005' }
  ];

  let studentCount = 0;
  for (const s of demoStudents) {
    const exists = await User.findOne({ studentId: s.studentId });
    if (exists) continue;
    await User.create({
      ...s,
      email: `${s.studentId.toLowerCase()}@demo.quest.edu.pk`,
      password: hashedPassword,
      role: 'student',
      roles: ['student'],
      department: dept._id,
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
      departmentCode: dept.code,
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

  const summary = await recalculateAttainment(uniDb, { courseCode: course.code });
  console.log(`✅ Demo OBE data on ${course.code} (${dept.code}): ${studentCount} students, ${resultCount} results, CQI alerts: ${summary.cqiAlerts || 0}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌', err.message);
  process.exitCode = 1;
});
