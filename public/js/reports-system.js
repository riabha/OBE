// Comprehensive Reports System for Teacher Dashboard
// Database integration, interactive charts, export functionality

// Global variables for report management
let currentReportData = null;
let currentReportType = null;
let reportFilters = {
    academicYear: '2024',
    semester: 'Fall',
    course: 'all',
    student: 'all',
    startDate: '',
    endDate: ''
};

// Chart instances
let performanceChart = null;
let cloChart = null;

// Initialize reports system
function initializeReports() {
    console.log('Initializing comprehensive reports system...');
    loadReportFilters();
    setupChartDefaults();
}

// Load report filters from database
async function loadReportFilters() {
    try {
        // Load academic years
        const yearsResponse = await fetch('/api/reports/academic-years');
        if (yearsResponse.ok) {
            const years = await yearsResponse.json();
            populateSelect('academicYear', years);
        }

        // Load courses
        const coursesResponse = await fetch('/api/reports/courses');
        if (coursesResponse.ok) {
            const courses = await coursesResponse.json();
            populateSelect('courseFilter', courses);
        }

        // Load students
        const studentsResponse = await fetch('/api/reports/students');
        if (studentsResponse.ok) {
            const students = await studentsResponse.json();
            populateSelect('studentFilter', students);
        }

        // Set default dates
        const today = new Date();
        const semesterStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        document.getElementById('startDate').value = semesterStart.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];

    } catch (error) {
        console.error('Error loading report filters:', error);
        showAlert('Error loading report filters. Using default values.', 'warning');
    }
}

// Populate select dropdown
function populateSelect(selectId, data) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Clear existing options except first
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }

    // Add new options
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.value || item.id;
        option.textContent = item.text || item.name;
        select.appendChild(option);
    });
}

// Apply filters
function applyFilters() {
    reportFilters = {
        academicYear: document.getElementById('academicYear').value,
        semester: document.getElementById('semester').value,
        course: document.getElementById('courseFilter').value,
        student: document.getElementById('studentFilter').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value
    };

    showAlert('Filters applied successfully', 'success');
    
    // Refresh current report if one is displayed
    if (currentReportType) {
        refreshReport();
    }
}

// Clear filters
function clearFilters() {
    document.getElementById('academicYear').value = '2024';
    document.getElementById('semester').value = 'Fall';
    document.getElementById('courseFilter').value = 'all';
    document.getElementById('studentFilter').value = 'all';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    
    reportFilters = {
        academicYear: '2024',
        semester: 'Fall',
        course: 'all',
        student: 'all',
        startDate: '',
        endDate: ''
    };

    showAlert('Filters cleared', 'info');
}

// ==================== STUDENT WISE REPORTS ====================

// Generate Semester Report
async function generateSemesterReport() {
    try {
        showLoadingSpinner();
        
        const response = await fetch('/api/reports/semester', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportFilters)
        });

        if (response.ok) {
            const data = await response.json();
            displaySemesterReport(data);
        } else {
            throw new Error('Failed to generate semester report');
        }
    } catch (error) {
        console.error('Error generating semester report:', error);
        showAlert('Error generating semester report: ' + error.message, 'error');
    } finally {
        hideLoadingSpinner();
    }
}

// Display Semester Report
function displaySemesterReport(data) {
    currentReportType = 'semester';
    currentReportData = data;
    
    document.getElementById('reportTitle').textContent = 'Semester Report - ' + reportFilters.semester + ' ' + reportFilters.academicYear;
    
    const content = `
        <div class="row">
            <div class="col-md-12">
                <h6 class="text-primary mb-3">Student Performance Summary</h6>
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead class="table-primary">
                            <tr>
                                <th>Student ID</th>
                                <th>Name</th>
                                <th>Course</th>
                                <th>Midterm</th>
                                <th>Final</th>
                                <th>Assignments</th>
                                <th>Total</th>
                                <th>Grade</th>
                                <th>GPA</th>
                                <th>Attendance %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.students.map(student => `
                                <tr>
                                    <td>${student.id}</td>
                                    <td>${student.name}</td>
                                    <td>${student.course}</td>
                                    <td>${student.midterm}</td>
                                    <td>${student.final}</td>
                                    <td>${student.assignments}</td>
                                    <td>${student.total}</td>
                                    <td><span class="badge bg-${getGradeColor(student.grade)}">${student.grade}</span></td>
                                    <td>${student.gpa}</td>
                                    <td>
                                        <div class="progress" style="height: 20px;">
                                            <div class="progress-bar bg-${getAttendanceColor(student.attendance)}" 
                                                 style="width: ${student.attendance}%">${student.attendance}%</div>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">Grade Distribution</h6>
                    </div>
                    <div class="card-body">
                        <canvas id="gradeDistributionChart"></canvas>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">Attendance Overview</h6>
                    </div>
                    <div class="card-body">
                        <canvas id="attendanceChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('reportContent').innerHTML = content;
    document.getElementById('reportDisplayArea').style.display = 'block';
    
    // Generate charts
    generateGradeDistributionChart(data.gradeDistribution);
    generateAttendanceChart(data.attendanceData);
}

