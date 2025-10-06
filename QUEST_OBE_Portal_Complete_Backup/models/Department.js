const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    // Basic Information
    name: {
        type: String,
        required: [true, 'Department name is required'],
        unique: true,
        trim: true,
        maxlength: [100, 'Department name cannot exceed 100 characters']
    },
    code: {
        type: String,
        required: [true, 'Department code is required'],
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: [10, 'Department code cannot exceed 10 characters']
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    
    // Faculty Information
    faculty: {
        type: String,
        required: [true, 'Faculty is required'],
        enum: {
            values: ['Engineering', 'Sciences', 'Management', 'Arts', 'Medicine'],
            message: 'Faculty must be one of: Engineering, Sciences, Management, Arts, Medicine'
        }
    },
    
    // Leadership
    chairman: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() {
            return this.isActive;
        }
    },
    focalPersons: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        assignedDate: {
            type: Date,
            default: Date.now
        },
        responsibilities: [{
            type: String,
            enum: ['academic', 'examination', 'research', 'student_affairs']
        }]
    }],
    
    // Academic Information
    programs: [{
        name: {
            type: String,
            required: true
        },
        code: {
            type: String,
            required: true,
            uppercase: true
        },
        level: {
            type: String,
            required: true,
            enum: ['Undergraduate', 'Graduate', 'Postgraduate']
        },
        duration: {
            type: Number,
            required: true,
            min: 1,
            max: 8
        },
        credits: {
            type: Number,
            required: true,
            min: 120
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    
    // OBE Configuration
    obeSettings: {
        outcomeLevels: [{
            level: {
                type: String,
                enum: ['Program Outcomes', 'Course Outcomes', 'Learning Outcomes']
            },
            description: String,
            isActive: {
                type: Boolean,
                default: true
            }
        }],
        assessmentMethods: [{
            name: String,
            weight: {
                type: Number,
                min: 0,
                max: 100
            },
            description: String
        }],
        evaluationCriteria: {
            excellent: {
                min: Number,
                max: Number,
                description: String
            },
            good: {
                min: Number,
                max: Number,
                description: String
            },
            satisfactory: {
                min: Number,
                max: Number,
                description: String
            },
            needsImprovement: {
                min: Number,
                max: Number,
                description: String
            }
        }
    },
    
    // Statistics
    statistics: {
        totalStudents: {
            type: Number,
            default: 0
        },
        totalTeachers: {
            type: Number,
            default: 0
        },
        totalCourses: {
            type: Number,
            default: 0
        },
        activePrograms: {
            type: Number,
            default: 0
        }
    },
    
    // Contact Information
    contactInfo: {
        email: {
            type: String,
            required: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
        },
        phone: {
            type: String,
            required: true
        },
        address: {
            street: String,
            city: String,
            postalCode: String
        },
        officeHours: {
            start: String,
            end: String,
            days: [String]
        }
    },
    
    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    
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

// Virtual for department strength
departmentSchema.virtual('totalStrength').get(function() {
    return this.statistics.totalStudents + this.statistics.totalTeachers;
});

// Virtual for active programs count
departmentSchema.virtual('activeProgramsCount').get(function() {
    return this.programs.filter(program => program.isActive).length;
});

// Index for better query performance
departmentSchema.index({ name: 1 });
departmentSchema.index({ code: 1 });
departmentSchema.index({ faculty: 1 });
departmentSchema.index({ chairman: 1 });
departmentSchema.index({ isActive: 1 });

// Pre-save middleware to update statistics
departmentSchema.pre('save', async function(next) {
    if (this.isModified('programs')) {
        this.statistics.activePrograms = this.programs.filter(p => p.isActive).length;
    }
    next();
});

// Static method to find departments by faculty
departmentSchema.statics.findByFaculty = function(faculty) {
    return this.find({ faculty, isActive: true });
};

// Static method to find active departments
departmentSchema.statics.findActive = function() {
    return this.find({ isActive: true });
};

// Method to add focal person
departmentSchema.methods.addFocalPerson = function(userId, responsibilities = []) {
    const existingFocal = this.focalPersons.find(fp => fp.user.toString() === userId.toString());
    if (existingFocal) {
        throw new Error('User is already a focal person in this department');
    }
    
    this.focalPersons.push({
        user: userId,
        responsibilities,
        assignedDate: new Date()
    });
    
    return this.save();
};

// Method to remove focal person
departmentSchema.methods.removeFocalPerson = function(userId) {
    this.focalPersons = this.focalPersons.filter(fp => fp.user.toString() !== userId.toString());
    return this.save();
};

// Method to update statistics
departmentSchema.methods.updateStatistics = async function() {
    const User = mongoose.model('User');
    const Course = mongoose.model('Course');
    
    this.statistics.totalStudents = await User.countDocuments({ 
        department: this._id, 
        role: 'student', 
        isActive: true 
    });
    
    this.statistics.totalTeachers = await User.countDocuments({ 
        department: this._id, 
        role: { $in: ['teacher', 'focal'] }, 
        isActive: true 
    });
    
    this.statistics.totalCourses = await Course.countDocuments({ 
        department: this._id, 
        isActive: true 
    });
    
    this.statistics.activePrograms = this.programs.filter(p => p.isActive).length;
    
    return this.save();
};

module.exports = mongoose.model('Department', departmentSchema);


