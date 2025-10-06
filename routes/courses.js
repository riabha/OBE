const express = require('express');
const { body, validationResult } = require('express-validator');
const Course = require('../models/Course');
const { authenticateToken, authorize, checkCourseAccess } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/courses
// @desc    Get all courses (with role-based filtering)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { department, instructor, semester, academicYear, page = 1, limit = 10 } = req.query;
        
        let query = { isActive: true };
        
        if (department) query.department = department;
        if (instructor) query.instructor = instructor;
        if (semester) query.semester = parseInt(semester);
        if (academicYear) query.academicYear = academicYear;

        // Role-based filtering
        if (req.user.role === 'student') {
            // Students can see courses from their department or enrolled courses
            query.$or = [
                { department: req.user.department },
                { 'enrolledStudents.student': req.user._id }
            ];
        } else if (req.user.role === 'teacher') {
            // Teachers can see their own courses or courses from their department
            query.$or = [
                { instructor: req.user._id },
                { coInstructors: req.user._id },
                { department: req.user.department }
            ];
        }

        const courses = await Course.find(query)
            .populate('department', 'name code')
            .populate('instructor', 'firstName lastName email')
            .populate('coInstructors', 'firstName lastName email')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ academicYear: -1, semester: 1, title: 1 });

        const total = await Course.countDocuments(query);

        res.json({
            success: true,
            data: {
                courses,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });

    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/courses/teacher
// @desc    Get courses taught by current teacher
// @access  Private (Teachers only)
router.get('/teacher', authenticateToken, authorize('teacher'), async (req, res) => {
    try {
        const courses = await Course.findByInstructor(req.user._id)
            .populate('department', 'name code')
            .populate('enrolledStudents.student', 'firstName lastName studentId')
            .sort({ academicYear: -1, semester: 1 });

        res.json({
            success: true,
            data: { courses }
        });

    } catch (error) {
        console.error('Get teacher courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/courses/student
// @desc    Get courses enrolled by current student
// @access  Private (Students only)
router.get('/student', authenticateToken, authorize('student'), async (req, res) => {
    try {
        const courses = await Course.find({
            'enrolledStudents.student': req.user._id,
            isActive: true
        })
        .populate('department', 'name code')
        .populate('instructor', 'firstName lastName email')
        .populate('coInstructors', 'firstName lastName email')
        .sort({ academicYear: -1, semester: 1 });

        res.json({
            success: true,
            data: { courses }
        });

    } catch (error) {
        console.error('Get student courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/courses/:id
// @desc    Get course by ID
// @access  Private
router.get('/:id', authenticateToken, checkCourseAccess, async (req, res) => {
    try {
        const course = req.course; // From checkCourseAccess middleware

        const populatedCourse = await Course.findById(course._id)
            .populate('department', 'name code')
            .populate('instructor', 'firstName lastName email employeeId')
            .populate('coInstructors', 'firstName lastName email employeeId')
            .populate('enrolledStudents.student', 'firstName lastName studentId email')
            .populate('prerequisites', 'title code')
            .populate('corequisites', 'title code');

        res.json({
            success: true,
            data: { course: populatedCourse }
        });

    } catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   POST /api/courses
// @desc    Create new course
// @access  Private (Admin roles and teachers)
router.post('/', authenticateToken, authorize('teacher', 'chairman', 'dean', 'controller'), [
    body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Course title must be 2-200 characters'),
    body('code').trim().isLength({ min: 2, max: 10 }).withMessage('Course code must be 2-10 characters'),
    body('department').isMongoId().withMessage('Valid department ID required'),
    body('program').notEmpty().withMessage('Program is required'),
    body('semester').isInt({ min: 1, max: 8 }).withMessage('Semester must be 1-8'),
    body('credits').isInt({ min: 1, max: 6 }).withMessage('Credits must be 1-6'),
    body('instructor').isMongoId().withMessage('Valid instructor ID required'),
    body('academicYear').notEmpty().withMessage('Academic year is required'),
    body('semesterName').isIn(['Fall', 'Spring', 'Summer']).withMessage('Invalid semester name'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const courseData = req.body;

        // Check if course with same code already exists
        const existingCourse = await Course.findOne({ code: courseData.code.toUpperCase() });
        if (existingCourse) {
            return res.status(400).json({
                success: false,
                message: 'Course with this code already exists'
            });
        }

        // Verify instructor exists
        const instructor = await User.findById(courseData.instructor);
        if (!instructor) {
            return res.status(400).json({
                success: false,
                message: 'Instructor not found'
            });
        }

        const course = new Course({
            ...courseData,
            code: courseData.code.toUpperCase()
        });

        await course.save();

        const populatedCourse = await Course.findById(course._id)
            .populate('department', 'name code')
            .populate('instructor', 'firstName lastName email')
            .populate('coInstructors', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'Course created successfully',
            data: { course: populatedCourse }
        });

    } catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   PUT /api/courses/:id
// @desc    Update course
// @access  Private (Instructor and admin roles)
router.put('/:id', authenticateToken, checkCourseAccess, [
    body('title').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Course title must be 2-200 characters'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const course = req.course; // From checkCourseAccess middleware
        const updates = req.body;

        // Check if user can update this course
        const canUpdate = req.user.role === 'controller' || 
                         req.user.role === 'dean' ||
                         req.user.role === 'chairman' ||
                         course.instructor.toString() === req.user._id.toString() ||
                         course.coInstructors.some(co => co.toString() === req.user._id.toString());

        if (!canUpdate) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const allowedUpdates = ['title', 'description', 'learningOutcomes', 'assessments', 'materials'];
        const filteredUpdates = {};

        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        });

        const updatedCourse = await Course.findByIdAndUpdate(
            course._id,
            filteredUpdates,
            { new: true, runValidators: true }
        )
        .populate('department', 'name code')
        .populate('instructor', 'firstName lastName email')
        .populate('coInstructors', 'firstName lastName email');

        res.json({
            success: true,
            message: 'Course updated successfully',
            data: { course: updatedCourse }
        });

    } catch (error) {
        console.error('Update course error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   POST /api/courses/:id/enroll
// @desc    Enroll student in course
// @access  Private (Students and admin roles)
router.post('/:id/enroll', authenticateToken, checkCourseAccess, async (req, res) => {
    try {
        const course = req.course; // From checkCourseAccess middleware

        // Only students can enroll themselves, or admin can enroll any student
        if (req.user.role === 'student') {
            await course.enrollStudent(req.user._id);
        } else if (['controller', 'dean', 'chairman', 'focal'].includes(req.user.role)) {
            const { studentId } = req.body;
            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID required'
                });
            }
            await course.enrollStudent(studentId);
        } else {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const updatedCourse = await Course.findById(course._id)
            .populate('enrolledStudents.student', 'firstName lastName studentId');

        res.json({
            success: true,
            message: 'Student enrolled successfully',
            data: { course: updatedCourse }
        });

    } catch (error) {
        console.error('Enroll student error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   DELETE /api/courses/:id/enroll/:studentId
// @desc    Drop student from course
// @access  Private (Students and admin roles)
router.delete('/:id/enroll/:studentId', authenticateToken, checkCourseAccess, async (req, res) => {
    try {
        const course = req.course; // From checkCourseAccess middleware
        const { studentId } = req.params;

        // Check permissions
        const canDrop = req.user.role === 'controller' || 
                       req.user.role === 'dean' ||
                       req.user.role === 'chairman' ||
                       req.user.role === 'focal' ||
                       (req.user.role === 'student' && req.user._id.toString() === studentId);

        if (!canDrop) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await course.dropStudent(studentId);

        const updatedCourse = await Course.findById(course._id)
            .populate('enrolledStudents.student', 'firstName lastName studentId');

        res.json({
            success: true,
            message: 'Student dropped successfully',
            data: { course: updatedCourse }
        });

    } catch (error) {
        console.error('Drop student error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   PUT /api/courses/:id/grades/:studentId
// @desc    Update student grade
// @access  Private (Instructor and admin roles)
router.put('/:id/grades/:studentId', authenticateToken, checkCourseAccess, [
    body('totalMarks').isNumeric().withMessage('Total marks must be numeric'),
    body('finalGrade').isIn(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'I', 'W']).withMessage('Invalid grade'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const course = req.course; // From checkCourseAccess middleware
        const { studentId } = req.params;
        const { totalMarks, finalGrade } = req.body;

        // Check if user can update grades
        const canUpdateGrades = req.user.role === 'controller' || 
                               req.user.role === 'dean' ||
                               req.user.role === 'chairman' ||
                               course.instructor.toString() === req.user._id.toString() ||
                               course.coInstructors.some(co => co.toString() === req.user._id.toString());

        if (!canUpdateGrades) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await course.updateStudentGrade(studentId, totalMarks, finalGrade);

        const updatedCourse = await Course.findById(course._id)
            .populate('enrolledStudents.student', 'firstName lastName studentId');

        res.json({
            success: true,
            message: 'Grade updated successfully',
            data: { course: updatedCourse }
        });

    } catch (error) {
        console.error('Update grade error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/courses/:id/statistics
// @desc    Get course statistics
// @access  Private
router.get('/:id/statistics', authenticateToken, checkCourseAccess, async (req, res) => {
    try {
        const course = req.course; // From checkCourseAccess middleware

        const statistics = {
            totalEnrolled: course.enrolledStudents.filter(s => s.status === 'enrolled').length,
            totalCompleted: course.enrolledStudents.filter(s => s.status === 'completed').length,
            averageGrade: course.statistics.averageGrade,
            passRate: course.statistics.passRate,
            gradeDistribution: {
                'A+': course.enrolledStudents.filter(s => s.finalGrade === 'A+').length,
                'A': course.enrolledStudents.filter(s => s.finalGrade === 'A').length,
                'A-': course.enrolledStudents.filter(s => s.finalGrade === 'A-').length,
                'B+': course.enrolledStudents.filter(s => s.finalGrade === 'B+').length,
                'B': course.enrolledStudents.filter(s => s.finalGrade === 'B').length,
                'B-': course.enrolledStudents.filter(s => s.finalGrade === 'B-').length,
                'C+': course.enrolledStudents.filter(s => s.finalGrade === 'C+').length,
                'C': course.enrolledStudents.filter(s => s.finalGrade === 'C').length,
                'C-': course.enrolledStudents.filter(s => s.finalGrade === 'C-').length,
                'D': course.enrolledStudents.filter(s => s.finalGrade === 'D').length,
                'F': course.enrolledStudents.filter(s => s.finalGrade === 'F').length,
            }
        };

        res.json({
            success: true,
            data: { statistics }
        });

    } catch (error) {
        console.error('Get course statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;


