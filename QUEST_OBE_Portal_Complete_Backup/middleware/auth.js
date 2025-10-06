const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access token required' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024');
        
        const user = await User.findById(decoded.userId).select('-password');
        if (!user || !user.isActive) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token or user not found' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired' 
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        }
        return res.status(500).json({ 
            success: false, 
            message: 'Authentication error' 
        });
    }
};

// Middleware to check user roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Insufficient permissions' 
            });
        }

        next();
    };
};

// Middleware to check department access
const checkDepartmentAccess = async (req, res, next) => {
    try {
        const user = req.user;
        const departmentId = req.params.departmentId || req.body.departmentId;

        if (!departmentId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Department ID required' 
            });
        }

        // Controller can access all departments
        if (user.role === 'controller') {
            return next();
        }

        // Dean can access assigned faculties
        if (user.role === 'dean') {
            const hasAccess = user.assignedFaculties.some(faculty => 
                faculty.toString() === departmentId.toString()
            );
            if (!hasAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied to this department' 
                });
            }
            return next();
        }

        // Chairman can access managed departments
        if (user.role === 'chairman') {
            const hasAccess = user.managedDepartments.some(dept => 
                dept.toString() === departmentId.toString()
            );
            if (!hasAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied to this department' 
                });
            }
            return next();
        }

        // Focal can access assigned departments
        if (user.role === 'focal') {
            const hasAccess = user.assignedDepartments.some(dept => 
                dept.toString() === departmentId.toString()
            );
            if (!hasAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied to this department' 
                });
            }
            return next();
        }

        // Students and teachers can only access their own department
        if (user.department.toString() !== departmentId.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied to this department' 
            });
        }

        next();
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: 'Department access check failed' 
        });
    }
};

// Middleware to check course access
const checkCourseAccess = async (req, res, next) => {
    try {
        const user = req.user;
        const courseId = req.params.courseId || req.body.courseId;

        if (!courseId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Course ID required' 
            });
        }

        const Course = require('../models/Course');
        const course = await Course.findById(courseId).populate('department');

        if (!course) {
            return res.status(404).json({ 
                success: false, 
                message: 'Course not found' 
            });
        }

        // Controller can access all courses
        if (user.role === 'controller') {
            req.course = course;
            return next();
        }

        // Dean can access courses in assigned faculties
        if (user.role === 'dean') {
            const hasAccess = user.assignedFaculties.some(faculty => 
                faculty.toString() === course.department._id.toString()
            );
            if (!hasAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied to this course' 
                });
            }
            req.course = course;
            return next();
        }

        // Chairman can access courses in managed departments
        if (user.role === 'chairman') {
            const hasAccess = user.managedDepartments.some(dept => 
                dept.toString() === course.department._id.toString()
            );
            if (!hasAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied to this course' 
                });
            }
            req.course = course;
            return next();
        }

        // Focal can access courses in assigned departments
        if (user.role === 'focal') {
            const hasAccess = user.assignedDepartments.some(dept => 
                dept.toString() === course.department._id.toString()
            );
            if (!hasAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied to this course' 
                });
            }
            req.course = course;
            return next();
        }

        // Teachers can access their own courses
        if (user.role === 'teacher') {
            const isInstructor = course.instructor.toString() === user._id.toString() ||
                               course.coInstructors.some(co => co.toString() === user._id.toString());
            const isSameDepartment = user.department.toString() === course.department._id.toString();
            
            if (!isInstructor && !isSameDepartment) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied to this course' 
                });
            }
            req.course = course;
            return next();
        }

        // Students can access courses they are enrolled in or from their department
        if (user.role === 'student') {
            const isEnrolled = course.enrolledStudents.some(es => 
                es.student.toString() === user._id.toString()
            );
            const isSameDepartment = user.department.toString() === course.department._id.toString();
            
            if (!isEnrolled && !isSameDepartment) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied to this course' 
                });
            }
            req.course = course;
            return next();
        }

        req.course = course;
        next();
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: 'Course access check failed' 
        });
    }
};

// Middleware to log user activity
const logActivity = (action) => {
    return (req, res, next) => {
        const originalSend = res.send;
        
        res.send = function(data) {
            // Log activity here (you can implement logging to database)
            console.log(`User ${req.user?.email} performed action: ${action} at ${new Date().toISOString()}`);
            originalSend.call(this, data);
        };
        
        next();
    };
};

module.exports = {
    authenticateToken,
    authorize,
    checkDepartmentAccess,
    checkCourseAccess,
    logActivity
};


