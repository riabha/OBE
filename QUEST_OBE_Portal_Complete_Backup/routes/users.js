const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Department = require('../models/Department');
const { authenticateToken, authorize, checkDepartmentAccess } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (with role-based filtering)
// @access  Private (Admin roles only)
router.get('/', authenticateToken, authorize('dean', 'controller'), async (req, res) => {
    try {
        const { role, department, page = 1, limit = 10 } = req.query;
        
        // Build query based on user role and permissions
        let query = { isActive: true };
        
        if (role) {
            query.role = role;
        }
        
        if (department) {
            query.department = department;
        }
        
        // Dean can only see users from assigned faculties
        if (req.user.role === 'dean') {
            const userDepartments = req.user.assignedFaculties.map(faculty => faculty._id);
            query.department = { $in: userDepartments };
        }
        
        // Focal can only see users from assigned departments
        if (req.user.role === 'focal') {
            const userDepartments = req.user.assignedDepartments.map(dept => dept._id);
            query.department = { $in: userDepartments };
        }
        
        // Chairman can only see users from managed departments
        if (req.user.role === 'chairman') {
            const userDepartments = req.user.managedDepartments.map(dept => dept._id);
            query.department = { $in: userDepartments };
        }

        const users = await User.find(query)
            .populate('department', 'name code')
            .select('-password')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('department', 'name code')
            .populate('assignedDepartments', 'name code')
            .populate('managedDepartments', 'name code')
            .populate('assignedFaculties', 'name code')
            .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has permission to view this user
        if (req.user.role === 'student' && req.user._id.toString() !== user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            data: { user }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin roles or self)
router.put('/:id', authenticateToken, [
    body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
    body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
    body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
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

        const userId = req.params.id;
        const currentUser = req.user;

        // Check permissions
        const canUpdate = currentUser._id.toString() === userId.toString() || 
                         ['dean', 'controller', 'chairman', 'focal'].includes(currentUser.role);
        
        if (!canUpdate) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const allowedUpdates = ['firstName', 'lastName', 'phone', 'bio'];
        const updates = {};

        // Only allow specific fields for non-admin users
        if (currentUser._id.toString() === userId.toString()) {
            allowedUpdates.forEach(field => {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            });
        } else {
            // Admin can update more fields
            const adminUpdates = [...allowedUpdates, 'role', 'isActive', 'department'];
            adminUpdates.forEach(field => {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            updates,
            { new: true, runValidators: true }
        )
        .populate('department', 'name code')
        .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully',
            data: { user }
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   DELETE /api/users/:id
// @desc    Deactivate user (soft delete)
// @access  Private (Admin roles only)
router.delete('/:id', authenticateToken, authorize('dean', 'controller', 'chairman'), async (req, res) => {
    try {
        const userId = req.params.id;

        // Don't allow users to deactivate themselves
        if (req.user._id.toString() === userId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot deactivate your own account'
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { isActive: false },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User deactivated successfully',
            data: { user }
        });

    } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/users/department/:departmentId
// @desc    Get users by department
// @access  Private
router.get('/department/:departmentId', authenticateToken, checkDepartmentAccess, async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { role } = req.query;

        let query = { 
            department: departmentId, 
            isActive: true 
        };

        if (role) {
            query.role = role;
        }

        const users = await User.find(query)
            .populate('department', 'name code')
            .select('-password')
            .sort({ role: 1, firstName: 1 });

        res.json({
            success: true,
            data: { users }
        });

    } catch (error) {
        console.error('Get department users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/users/role/:role
// @desc    Get users by role
// @access  Private (Admin roles only)
router.get('/role/:role', authenticateToken, authorize('dean', 'controller'), async (req, res) => {
    try {
        const { role } = req.params;
        
        const validRoles = ['student', 'teacher', 'focal', 'chairman', 'dean', 'controller'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        const users = await User.findByRole(role)
            .populate('department', 'name code')
            .select('-password')
            .sort({ firstName: 1 });

        res.json({
            success: true,
            data: { users }
        });

    } catch (error) {
        console.error('Get users by role error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   POST /api/users/:id/assign-department
// @desc    Assign user to department (for focal persons)
// @access  Private (Admin roles only)
router.post('/:id/assign-department', authenticateToken, authorize('dean', 'controller'), [
    body('departmentId').isMongoId().withMessage('Valid department ID required'),
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
        const { departmentId, responsibilities = [] } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.role !== 'focal') {
            return res.status(400).json({
                success: false,
                message: 'Can only assign departments to focal persons'
            });
        }

        // Check if department exists
        const department = await Department.findById(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Add department to assigned departments if not already assigned
        if (!user.assignedDepartments.includes(departmentId)) {
            user.assignedDepartments.push(departmentId);
            await user.save();

            // Add user as focal person to department
            await department.addFocalPerson(user._id, responsibilities);
        }

        const updatedUser = await User.findById(id)
            .populate('assignedDepartments', 'name code')
            .select('-password');

        res.json({
            success: true,
            message: 'Department assigned successfully',
            data: { user: updatedUser }
        });

    } catch (error) {
        console.error('Assign department error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;


