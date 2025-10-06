const express = require('express');
const { body, validationResult } = require('express-validator');
const Department = require('../models/Department');
const User = require('../models/User');
const { authenticateToken, authorize, checkDepartmentAccess } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/departments
// @desc    Get all departments
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { faculty, isActive = true } = req.query;
        
        let query = { isActive: isActive === 'true' };
        
        if (faculty) {
            query.faculty = faculty;
        }

        // Filter based on user role
        if (req.user.role === 'dean') {
            query._id = { $in: req.user.assignedFaculties.map(faculty => faculty._id) };
        }

        const departments = await Department.find(query)
            .populate('chairman', 'firstName lastName email')
            .populate('focalPersons.user', 'firstName lastName email')
            .sort({ name: 1 });

        res.json({
            success: true,
            data: { departments }
        });

    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/departments/:id
// @desc    Get department by ID
// @access  Private
router.get('/:id', authenticateToken, checkDepartmentAccess, async (req, res) => {
    try {
        const department = await Department.findById(req.params.id)
            .populate('chairman', 'firstName lastName email employeeId')
            .populate('focalPersons.user', 'firstName lastName email employeeId')
            .populate('programs');

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        res.json({
            success: true,
            data: { department }
        });

    } catch (error) {
        console.error('Get department error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   POST /api/departments
// @desc    Create new department
// @access  Private (Admin roles only)
router.post('/', authenticateToken, authorize('dean', 'controller'), [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Department name must be 2-100 characters'),
    body('code').trim().isLength({ min: 2, max: 10 }).withMessage('Department code must be 2-10 characters'),
    body('faculty').isIn(['Engineering', 'Sciences', 'Management', 'Arts', 'Medicine']).withMessage('Invalid faculty'),
    body('chairman').isMongoId().withMessage('Valid chairman ID required'),
    body('contactInfo.email').isEmail().withMessage('Valid email required'),
    body('contactInfo.phone').isMobilePhone().withMessage('Valid phone number required'),
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

        const { name, code, faculty, chairman, description, contactInfo, programs } = req.body;

        // Check if department with same name or code already exists
        const existingDept = await Department.findOne({
            $or: [{ name }, { code: code.toUpperCase() }]
        });

        if (existingDept) {
            return res.status(400).json({
                success: false,
                message: 'Department with this name or code already exists'
            });
        }

        // Verify chairman exists and has appropriate role
        const chairmanUser = await User.findById(chairman);
        if (!chairmanUser) {
            return res.status(400).json({
                success: false,
                message: 'Chairman not found'
            });
        }

        if (!['chairman', 'teacher'].includes(chairmanUser.role)) {
            return res.status(400).json({
                success: false,
                message: 'Chairman must have chairman or teacher role'
            });
        }

        const department = new Department({
            name,
            code: code.toUpperCase(),
            faculty,
            chairman,
            description,
            contactInfo,
            programs: programs || []
        });

        await department.save();

        // Update chairman's managed departments
        if (chairmanUser.role === 'chairman') {
            chairmanUser.managedDepartments.push(department._id);
            await chairmanUser.save();
        }

        // Update department statistics
        await department.updateStatistics();

        const populatedDepartment = await Department.findById(department._id)
            .populate('chairman', 'firstName lastName email')
            .populate('focalPersons.user', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'Department created successfully',
            data: { department: populatedDepartment }
        });

    } catch (error) {
        console.error('Create department error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   PUT /api/departments/:id
// @desc    Update department
// @access  Private (Admin roles only)
router.put('/:id', authenticateToken, authorize('dean', 'controller', 'chairman'), checkDepartmentAccess, [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Department name must be 2-100 characters'),
    body('code').optional().trim().isLength({ min: 2, max: 10 }).withMessage('Department code must be 2-10 characters'),
    body('faculty').optional().isIn(['Engineering', 'Sciences', 'Management', 'Arts', 'Medicine']).withMessage('Invalid faculty'),
    body('chairman').optional().isMongoId().withMessage('Valid chairman ID required'),
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

        const { id } = req.params;
        const updates = req.body;

        // Check if department exists
        const department = await Department.findById(id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // If chairman is being updated, verify new chairman
        if (updates.chairman && updates.chairman !== department.chairman.toString()) {
            const chairmanUser = await User.findById(updates.chairman);
            if (!chairmanUser) {
                return res.status(400).json({
                    success: false,
                    message: 'New chairman not found'
                });
            }

            if (!['chairman', 'teacher'].includes(chairmanUser.role)) {
                return res.status(400).json({
                    success: false,
                    message: 'New chairman must have chairman or teacher role'
                });
            }
        }

        const updatedDepartment = await Department.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        )
        .populate('chairman', 'firstName lastName email')
        .populate('focalPersons.user', 'firstName lastName email');

        res.json({
            success: true,
            message: 'Department updated successfully',
            data: { department: updatedDepartment }
        });

    } catch (error) {
        console.error('Update department error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   DELETE /api/departments/:id
// @desc    Deactivate department (soft delete)
// @access  Private (Admin roles only)
router.delete('/:id', authenticateToken, authorize('dean', 'controller'), async (req, res) => {
    try {
        const department = await Department.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        res.json({
            success: true,
            message: 'Department deactivated successfully',
            data: { department }
        });

    } catch (error) {
        console.error('Deactivate department error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/departments/assigned
// @desc    Get departments assigned to focal person
// @access  Private (Focal persons only)
router.get('/assigned', authenticateToken, authorize('focal'), async (req, res) => {
    try {
        const departments = await Department.find({
            _id: { $in: req.user.assignedDepartments },
            isActive: true
        })
        .populate('chairman', 'firstName lastName email')
        .populate('focalPersons.user', 'firstName lastName email');

        res.json({
            success: true,
            data: { departments }
        });

    } catch (error) {
        console.error('Get assigned departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/departments/managed
// @desc    Get departments managed by chairman
// @access  Private (Chairmen only)
router.get('/managed', authenticateToken, authorize('chairman'), async (req, res) => {
    try {
        const departments = await Department.find({
            _id: { $in: req.user.managedDepartments },
            isActive: true
        })
        .populate('chairman', 'firstName lastName email')
        .populate('focalPersons.user', 'firstName lastName email');

        res.json({
            success: true,
            data: { departments }
        });

    } catch (error) {
        console.error('Get managed departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   POST /api/departments/:id/focal-persons
// @desc    Add focal person to department
// @access  Private (Admin roles only)
router.post('/:id/focal-persons', authenticateToken, authorize('dean', 'controller', 'chairman'), checkDepartmentAccess, [
    body('userId').isMongoId().withMessage('Valid user ID required'),
    body('responsibilities').optional().isArray().withMessage('Responsibilities must be an array'),
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

        const { id } = req.params;
        const { userId, responsibilities = [] } = req.body;

        const department = await Department.findById(id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.role !== 'focal') {
            return res.status(400).json({
                success: false,
                message: 'User must have focal role'
            });
        }

        // Add focal person to department
        await department.addFocalPerson(userId, responsibilities);

        // Add department to user's assigned departments
        if (!user.assignedDepartments.includes(id)) {
            user.assignedDepartments.push(id);
            await user.save();
        }

        const updatedDepartment = await Department.findById(id)
            .populate('focalPersons.user', 'firstName lastName email')
            .populate('chairman', 'firstName lastName email');

        res.json({
            success: true,
            message: 'Focal person added successfully',
            data: { department: updatedDepartment }
        });

    } catch (error) {
        console.error('Add focal person error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   DELETE /api/departments/:id/focal-persons/:userId
// @desc    Remove focal person from department
// @access  Private (Admin roles only)
router.delete('/:id/focal-persons/:userId', authenticateToken, authorize('dean', 'controller', 'chairman'), checkDepartmentAccess, async (req, res) => {
    try {
        const { id, userId } = req.params;

        const department = await Department.findById(id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Remove focal person from department
        await department.removeFocalPerson(userId);

        // Remove department from user's assigned departments
        const user = await User.findById(userId);
        if (user) {
            user.assignedDepartments = user.assignedDepartments.filter(deptId => deptId.toString() !== id);
            await user.save();
        }

        const updatedDepartment = await Department.findById(id)
            .populate('focalPersons.user', 'firstName lastName email')
            .populate('chairman', 'firstName lastName email');

        res.json({
            success: true,
            message: 'Focal person removed successfully',
            data: { department: updatedDepartment }
        });

    } catch (error) {
        console.error('Remove focal person error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/departments/:id/statistics
// @desc    Get department statistics
// @access  Private
router.get('/:id/statistics', authenticateToken, checkDepartmentAccess, async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Update statistics
        await department.updateStatistics();

        // Get additional statistics
        const Course = require('../models/Course');
        const courseStats = await Course.aggregate([
            { $match: { department: department._id, isActive: true } },
            {
                $group: {
                    _id: null,
                    totalCourses: { $sum: 1 },
                    averageEnrollment: { $avg: { $size: '$enrolledStudents' } },
                    averageGrade: { $avg: '$statistics.averageGrade' }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                statistics: {
                    ...department.statistics,
                    ...(courseStats[0] || {})
                }
            }
        });

    } catch (error) {
        console.error('Get department statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;


