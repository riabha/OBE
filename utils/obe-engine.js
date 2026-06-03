/**
 * OBE attainment engine — CLO, PLO, PEO calculations (Washington Accord aligned).
 */
const WASHINGTON_ACCORD_PLOS = [
    { code: 'PLO1', description: 'Engineering Knowledge — Apply mathematics, science, and engineering fundamentals.' },
    { code: 'PLO2', description: 'Problem Analysis — Identify and analyze complex engineering problems.' },
    { code: 'PLO3', description: 'Design/Development — Design solutions for complex problems with appropriate constraints.' },
    { code: 'PLO4', description: 'Investigation — Conduct investigation of complex problems using research-based methods.' },
    { code: 'PLO5', description: 'Modern Tool Usage — Create, select, and apply appropriate techniques and tools.' },
    { code: 'PLO6', description: 'The Engineer and Society — Apply contextual knowledge for societal, health, safety, legal, and cultural issues.' },
    { code: 'PLO7', description: 'Environment and Sustainability — Understand impact in societal and environmental contexts.' },
    { code: 'PLO8', description: 'Ethics — Apply ethical principles and professional responsibilities.' },
    { code: 'PLO9', description: 'Individual and Team Work — Function effectively as an individual and in teams.' },
    { code: 'PLO10', description: 'Communication — Communicate effectively on complex engineering activities.' },
    { code: 'PLO11', description: 'Project Management and Finance — Demonstrate knowledge of management and economic principles.' },
    { code: 'PLO12', description: 'Life-long Learning — Recognize need for and engage in independent life-long learning.' }
];

const DEFAULT_PEOS = [
    { code: 'PEO1', description: 'Graduates apply engineering knowledge in professional practice within 3–5 years of graduation.' },
    { code: 'PEO2', description: 'Graduates pursue continuous learning, research, or advanced studies.' },
    { code: 'PEO3', description: 'Graduates demonstrate leadership, ethics, and contribution to society.' }
];

const DEFAULT_CLO_TEMPLATES = [
    { suffix: 'CLO1', description: 'Explain fundamental concepts and terminology of the subject.', bloomLevel: 'Understand', weight: 25, mappedPlos: ['PLO1'] },
    { suffix: 'CLO2', description: 'Apply core methods and tools to solve discipline-specific problems.', bloomLevel: 'Apply', weight: 35, mappedPlos: ['PLO2', 'PLO3'] },
    { suffix: 'CLO3', description: 'Analyze, evaluate, and justify solutions with engineering judgment.', bloomLevel: 'Analyze', weight: 40, mappedPlos: ['PLO4', 'PLO5'] }
];

const ATTAINMENT_THRESHOLD = 60;

function defaultMappedPlosForCloIndex(i) {
    const maps = [
        ['PLO1', 'PLO2'],
        ['PLO2', 'PLO3', 'PLO5'],
        ['PLO4', 'PLO5', 'PLO10']
    ];
    return maps[i] || ['PLO1'];
}

function buildDefaultClosForCourse(course) {
    const code = course.code || course.courseCode;
    const deptCode = course.departmentCode || course.program || null;
    return DEFAULT_CLO_TEMPLATES.map((t, i) => ({
        code: `${code}-${t.suffix}`.slice(0, 20),
        courseCode: code,
        departmentCode: deptCode,
        title: t.description,
        description: t.description,
        bloomLevel: t.bloomLevel,
        assessmentMethod: 'Exam, Assignment, Project',
        weight: t.weight,
        mappedPlos: t.mappedPlos || defaultMappedPlosForCloIndex(i),
        targetAttainment: ATTAINMENT_THRESHOLD,
        attainment: 0,
        isActive: true,
        createdAt: new Date()
    }));
}

function buildPlosForDepartment(dept, programCode) {
    return WASHINGTON_ACCORD_PLOS.map(p => ({
        ...p,
        program: programCode || dept.code,
        programCode: programCode || dept.code,
        department: dept._id || dept.id,
        departmentCode: dept.code,
        departmentName: dept.name,
        mappedPeos: ['PEO1', 'PEO2', 'PEO3'],
        targetAttainment: ATTAINMENT_THRESHOLD,
        attainment: 0,
        isActive: true,
        createdAt: new Date()
    }));
}

function buildPeosForDepartment(dept, programCode) {
    return DEFAULT_PEOS.map(p => ({
        ...p,
        program: programCode || dept.code,
        programCode: programCode || dept.code,
        department: dept._id || dept.id,
        departmentCode: dept.code,
        departmentName: dept.name,
        isActive: true,
        createdAt: new Date()
    }));
}

