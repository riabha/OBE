/**
 * Persist OBE portal changes to the API (assessments, results, courses, bulk import).
 */
const ObeWrites = {
    async refreshDashboard() {
        DashboardData.clear();
        const data = await DashboardData.load(true);
        window.__dashboardData = data;
        return data;
    },

    async getCourseEnrollments(courseCode) {
        return APIManager.get(`/api/courses/${encodeURIComponent(courseCode)}/enrollments`);
    },

    async getCourseClos(courseCode) {
        return APIManager.get(`/api/clos?courseCode=${encodeURIComponent(courseCode)}`);
    },

    async createCourse(payload) {
        return APIManager.post('/api/courses', payload);
    },

    async createUser(payload) {
        return APIManager.post('/api/users', payload);
    },

    async createClo(payload) {
        return APIManager.post('/api/clos', payload);
    },

    async createAssessment(payload) {
        return APIManager.post('/api/assessments', payload);
    },

    async updateAssessment(id, payload) {
        return APIManager.put(`/api/assessments/${id}`, payload);
    },

    async deleteAssessment(id) {
        return APIManager.delete(`/api/assessments/${id}`);
    },

    async importResults(courseCode, records) {
        return APIManager.post('/api/results/import', { courseCode, records });
    },

    parseCsvFile(file) {
        return new Promise((resolve, reject) => {
            if (typeof Papa === 'undefined') {
                reject(new Error('CSV parser not loaded'));
                return;
            }
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (r) => resolve(r.data || []),
                error: (e) => reject(e)
            });
        });
    },

    csvRowsToResultRecords(rows, courseCode) {
        const records = [];
        const skip = new Set(['studentid', 'student id', 'name', 'email', 'department', 'semester', 'batch', 'phone', 'full name']);
        rows.forEach(row => {
            const keys = Object.keys(row);
            const sid = row.studentId || row.StudentId || row['Student ID'] || row.student_id || row.ID;
            if (!sid) return;
            keys.forEach(key => {
                if (skip.has(key.toLowerCase().trim())) return;
                const raw = row[key];
                if (raw === '' || raw == null) return;
                const marks = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
                if (Number.isNaN(marks)) return;
                records.push({
                    studentId: String(sid).trim(),
                    assessmentName: key.trim(),
                    marksObtained: marks,
                    maxMarks: 100,
                    courseCode
                });
            });
        });
        return records;
    },

    async importResultsFromCsvFile(file, courseCode) {
        const rows = await this.parseCsvFile(file);
        const records = this.csvRowsToResultRecords(rows, courseCode);
        if (!records.length) {
            throw new Error('No valid result rows found in file. Use Student ID column plus mark columns.');
        }
        return this.importResults(courseCode, records);
    },

    async updateClo(id, payload) {
        return APIManager.put(`/api/clos/${id}`, payload);
    },

    async deleteClo(id) {
        return APIManager.delete(`/api/clos/${id}`);
    },

    async bulkCreateClos(records) {
        return APIManager.post('/api/clos/bulk', { records });
    },

    async getCloMappings() {
        return APIManager.get('/api/clos/mappings');
    },

    async saveCloMappings(mappings, courseCode) {
        return APIManager.put('/api/clos/mappings', { mappings, courseCode });
    },

    async createPlo(payload) {
        return APIManager.post('/api/plos', payload);
    },

    async updatePlo(id, payload) {
        return APIManager.put(`/api/plos/${id}`, payload);
    },

    async createPeo(payload) {
        return APIManager.post('/api/peos', payload);
    },

    async updatePeo(id, payload) {
        return APIManager.put(`/api/peos/${id}`, payload);
    },

    async recalculateAttainment(courseCode) {
        return APIManager.post('/api/obe/recalculate-attainment', courseCode ? { courseCode } : {});
    },

    async seedOutcomes() {
        return APIManager.post('/api/obe/seed-outcomes', {});
    },

    async getAttainments(params = {}) {
        const q = new URLSearchParams(params).toString();
        return APIManager.get(`/api/attainments${q ? '?' + q : ''}`);
    },

    async getCqiAlerts() {
        return APIManager.get('/api/obe/cqi');
    },

    async bulkImportUsers(records) {
        return APIManager.post('/api/users/bulk', { records });
    },

    csvRowsToUserRecords(rows, defaultRole) {
        return rows.map(row => {
            const name = row['Full Name'] || row.Name || row.name || '';
            const email = row['Email Address'] || row.Email || row.email || '';
            if (!email) return null;
            const rec = {
                name,
                email,
                role: (row.role || row.Role || defaultRole || 'student').toLowerCase(),
                department: row.Department || row.department || '',
                phone: row.Phone || row.phone || '',
                semester: row.Semester || row.semester,
                batch: row['Batch Year'] || row.batch || row.Batch
            };
            if (rec.role === 'student') {
                rec.studentId = row['Student ID'] || row.StudentId || row.studentId || row.ID;
            } else {
                rec.employeeId = row['Employee ID'] || row.EmployeeId || row.employeeId;
                rec.designation = row.Designation || row.designation || 'Faculty';
                rec.qualification = row.Qualification || row.qualification || 'MSc';
            }
            return rec;
        }).filter(Boolean);
    },

    async importUsersFromCsvFile(file, defaultRole) {
        const rows = await this.parseCsvFile(file);
        const records = this.csvRowsToUserRecords(rows, defaultRole);
        if (!records.length) {
            throw new Error('No valid user rows found. Check email and ID columns.');
        }
        return this.bulkImportUsers(records);
    },

    downloadCsv(filename, rows) {
        if (!rows.length) throw new Error('No data to export');
        const headers = Object.keys(rows[0]);
        const lines = [
            headers.join(','),
            ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }
};

window.ObeWrites = ObeWrites;
