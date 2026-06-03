/**
 * Scrape public QUEST (quest.edu.pk) data: faculties, departments, staff, courses.
 * Does NOT scrape private student records (not public).
 */
const cheerio = require('cheerio');

const BASE = 'https://www.quest.edu.pk';
const FACULTY_IDS = [1, 2, 3, 4, 5, 6];
const DEPARTMENT_IDS = [1, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 30, 31, 32, 33];
const BATCHES = ['2022', '2023', '2024', '2025'];

const FACULTY_BUCKET = {
  1: 'Engineering',
  2: 'Engineering',
  3: 'Engineering',
  4: 'Engineering',
  5: 'Sciences',
  6: 'Engineering'
};

async function fetchHtml(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'OBE-Portal-QUEST-Seeder/1.0 (+https://quest.edu.pk)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function cleanText(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function splitPersonName(raw) {
  const name = cleanText(raw)
    .replace(/^(Prof\.|Dr\.|Engr\.|Mr\.|Ms\.|Mrs\.)\s*/gi, '')
    .replace(/\s*(Former Dean.*|Member Syndicate.*|On study leave.*)$/i, '')
    .trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length || /^none$/i.test(name)) return null;
  return {
    fullName: cleanText(raw),
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || parts[0]
  };
}

function slugEmail(firstName, lastName, deptCode, usedEmails) {
  const base = `${String(firstName).toLowerCase().replace(/[^a-z]/g, '')}.${String(lastName).toLowerCase().replace(/[^a-z]/g, '')}`;
  let email = `${base}@quest.edu.pk`;
  let n = 2;
  while (usedEmails.has(email)) {
    email = `${base}${n}@quest.edu.pk`;
    n++;
  }
  usedEmails.add(email);
  return email;
}

function deptCodeFromName(name) {
  const n = cleanText(name).replace(/ Department$/i, '');
  const map = {
    'Computer Systems Engineering': 'CSE',
    'Software Engineering': 'SWE',
    'Artificial Intelligence': 'AI',
    'Computer Science': 'CS',
    'Information Technology': 'IT',
    'Data Science': 'DS',
    'Cyber Security': 'CYB',
    'Electrical Engineering': 'EE',
    'Electrical (Automation & Control Engineering)': 'EEAC',
    'Electronic Engineering': 'ELN',
    'Telecommunication Engineering': 'TEL',
    'Biomedical Engineering': 'BME',
    'Civil Engineering': 'CE',
    'Mechanical Engineering': 'ME',
    'Building and Architectural Engineering': 'BAE',
    'Industrial and Manufacturing Engineering': 'IME',
    'Environment Engineering': 'ENV',
    'Energy Systems Engineering': 'ESE',
    'Chemical Engineering': 'CHE',
    'Food Engineering Technology': 'FET',
    'Civil Engineering Technology': 'CET',
    'Mathematics and Statistics': 'MTH',
    'Basic Science and Related Studies': 'BSRS',
    'English (Language and Literature)': 'ENG',
    'Physics': 'PHY',
    'Chemistry': 'CHM'
  };
  if (map[n]) return map[n];
  const words = n.split(/\s+/).filter(w => w.length > 2);
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 10);
}

function designationToRoles(designation) {
  const d = cleanText(designation).toLowerCase();
  if (!d || d === 'none') return [];
  const roles = [];
  if (d.includes('dean')) roles.push('dean');
  if (d.includes('chairman')) roles.push('chairman');
  if (d.includes('controller')) roles.push('controller');
  if (d.includes('director') && d.includes('ict')) roles.push('controller');
  if (/professor|lecturer|assistant professor|associate professor|lab engineer|lab instructor|teaching assistant/i.test(d)) {
    roles.push('teacher');
  }
  if (!roles.length && /staff|superintendent|engineer|manager|librarian|registrar/i.test(d)) {
    roles.push('teacher');
  }
  return [...new Set(roles.length ? roles : ['teacher'])];
}

