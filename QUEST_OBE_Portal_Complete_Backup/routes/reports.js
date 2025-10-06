const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/reports/dashboard
// @desc    Get dashboard statistics
// @access  Private
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let statistics = {};

        // Role-based statistics
        switch (user.role) {
            case 'student':
                statistics = {
                    enrolledCourses: 6,
                    completedOutcomes: 24,
                    averageGPA: 3.75,
                    pendingAssessments: 3
                };
                break;
            case 'teacher':
                statistics = {
                    totalCourses: 4,
                    totalStudents: 120,
                    pendingAssessments: 8,
                    averageGrade: 85
                };
                break;
            case 'focal':
                statistics = {
                    assignedDepartments: 2,
                    totalTeachers: 25,
                    totalStudents: 500,
                    activeCourses: 45
                };
                break;
            case 'chairman':
                statistics = {
                    managedDepartments: 1,
                    facultyMembers: 30,
                    studentEnrollment: 600,
                    activePrograms: 8
                };
                break;
            case 'dean':
                statistics = {
                    assignedFaculties: 3,
                    totalDepartments: 12,
                    facultyMembers: 150,
                    studentEnrollment: 2500
                };
                break;
            case 'controller':
                statistics = {
                    upcomingExams: 25,
                    resultsPublished: 150,
                    totalStudents: 2500,
                    pendingResults: 12
                };
                break;
        }

        res.json({
            success: true,
            data: { statistics }
        });

    } catch (error) {
        console.error('Get dashboard statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;