// Generate GPA Transcript
async function generateGPATranscript() {
    try {
        showLoadingSpinner();
        
        const response = await fetch('/api/reports/gpa-transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportFilters)
        });

        if (response.ok) {
            const data = await response.json();
            displayGPATranscript(data);
        } else {
            throw new Error('Failed to generate GPA transcript');
        }
    } catch (error) {
        console.error('Error generating GPA transcript:', error);
        showAlert('Error generating GPA transcript: ' + error.message, 'error');
    } finally {
        hideLoadingSpinner();
    }
}

// Display GPA Transcript
function displayGPATranscript(data) {
    currentReportType = 'gpa-transcript';
    currentReportData = data;
    
    document.getElementById('reportTitle').textContent = 'GPA Transcript - ' + data.studentName;
    
    const content = `
        <div class="row">
            <div class="col-md-4">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <h4>${data.overallGPA}</h4>
                        <p class="mb-0">Overall GPA</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <h4>${data.totalCredits}</h4>
                        <p class="mb-0">Total Credits</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-info text-white">
                    <div class="card-body text-center">
                        <h4>${data.completedCourses}</h4>
                        <p class="mb-0">Completed Courses</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-md-12">
                <h6 class="text-primary mb-3">Academic History</h6>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead class="table-primary">
                            <tr>
                                <th>Semester</th>
                                <th>Course Code</th>
                                <th>Course Name</th>
                                <th>Credits</th>
                                <th>Grade</th>
                                <th>GPA Points</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.courses.map(course => `
                                <tr>
                                    <td>${course.semester}</td>
                                    <td>${course.code}</td>
                                    <td>${course.name}</td>
                                    <td>${course.credits}</td>
                                    <td><span class="badge bg-${getGradeColor(course.grade)}">${course.grade}</span></td>
                                    <td>${course.gpaPoints}</td>
                                    <td><span class="badge bg-${course.status === 'Completed' ? 'success' : 'warning'}">${course.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-md-12">
                <canvas id="gpaTrendChart"></canvas>
            </div>
        </div>
    `;
    
    document.getElementById('reportContent').innerHTML = content;
    document.getElementById('reportDisplayArea').style.display = 'block';
    
    // Generate GPA trend chart
    generateGPATrendChart(data.gpaHistory);
}

// Generate OBE Transcript
async function generateOBETranscript() {
    try {
        showLoadingSpinner();
        
        const response = await fetch('/api/reports/obe-transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportFilters)
        });

        if (response.ok) {
            const data = await response.json();
            displayOBETranscript(data);
        } else {
            throw new Error('Failed to generate OBE transcript');
        }
    } catch (error) {
        console.error('Error generating OBE transcript:', error);
        showAlert('Error generating OBE transcript: ' + error.message, 'error');
    } finally {
        hideLoadingSpinner();
    }
}

// Display OBE Transcript
function displayOBETranscript(data) {
    currentReportType = 'obe-transcript';
    currentReportData = data;
    
    document.getElementById('reportTitle').textContent = 'OBE Transcript - ' + data.studentName;
    
    const content = `
        <div class="row">
            <div class="col-md-6">
                <h6 class="text-primary mb-3">CLO Attainment</h6>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead class="table-primary">
                            <tr>
                                <th>CLO Code</th>
                                <th>Description</th>
                                <th>Attainment Level</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.clos.map(clo => `
                                <tr>
                                    <td>${clo.code}</td>
                                    <td>${clo.description}</td>
                                    <td>
                                        <div class="progress" style="height: 20px;">
                                            <div class="progress-bar bg-${getAttainmentColor(clo.attainment)}" 
                                                 style="width: ${clo.attainment}%">${clo.attainment}%</div>
                                        </div>
                                    </td>
                                    <td><span class="badge bg-${clo.attainment >= 70 ? 'success' : 'warning'}">${clo.attainment >= 70 ? 'Achieved' : 'Not Achieved'}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="col-md-6">
                <h6 class="text-success mb-3">PLO Attainment</h6>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead class="table-success">
                            <tr>
                                <th>PLO Code</th>
                                <th>Description</th>
                                <th>Attainment Level</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.plos.map(plo => `
                                <tr>
                                    <td>${plo.code}</td>
                                    <td>${plo.description}</td>
                                    <td>
                                        <div class="progress" style="height: 20px;">
                                            <div class="progress-bar bg-${getAttainmentColor(plo.attainment)}" 
                                                 style="width: ${plo.attainment}%">${plo.attainment}%</div>
                                        </div>
                                    </td>
                                    <td><span class="badge bg-${plo.attainment >= 70 ? 'success' : 'warning'}">${plo.attainment >= 70 ? 'Achieved' : 'Not Achieved'}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-md-6">
                <canvas id="cloAttainmentChart"></canvas>
            </div>
            <div class="col-md-6">
                <canvas id="ploAttainmentChart"></canvas>
            </div>
        </div>
    `;
    
    document.getElementById('reportContent').innerHTML = content;
    document.getElementById('reportDisplayArea').style.display = 'block';
    
    // Generate charts
    generateCLOAttainmentChart(data.clos);
    generatePLOAttainmentChart(data.plos);
}

// ==================== COURSE WISE REPORTS ====================

// Generate Course CLO Attainment
async function generateCourseCLOAttainment() {
    try {
        showLoadingSpinner();
        
        const response = await fetch('/api/reports/course-clo-attainment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportFilters)
        });

        if (response.ok) {
            const data = await response.json();
            displayCourseCLOAttainment(data);
        } else {
            throw new Error('Failed to generate course CLO attainment report');
        }
    } catch (error) {
        console.error('Error generating course CLO attainment:', error);
        showAlert('Error generating course CLO attainment: ' + error.message, 'error');
    } finally {
        hideLoadingSpinner();
    }
}

// Display Course CLO Attainment
function displayCourseCLOAttainment(data) {
    currentReportType = 'course-clo-attainment';
    currentReportData = data;
    
    document.getElementById('reportTitle').textContent = 'Course CLO Attainment - ' + data.courseName;
    
    const content = `
        <div class="row">
            <div class="col-md-12">
                <div class="alert alert-info">
                    <h6 class="mb-2">Course Information</h6>
                    <p class="mb-0"><strong>Course:</strong> ${data.courseName} (${data.courseCode})</p>
                    <p class="mb-0"><strong>Instructor:</strong> ${data.instructor}</p>
                    <p class="mb-0"><strong>Semester:</strong> ${data.semester} ${data.academicYear}</p>
                    <p class="mb-0"><strong>Total Students:</strong> ${data.totalStudents}</p>
                </div>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-12">
                <h6 class="text-primary mb-3">CLO Attainment Summary</h6>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead class="table-primary">
                            <tr>
                                <th>CLO Code</th>
                                <th>Description</th>
                                <th>Assessment Method</th>
                                <th>Target %</th>
                                <th>Actual %</th>
                                <th>Status</th>
                                <th>Students Achieved</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.clos.map(clo => `
                                <tr>
                                    <td>${clo.code}</td>
                                    <td>${clo.description}</td>
                                    <td>${clo.assessmentMethod}</td>
                                    <td>${clo.target}%</td>
                                    <td>
                                        <div class="progress" style="height: 20px;">
                                            <div class="progress-bar bg-${getAttainmentColor(clo.actual)}" 
                                                 style="width: ${clo.actual}%">${clo.actual}%</div>
                                        </div>
                                    </td>
                                    <td><span class="badge bg-${clo.actual >= clo.target ? 'success' : 'danger'}">${clo.actual >= clo.target ? 'Achieved' : 'Not Achieved'}</span></td>
                                    <td>${clo.studentsAchieved}/${data.totalStudents}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-md-6">
                <canvas id="courseCLOChart"></canvas>
            </div>
            <div class="col-md-6">
                <canvas id="studentPerformanceChart"></canvas>
            </div>
        </div>
    `;
    
    document.getElementById('reportContent').innerHTML = content;
    document.getElementById('reportDisplayArea').style.display = 'block';
    
    // Generate charts
    generateCourseCLOChart(data.clos);
    generateStudentPerformanceChart(data.studentPerformance);
}

// ==================== OBE MAPPING REPORTS ====================

// Generate Vision & Mission Report
async function generateVisionMissionReport() {
    try {
        showLoadingSpinner();
        
        const response = await fetch('/api/reports/vision-mission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportFilters)
        });

        if (response.ok) {
            const data = await response.json();
            displayVisionMissionReport(data);
        } else {
            throw new Error('Failed to generate vision & mission report');
        }
    } catch (error) {
        console.error('Error generating vision & mission report:', error);
        showAlert('Error generating vision & mission report: ' + error.message, 'error');
    } finally {
        hideLoadingSpinner();
    }
}

// Display Vision & Mission Report
function displayVisionMissionReport(data) {
    currentReportType = 'vision-mission';
    currentReportData = data;
    
    document.getElementById('reportTitle').textContent = 'Vision & Mission Alignment Report';
    
    const content = `
        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0">Institutional Vision</h6>
                    </div>
                    <div class="card-body">
                        <p class="mb-3">${data.vision}</p>
                        <h6>Alignment with Program Outcomes:</h6>
                        <div class="progress mb-2">
                            <div class="progress-bar bg-success" style="width: ${data.visionAlignment}%">${data.visionAlignment}%</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-success text-white">
                        <h6 class="mb-0">Institutional Mission</h6>
                    </div>
                    <div class="card-body">
                        <p class="mb-3">${data.mission}</p>
                        <h6>Alignment with Program Outcomes:</h6>
                        <div class="progress mb-2">
                            <div class="progress-bar bg-info" style="width: ${data.missionAlignment}%">${data.missionAlignment}%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-md-12">
                <h6 class="text-primary mb-3">Program Educational Objectives (PEOs)</h6>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead class="table-primary">
                            <tr>
                                <th>PEO Code</th>
                                <th>Description</th>
                                <th>Vision Alignment</th>
                                <th>Mission Alignment</th>
                                <th>Overall Alignment</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.peos.map(peo => `
                                <tr>
                                    <td>${peo.code}</td>
                                    <td>${peo.description}</td>
                                    <td>
                                        <div class="progress" style="height: 20px;">
                                            <div class="progress-bar bg-primary" style="width: ${peo.visionAlignment}%">${peo.visionAlignment}%</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="progress" style="height: 20px;">
                                            <div class="progress-bar bg-success" style="width: ${peo.missionAlignment}%">${peo.missionAlignment}%</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="badge bg-${peo.overallAlignment >= 80 ? 'success' : peo.overallAlignment >= 60 ? 'warning' : 'danger'}">
                                            ${peo.overallAlignment}%
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('reportContent').innerHTML = content;
    document.getElementById('reportDisplayArea').style.display = 'block';
}

// ==================== CHART GENERATION FUNCTIONS ====================

// Setup chart defaults
function setupChartDefaults() {
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#666';
}

// Generate Grade Distribution Chart
function generateGradeDistributionChart(data) {
    const ctx = document.getElementById('gradeDistributionChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.values,
                backgroundColor: [
                    '#28a745', '#20c997', '#17a2b8', '#ffc107', '#fd7e14', '#dc3545'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Grade Distribution'
                }
            }
        }
    });
}