function parseCreditHours(raw) {
  const m = cleanText(raw).match(/(\d+)\s*\+\s*(\d+)/);
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 3;
}

async function scrapeFaculties() {
  const faculties = [];
  const deptToFaculty = {};

  for (const id of FACULTY_IDS) {
    const html = await fetchHtml(`/faculty/${id}/`);
    const $ = cheerio.load(html);
    const title = cleanText($('h1').first().text()) || `Faculty ${id}`;
    const deanBlock = cleanText($('h3').first().text());
    const deanName = deanBlock.replace(/Dean,.*$/i, '').trim();

    const departments = [];
    $('h4').each((_, el) => {
      const deptName = cleanText($(el).text());
      if (!deptName) return;
      const card = $(el).closest('.department-card, .card, div');
      const chairmanLine = cleanText(card.text());
      const chairmanMatch = chairmanLine.match(/Chairman:\s*(Prof\.|Dr\.|Engr\.|Mr\.|Ms\.)?\s*([^.\n]+?)(?:\s*Leading|$)/i);
      const chairman = chairmanMatch ? cleanText(chairmanMatch[0].replace(/^Chairman:\s*/i, '')) : null;

      departments.push({
        name: deptName,
        chairmanName: chairman
      });
      deptToFaculty[normalizeDeptKey(deptName)] = { facultyId: id, facultyName: title };
    });

    faculties.push({
      id,
      name: title,
      bucket: FACULTY_BUCKET[id] || 'Engineering',
      deanName: deanName,
      departments
    });
  }

  return { faculties, deptToFaculty };
}

function normalizeDeptKey(name) {
  return cleanText(name).toLowerCase().replace(/ department$/i, '');
}

async function scrapeTelephoneDirectory() {
  const html = await fetchHtml('/telephone-directory/');
  const $ = cheerio.load(html);
  const staffByDept = {};
  let currentDept = null;

  $('h2').each((_, h2) => {
    if (!cleanText($(h2).text()).includes('Academic Departments')) return false;
  });

  // All tables after "Academic Departments" heading
  let inAcademic = false;
  $('h2, table').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    if (tag === 'h2') {
      inAcademic = cleanText($(el).text()).includes('Academic Departments');
      return;
    }
    if (!inAcademic || tag !== 'table') return;

    $(el).find('tr').each((__, row) => {
      const cells = $(row).find('td, th').map((___, c) => cleanText($(c).text())).get();
      if (!cells.length) return;

      if (cells.length === 1 || (cells.length >= 1 && !cells[1] && cells[0].length > 3 && !cells[0].includes('@'))) {
        const maybeDept = cells[0];
        if (maybeDept.length > 4 && !/^\d+$/.test(maybeDept) && !maybeDept.includes('@')) {
          currentDept = maybeDept.replace(/ Department$/i, '').trim();
          if (!staffByDept[currentDept]) staffByDept[currentDept] = [];
        }
        return;
      }

      if (!currentDept) return;
      let name = cells[0];
      let designation = cells[1] || 'Staff';
      if (name.includes('@')) {
        designation = name.includes(' ') ? 'Staff' : 'Staff';
      }
      if (/^none$/i.test(name)) return;

      const person = splitPersonName(name);
      if (!person) return;

      staffByDept[currentDept].push({
        ...person,
        designation: cleanText(designation),
        roles: designationToRoles(designation),
        emailFromSite: name.includes('@') ? name.match(/[\w.+-]+@quest\.edu\.pk/i)?.[0]?.toLowerCase() : null
      });
    });
  });

  return staffByDept;
}