/** Map assessment names to CLO codes when questions lack explicit cloCode */
function inferCloCodesForAssessment(assessmentName, clos) {
    const name = String(assessmentName || '').toLowerCase();
    const sorted = [...clos].sort((a, b) => String(a.code).localeCompare(String(b.code)));
    if (!sorted.length) return [];
    if (/quiz|assignment|lab|project/i.test(name)) return [sorted[0].code];
    if (/mid|sessional/i.test(name)) return sorted.length > 1 ? [sorted[1].code] : [sorted[0].code];
    if (/final|term/i.test(name)) return sorted.length > 2 ? [sorted[2].code] : [sorted[sorted.length - 1].code];
    return [sorted[0].code];
}

function getAssessmentCloCodes(assessment, clos) {
    const fromQuestions = (assessment.questions || [])
        .map(q => q.cloCode || q.cloId)
        .filter(Boolean);
    if (fromQuestions.length) return [...new Set(fromQuestions)];
    return inferCloCodesForAssessment(assessment.name || assessment.title, clos);
}

/**
 * Recalculate CLO attainment for a course (or all courses).
 * A student "achieves" a CLO if marks/maxMarks >= threshold on any mapped assessment.
 */
async function recalculateAttainment(uniDb, options = {}) {
    const { courseCode, threshold = ATTAINMENT_THRESHOLD } = options;
    const cloQuery = courseCode ? { courseCode: courseCode.toUpperCase() } : {};
    const clos = await uniDb.collection('clos').find({ ...cloQuery, isActive: { $ne: false } }).toArray();
    const results = await uniDb.collection('results').find(
        courseCode ? { courseCode: courseCode.toUpperCase() } : {}
    ).toArray();
    const assessments = await uniDb.collection('assessments').find(
        courseCode ? { courseCode: courseCode.toUpperCase() } : {}
    ).toArray();

    const courseCodes = courseCode
        ? [courseCode.toUpperCase()]
        : [...new Set(clos.map(c => c.courseCode))];

    const cloUpdates = [];
    const attainmentRecords = [];
    const cqiActions = [];

    for (const cc of courseCodes) {
        const courseClos = clos.filter(c => c.courseCode === cc);
        const courseResults = results.filter(r => r.courseCode === cc);
        const courseAssessments = assessments.filter(a => a.courseCode === cc);

        const assessmentToClos = new Map();
        for (const a of courseAssessments) {
            assessmentToClos.set(a.name || a.title, getAssessmentCloCodes(a, courseClos));
        }

        for (const clo of courseClos) {
            const relevantResults = courseResults.filter(r => {
                const mapped = assessmentToClos.get(r.assessmentName);
                if (mapped && mapped.length) return mapped.includes(clo.code);
                return inferCloCodesForAssessment(r.assessmentName, courseClos).includes(clo.code);
            });

            if (!relevantResults.length) {
                cloUpdates.push({ _id: clo._id, attainment: clo.attainment || 0, studentsAssessed: 0 });
                continue;
            }

            const byStudent = new Map();
            for (const r of relevantResults) {
                const sid = String(r.student || r.studentId);
                if (!byStudent.has(sid)) byStudent.set(sid, []);
                const pct = r.percentage != null
                    ? r.percentage
                    : (r.maxMarks ? Math.round((r.marksObtained / r.maxMarks) * 100) : 0);
                byStudent.get(sid).push(pct);
            }

            let achieved = 0;
            for (const [, pcts] of byStudent) {
                const avg = pcts.reduce((s, p) => s + p, 0) / pcts.length;
                if (avg >= threshold) achieved += 1;
            }
            const totalStudents = byStudent.size;
            const attainment = totalStudents
                ? Math.round((achieved / totalStudents) * 1000) / 10
                : 0;

            cloUpdates.push({ _id: clo._id, attainment, studentsAssessed: totalStudents, studentsAchieved: achieved });

            attainmentRecords.push({
                type: 'clo',
                code: clo.code,
                courseCode: cc,
                attainment,
                target: clo.targetAttainment || threshold,
                studentsAssessed: totalStudents,
                studentsAchieved: achieved,
                calculatedAt: new Date()
            });

            if (attainment < threshold && totalStudents > 0) {
                cqiActions.push({
                    type: 'clo_deficiency',
                    code: clo.code,
                    courseCode: cc,
                    attainment,
                    threshold,
                    status: 'open',
                    message: `${clo.code} attainment ${attainment}% is below target ${threshold}%`,
                    createdAt: new Date()
                });
            }
        }
    }

    for (const u of cloUpdates) {
        await uniDb.collection('clos').updateOne(
            { _id: u._id },
            { $set: { attainment: u.attainment, studentsAssessed: u.studentsAssessed, studentsAchieved: u.studentsAchieved, updatedAt: new Date() } }
        );
    }

    const plos = await uniDb.collection('plos').find({ isActive: { $ne: false } }).toArray();
    const freshClos = await uniDb.collection('clos').find({ isActive: { $ne: false } }).toArray();

    for (const plo of plos) {
        const linked = freshClos.filter(c =>
            (c.mappedPlos || []).includes(plo.code) &&
            (!plo.departmentCode || c.courseCode?.startsWith(plo.departmentCode?.slice(0, 2) || 'XX') ||
                c.departmentCode === plo.departmentCode)
        );
        const deptClos = freshClos.filter(c =>
            (c.mappedPlos || []).includes(plo.code) &&
            (String(c.department) === String(plo.department) || c.departmentCode === plo.departmentCode)
        );
        const pool = deptClos.length ? deptClos : linked;
        const withData = pool.filter(c => (c.studentsAssessed || 0) > 0 || (c.attainment || 0) > 0);
        const source = withData.length ? withData : pool;

        if (!source.length) continue;

        const attainment = Math.round(
            source.reduce((s, c) => s + (c.attainment || 0), 0) / source.length * 10
        ) / 10;

        await uniDb.collection('plos').updateOne(
            { _id: plo._id },
            { $set: { attainment, updatedAt: new Date() } }
        );

        attainmentRecords.push({
            type: 'plo',
            code: plo.code,
            departmentCode: plo.departmentCode,
            attainment,
            target: plo.targetAttainment || threshold,
            cloCount: source.length,
            calculatedAt: new Date()
        });

        if (attainment < threshold) {
            cqiActions.push({
                type: 'plo_deficiency',
                code: plo.code,
                departmentCode: plo.departmentCode,
                attainment,
                threshold,
                status: 'open',
                message: `${plo.code} program attainment ${attainment}% is below target ${threshold}%`,
                createdAt: new Date()
            });
        }
    }

    if (attainmentRecords.length) {
        await uniDb.collection('attainments').deleteMany(
            courseCode ? { courseCode: courseCode.toUpperCase() } : {}
        );
        await uniDb.collection('attainments').insertMany(attainmentRecords);
    }

    for (const cqi of cqiActions) {
        await uniDb.collection('reports').updateOne(
            { type: cqi.type, code: cqi.code, courseCode: cqi.courseCode || null, status: 'open' },
            { $set: cqi },
            { upsert: true }
        );
    }

    return {
        closUpdated: cloUpdates.length,
        plosUpdated: plos.length,
        cqiAlerts: cqiActions.length,
        attainmentRecords: attainmentRecords.length
    };
}