// Generate Attendance Chart
function generateAttendanceChart(data) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Attendance %',
                data: data.values,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Attendance Overview'
                }
            }
        }
    });
}

// Generate GPA Trend Chart
function generateGPATrendChart(data) {
    const ctx = document.getElementById('gpaTrendChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'GPA',
                data: data.values,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 4.0
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'GPA Trend Over Time'
                }
            }
        }
    });
}

// Generate CLO Attainment Chart
function generateCLOAttainmentChart(data) {
    const ctx = document.getElementById('cloAttainmentChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'CLO Attainment',
                data: data.values,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(255, 99, 132, 1)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'CLO Attainment Levels'
                }
            }
        }
    });
}

// Generate PLO Attainment Chart
function generatePLOAttainmentChart(data) {
    const ctx = document.getElementById('ploAttainmentChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.values,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 205, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)',
                    'rgba(255, 159, 64, 0.6)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 205, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'PLO Attainment Levels'
                }
            }
        }
    });
}

// Generate Course CLO Chart
function generateCourseCLOChart(data) {
    const ctx = document.getElementById('courseCLOChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(clo => clo.code),
            datasets: [{
                label: 'Target %',
                data: data.map(clo => clo.target),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }, {
                label: 'Actual %',
                data: data.map(clo => clo.actual),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'CLO Target vs Actual Attainment'
                }
            }
        }
    });
}

