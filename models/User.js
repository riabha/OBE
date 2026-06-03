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
    
    // Role and Access Control (role = primary/active; roles = all assigned roles)
    role: {
        type: String,
        required: [true, 'Role is required'],
        enum: {
            values: ['student', 'teacher', 'focal', 'chairman', 'dean', 'controller'],
            message: 'Role must be one of: student, teacher, focal, chairman, dean, controller'
        }
    },
    roles: {
        type: [String],
        enum: ['student', 'teacher', 'focal', 'chairman', 'dean', 'controller'],
        default: undefined
    },
    
    // Department Information
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: function() {
            const roles = this.getRoles();
            return !roles.some(r => ['controller', 'dean'].includes(r));
        }
    },
    
    // Student Specific Fields
    studentId: {
        type: String,
        unique: true,
        sparse: true,
        required: function() {
            return this.getRoles().includes('student');
        }
    },
    semester: {
        type: Number,
        min: 1,
        max: 8,
        required: function() {
            return this.getRoles().includes('student');
        }
    },
    batch: {
        type: String,
        required: function() {
            return this.getRoles().includes('student');
        }
    },
    
    // Teacher Specific Fields
    employeeId: {
        type: String,
        unique: true,
        sparse: true,
        required: function() {
            return this.getRoles().some(r => ['teacher', 'focal', 'chairman'].includes(r));
        }
    },
    designation: {
        type: String,
        required: function() {
            return this.getRoles().some(r => ['teacher', 'focal', 'chairman'].includes(r));
        }
    },
    qualification: {
        type: String,
        required: function() {
            return this.getRoles().some(r => ['teacher', 'focal', 'chairman'].includes(r));
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

// Resolve all roles assigned to this user
userSchema.methods.getRoles = function() {
    if (Array.isArray(this.roles) && this.roles.length) {
        return [...new Set(this.roles.filter(Boolean))];
    }
    return this.role ? [this.role] : [];
};

// Pre-save middleware to hash password and sync roles
userSchema.pre('save', async function(next) {
    if (Array.isArray(this.roles) && this.roles.length) {
        if (!this.role || !this.roles.includes(this.role)) {
            this.role = this.roles[0];
        }
    } else if (this.role) {
        this.roles = [this.role];
    }

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

// Method to get user permissions based on active role
userSchema.methods.getPermissions = function(activeRole) {
    const role = activeRole || this.role;
    const rolePermissions = {
        student: ['read'],
        teacher: ['read', 'write'],
        focal: ['read', 'write'],
        chairman: ['read', 'write', 'delete'],
        dean: ['read', 'write', 'delete', 'admin'],
        controller: ['read', 'write', 'delete', 'admin']
    };
    
    return rolePermissions[role] || [];
};

// Method to check if user can access department for a given active role
userSchema.methods.canAccessDepartment = function(departmentId, activeRole) {
    const role = activeRole || this.role;
    if (role === 'controller') return true;
    if (role === 'dean') {
        return this.assignedFaculties.some(faculty => faculty.toString() === departmentId.toString());
    }
    if (role === 'chairman') {
        return this.managedDepartments.some(dept => dept.toString() === departmentId.toString());
    }
    if (role === 'focal') {
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