async function scrapeDepartmentCourses(deptId) {
  const html = await fetchHtml(`/department/${deptId}/`);
  const $ = cheerio.load(html);
  const deptTitle = cleanText($('h1').first().text()).replace(/ Department$/i, '');
  const courses = [];
  const seen = new Set();

  $('table').each((_, table) => {
    const headers = $(table).find('tr').first().find('th, td').map((__, c) => cleanText($(c).text()).toLowerCase()).get();
    if (!headers.some(h => h.includes('course')) && !headers.some(h => h.includes('code'))) return;

    $(table).find('tr').slice(1).each((__, row) => {
      const cells = $(row).find('td').map((___, c) => cleanText($(c).text())).get();
      if (cells.length < 2) return;
      let code = cells[0];
      let title = cells[1];
      let creditsRaw = cells[2] || '3';
      if (/^[A-Za-z]{2,}\d{2,}/.test(cells[0])) {
        // ok
      } else if (/^[A-Za-z]{2,}\d{2,}/.test(cells[1])) {
        code = cells[1];
        title = cells[0];
        creditsRaw = cells[2] || '3';
      } else return;

      code = code.replace(/\s+/g, '').toUpperCase();
      if (!code || code === 'CODE' || seen.has(code)) return;
      seen.add(code);
      if (/^\d+$/.test(code) && title.length < 4) return;

      courses.push({
        code,
        title,
        credits: parseCreditHours(creditsRaw),
        batches: BATCHES
      });
    });
  });

  return { deptId, deptTitle, courses };
}