// Generate Student Performance Chart
function generateStudentPerformanceChart(data) {
    const ctx = document.getElementById('studentPerformanceChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Student Performance',
                data: data.map(student => ({
                    x: student.attendance,
                    y: student.grade
                })),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Attendance %'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Grade'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Attendance vs Grade Correlation'
                }
            }
        }
    });
}

// ==================== UTILITY FUNCTIONS ====================

// Get grade color
function getGradeColor(grade) {
    if (grade >= 'A') return 'success';
    if (grade >= 'B') return 'info';
    if (grade >= 'C') return 'warning';
    return 'danger';
}

// Get attendance color
function getAttendanceColor(attendance) {
    if (attendance >= 90) return 'success';
    if (attendance >= 75) return 'warning';
    return 'danger';
}

// Get attainment color
function getAttainmentColor(attainment) {
    if (attainment >= 80) return 'success';
    if (attainment >= 60) return 'warning';
    return 'danger';
}

// Show loading spinner
function showLoadingSpinner() {
    const spinner = document.createElement('div');
    spinner.id = 'loadingSpinner';
    spinner.className = 'text-center p-4';
    spinner.innerHTML = `
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">Generating report...</p>
    `;
    
    document.getElementById('reportContent').innerHTML = '';
    document.getElementById('reportContent').appendChild(spinner);
    document.getElementById('reportDisplayArea').style.display = 'block';
}

