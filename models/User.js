const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Basic Information
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    
    // Role and Access Control
    role: {
        type: String,
        required: [true, 'Role is required'],
        enum: {
            values: ['student', 'teacher', 'focal', 'chairman', 'dean', 'controller'],
            message: 'Role must be one of: student, teacher, focal, chairman, dean, controller'
        }
    },
    
    // Department Information
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: function() {
            return this.role !== 'controller' && this.role !== 'dean';
        }
    },
    
    // Student Specific Fields
    studentId: {
        type: String,
        unique: true,
        sparse: true,
        required: function() {
            return this.role === 'student';
        }
    },
    semester: {
        type: Number,
        min: 1,
        max: 8,
        required: function() {
            return this.role === 'student';
        }
    },
    batch: {
        type: String,
        required: function() {
            return this.role === 'student';
        }
    },
    
    // Teacher Specific Fields
    employeeId: {
        type: String,
        unique: true,
        sparse: true,
        required: function() {
            return ['teacher', 'focal', 'chairman'].includes(this.role);
        }
    },
    designation: {
        type: String,
        required: function() {
            return ['teacher', 'focal', 'chairman'].includes(this.role);
        }
    },
    qualification: {
        type: String,
        required: function() {
            return ['teacher', 'focal', 'chairman'].includes(this.role);
        }
    },
    
    // Focal Person Specific Fields
    assignedDepartments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    }],
    
    // Chairman Specific Fields
    managedDepartments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    }],
    
    // Dean Specific Fields
    assignedFaculties: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    }],
    
    // Contact Information
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
    },
    
    // Account Status
    isActive: {
        type: Boolean,
        default: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: null
    },
    
    // Profile Information
    profilePicture: {
        type: String,
        default: null
    },
    bio: {
        type: String,
        maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    
    // Permissions
    permissions: [{
        type: String,
        enum: ['read', 'write', 'delete', 'admin']
    }],
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ department: 1 });
userSchema.index({ studentId: 1 });
userSchema.index({ employeeId: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get user permissions based on role
userSchema.methods.getPermissions = function() {
    const rolePermissions = {
        student: ['read'],
        teacher: ['read', 'write'],
        focal: ['read', 'write'],
        chairman: ['read', 'write', 'delete'],
        dean: ['read', 'write', 'delete', 'admin'],
        controller: ['read', 'write', 'delete', 'admin']
    };
    
    return rolePermissions[this.role] || [];
};

// Method to check if user can access department
userSchema.methods.canAccessDepartment = function(departmentId) {
    if (this.role === 'controller') return true;
    if (this.role === 'dean') {
        return this.assignedFaculties.some(faculty => faculty.toString() === departmentId.toString());
    }
    if (this.role === 'chairman') {
        return this.managedDepartments.some(dept => dept.toString() === departmentId.toString());
    }
    if (this.role === 'focal') {
        return this.assignedDepartments.some(dept => dept.toString() === departmentId.toString());
    }
    return this.department.toString() === departmentId.toString();
};

// Static method to find users by role
userSchema.statics.findByRole = function(role) {
    return this.find({ role, isActive: true });
};

// Static method to find users by department
userSchema.statics.findByDepartment = function(departmentId) {
    return this.find({ 
        department: departmentId, 
        isActive: true,
        role: { $in: ['student', 'teacher'] }
    });
};

// Export the schema for dynamic database connections
module.exports = userSchema;