async function seedObeForUniversity(uniDb, departments, programs = []) {
    const programByDept = new Map();
    for (const p of programs) {
        if (p.departmentCode) programByDept.set(p.departmentCode, p);
    }

    const allPlos = [];
    const allPeos = [];
    const allClos = [];

    for (const dept of departments) {
        const prog = programByDept.get(dept.code) || { code: `B${dept.code}`.slice(0, 10) };
        const deptObj = { _id: dept._id, code: dept.code, name: dept.name, id: dept._id };

        const existingPlos = await uniDb.collection('plos').countDocuments({ departmentCode: dept.code });
        if (!existingPlos) {
            allPlos.push(...buildPlosForDepartment(deptObj, prog.code));
            allPeos.push(...buildPeosForDepartment(deptObj, prog.code));
        }
    }

    if (allPlos.length) await uniDb.collection('plos').insertMany(allPlos, { ordered: false }).catch(() => {});
    if (allPeos.length) await uniDb.collection('peos').insertMany(allPeos, { ordered: false }).catch(() => {});

    const courses = await uniDb.collection('courses').find({ isActive: { $ne: false } }).toArray()
        .catch(async () => {
            const Course = uniDb.models?.Course;
            if (Course) return Course.find({ isActive: true }).lean();
            return [];
        });

    let courseList = courses;
    if (!courseList.length) {
        try {
            const { Course } = require('../models/Course');
            const M = uniDb.models?.Course || uniDb.model('Course', Course);
            courseList = await M.find({ isActive: true }).select('code title department').lean();
        } catch (_) { /* ignore */ }
    }

    for (const course of courseList) {
        const code = course.code;
        const exists = await uniDb.collection('clos').countDocuments({ courseCode: code });
        if (exists) continue;
        allClos.push(...buildDefaultClosForCourse(course));
    }

    if (allClos.length) await uniDb.collection('clos').insertMany(allClos, { ordered: false }).catch(() => {});

    return { plos: allPlos.length, peos: allPeos.length, clos: allClos.length };
}

module.exports = {
    WASHINGTON_ACCORD_PLOS,
    DEFAULT_PEOS,
    DEFAULT_CLO_TEMPLATES,
    ATTAINMENT_THRESHOLD,
    buildDefaultClosForCourse,
    buildPlosForDepartment,
    buildPeosForDepartment,
    recalculateAttainment,
    seedObeForUniversity,
    inferCloCodesForAssessment
};