// Hide loading spinner
function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.remove();
    }
}

// Refresh current report
function refreshReport() {
    if (currentReportType) {
        switch (currentReportType) {
            case 'semester':
                generateSemesterReport();
                break;
            case 'gpa-transcript':
                generateGPATranscript();
                break;
            case 'obe-transcript':
                generateOBETranscript();
                break;
            case 'course-clo-attainment':
                generateCourseCLOAttainment();
                break;
            case 'vision-mission':
                generateVisionMissionReport();
                break;
            default:
                showAlert('No report to refresh', 'warning');
        }
    } else {
        showAlert('No report to refresh', 'warning');
    }
}

// Export current report
function exportCurrentReport() {
    if (currentReportData) {
        const dataStr = JSON.stringify(currentReportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${currentReportType}-report.json`;
        link.click();
        URL.revokeObjectURL(url);
        showAlert('Report exported successfully', 'success');
    } else {
        showAlert('No report to export', 'warning');
    }
}

// Export to PDF
function exportToPDF() {
    if (currentReportData) {
        // Implementation for PDF export
        showAlert('PDF export functionality will be implemented', 'info');
    } else {
        showAlert('No report to export', 'warning');
    }
}

// Export to Excel
function exportToExcel() {
    if (currentReportData) {
        // Implementation for Excel export
        showAlert('Excel export functionality will be implemented', 'info');
    } else {
        showAlert('No report to export', 'warning');
    }
}

// Print report
function printReport() {
    if (currentReportData) {
        window.print();
    } else {
        showAlert('No report to print', 'warning');
    }
}

// Load reports section
function loadReports() {
    initializeReports();
    showAlert('Comprehensive reports system loaded', 'success');
}

// ==================== PLACEHOLDER FUNCTIONS FOR REMAINING REPORTS ====================

// Student Wise Reports
function generateCLOAttainment() {
    showAlert('CLO Attainment report will be implemented', 'info');
}

function generatePLOAttainment() {
    showAlert('PLO Attainment report will be implemented', 'info');
}

// Course Wise Reports
function generateCoursePLOAttainment() {
    showAlert('Course PLO Attainment report will be implemented', 'info');
}

function generateAwardList() {
    showAlert('Award List report will be implemented', 'info');
}

function generateAwardListDetailed() {
    showAlert('Award List Detailed report will be implemented', 'info');
}

// OBE Mapping Reports
function generateCLOtoPLOMapping() {
    showAlert('CLO to PLO Mapping report will be implemented', 'info');
}

function generatePEOtoPLOMapping() {
    showAlert('PEO to PLO Mapping report will be implemented', 'info');
}