async function scrapeAll(options = {}) {
  const onProgress = options.onProgress || (() => {});
  onProgress('Scraping faculty pages…');
  const { faculties, deptToFaculty } = await scrapeFaculties();

  onProgress('Scraping telephone directory (staff)…');
  const staffByDept = await scrapeTelephoneDirectory();

  onProgress('Scraping department schemes of studies (courses)…');
  const departmentPages = [];
  for (const id of DEPARTMENT_IDS) {
    onProgress(`  Department page ${id}…`);
    try {
      departmentPages.push(await scrapeDepartmentCourses(id));
    } catch (err) {
      console.warn(`  Skip department ${id}: ${err.message}`);
    }
    await sleep(300);
  }

  return {
    scrapedAt: new Date().toISOString(),
    source: BASE,
    batches: BATCHES,
    note: 'Student rosters are not public on quest.edu.pk — staff, departments, and courses only.',
    faculties,
    deptToFaculty,
    staffByDept,
    departmentPages
  };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function buildSeedPayload(scraped) {
  const usedEmails = new Set();
  const departments = [];
  const users = [];
  const courses = [];
  const deptMap = new Map();

  // Deans from faculties
  for (const fac of scraped.faculties) {
    const dean = splitPersonName(fac.deanName);
    if (!dean) continue;
    const email = slugEmail(dean.firstName, dean.lastName, 'DEAN', usedEmails);
    users.push({
      ...dean,
      email,
      roles: ['dean', 'teacher'],
      role: 'dean',
      designation: 'Dean',
      facultyName: fac.name,
      employeeId: `DEAN${fac.id}`
    });
  }

  // Merge department pages + staff directory
  for (const page of scraped.departmentPages) {
    if (/admin department/i.test(page.deptTitle)) continue;

    const deptName = page.deptTitle;
    const code = deptCodeFromName(deptName);
    const key = normalizeDeptKey(deptName);
    const facInfo = scraped.deptToFaculty[key] || {};
    const fac = scraped.faculties.find(f => f.id === facInfo.facultyId);
    const facultyName = facInfo.facultyName || fac?.name || 'Faculty of Engineering';

    if (!deptMap.has(code)) {
      deptMap.set(code, {
        name: deptName,
        code,
        faculty: facultyName,
        facultyName,
        questFacultyId: fac?.id || facInfo.facultyId || null,
        program: {
          name: `Bachelor of ${deptName.replace(/ Engineering.*| Technology.*/i, '')}`,
          code: `B${code}`.slice(0, 10),
          level: 'Undergraduate',
          duration: 4,
          credits: 130,
          batches: BATCHES
        }
      });
    }

    const staffList = scraped.staffByDept[deptName] || scraped.staffByDept[`${deptName} Department`] || [];
    for (const s of staffList) {
      const email = s.emailFromSite || slugEmail(s.firstName, s.lastName, code, usedEmails);
      if (usedEmails.has(email)) {
        const existing = users.find(u => u.email === email);
        if (existing) {
          existing.roles = [...new Set([...(existing.roles || [existing.role]), ...s.roles])];
          if (s.roles.includes('chairman') && !existing.roles.includes('chairman')) existing.roles.push('chairman');
          existing.departmentCode = existing.departmentCode || code;
          continue;
        }
      }
      usedEmails.add(email);
      users.push({
        firstName: s.firstName,
        lastName: s.lastName,
        fullName: s.fullName,
        email,
        roles: s.roles,
        role: s.roles[0],
        designation: s.designation,
        departmentCode: code,
        employeeId: `${code}${String(users.filter(u => u.departmentCode === code).length + 1).padStart(3, '0')}`
      });
    }

    for (const c of page.courses) {
      courses.push({
        ...c,
        departmentCode: code,
        departmentName: deptName
      });
    }
  }

  // Chairman from staff directory when faculty page has no chairman
  for (const [, dept] of deptMap) {
    const staffList = scraped.staffByDept[dept.name] || scraped.staffByDept[`${dept.name} Department`] || [];
    const chairmanStaff = staffList.find(s => /chairman|head of department|hod/i.test(s.designation || ''));
    if (chairmanStaff) {
      const email = chairmanStaff.emailFromSite || slugEmail(chairmanStaff.firstName, chairmanStaff.lastName, dept.code, usedEmails);
      const existing = users.find(u => u.email === email);
      if (existing) {
        existing.roles = [...new Set([...(existing.roles || [existing.role]), 'chairman'])];
        existing.departmentCode = dept.code;
      } else {
        usedEmails.add(email);
        users.push({
          firstName: chairmanStaff.firstName,
          lastName: chairmanStaff.lastName,
          email,
          roles: ['chairman', 'teacher'],
          role: 'chairman',
          designation: chairmanStaff.designation || 'Chairman',
          departmentCode: dept.code,
          employeeId: `CH${dept.code}`
        });
      }
    }
  }

  // Chairman from faculty pages if not in directory
  for (const fac of scraped.faculties) {
    for (const d of fac.departments) {
      const code = deptCodeFromName(d.name);
      if (!d.chairmanName) continue;
      const chairman = splitPersonName(d.chairmanName.replace(/^Chairman:\s*/i, ''));
      if (!chairman) continue;
      const email = slugEmail(chairman.firstName, chairman.lastName, code, usedEmails);
      const existing = users.find(u => u.email === email);
      if (existing) {
        existing.roles = [...new Set([...(existing.roles || [existing.role]), 'chairman'])];
        existing.departmentCode = code;
      } else {
        users.push({
          ...chairman,
          email,
          roles: ['chairman', 'teacher'],
          role: 'chairman',
          designation: 'Chairman',
          departmentCode: code,
          employeeId: `CH${code}`
        });
      }
    }
  }

  for (const [, dept] of deptMap) {
    departments.push(dept);
  }

  const faculties = scraped.faculties.map(f => ({
    name: f.name,
    code: facultyCodeFromName(f.name),
    questFacultyId: f.id,
    deanName: f.deanName
  }));

  return {
    faculties,
    departments,
    users,
    courses,
    stats: {
      faculties: faculties.length,
      departments: departments.length,
      users: users.length,
      courses: courses.length,
      batches: BATCHES
    }
  };
}

function facultyCodeFromName(name) {
  const words = String(name || '').replace(/Faculty of /i, '').split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.map(w => w[0]).join('').toUpperCase().slice(0, 8);
  return String(name || 'FAC').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'FAC';
}

module.exports = {
  scrapeAll,
  buildSeedPayload,
  BATCHES,
  DEPARTMENT_IDS
};
