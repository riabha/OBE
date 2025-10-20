const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    // Basic Information
    title: {
        type: String,
        required: [true, 'Course title is required'],
        trim: true,
        maxlength: [200, 'Course title cannot exceed 200 characters']
    },
    code: {
        type: String,
        required: [true, 'Course code is required'],
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: [10, 'Course code cannot exceed 10 characters']
    },
    description: {
        type: String,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    
    // Department and Program Information
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: [true, 'Department is required']
    },
    program: {
        type: String,
        required: [true, 'Program is required']
    },
    semester: {
        type: Number,
        required: [true, 'Semester is required'],
        min: 1,
        max: 8
    },
    
    // Course Details
    credits: {
        type: Number,
        required: [true, 'Credits are required'],
        min: 1,
        max: 6
    },
    hours: {
        theory: {
            type: Number,
            required: true,
            min: 0
        },
        practical: {
            type: Number,
            required: true,
            min: 0
        },
        total: {
            type: Number,
            required: true,
            min: 1
        }
    },
    
    // Instructor Information
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Instructor is required']
    },
    coInstructors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // Learning Outcomes
    learningOutcomes: [{
        outcome: {
            type: String,
            required: true,
            maxlength: [500, 'Outcome cannot exceed 500 characters']
        },
        level: {
            type: String,
            required: true,
            enum: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']
        },
        weight: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    
    // Assessment Methods
    assessments: [{
        name: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true,
            enum: ['Quiz', 'Assignment', 'Midterm', 'Final', 'Project', 'Presentation', 'Lab Work']
        },
        weight: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        dueDate: {
            type: Date,
            required: true
        },
        description: String,
        maxMarks: {
            type: Number,
            required: true,
            min: 0
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    
    // Enrollment Information
    enrolledStudents: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        enrollmentDate: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['enrolled', 'dropped', 'completed', 'failed'],
            default: 'enrolled'
        },
        finalGrade: {
            type: String,
            enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'I', 'W'],
            default: null
        },
        totalMarks: {
            type: Number,
            default: 0
        },
        percentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    }],
    
    // Schedule Information
    schedule: {
        days: [{
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        }],
        time: {
            start: String,
            end: String
        },
        room: String,
        building: String
    },
    
    // Prerequisites and Corequisites
    prerequisites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    }],
    corequisites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    }],
    
    // Course Materials
    materials: [{
        title: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['Textbook', 'Reference Book', 'Article', 'Video', 'Document', 'Link'],
            required: true
        },
        url: String,
        description: String,
        isRequired: {
            type: Boolean,
            default: false
        }
    }],
    
    // Statistics
    statistics: {
        totalEnrolled: {
            type: Number,
            default: 0
        },
        totalCompleted: {
            type: Number,
            default: 0
        },
        averageGrade: {
            type: Number,
            default: 0
        },
        passRate: {
            type: Number,
            default: 0
        }
    },
    
    // Academic Year and Semester
    academicYear: {
        type: String,
        required: true
    },
    semesterName: {
        type: String,
        required: true,
        enum: ['Fall', 'Spring', 'Summer']
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

// Virtual for total assessment weight
courseSchema.virtual('totalAssessmentWeight').get(function() {
    return this.assessments
        .filter(assessment => assessment.isActive)
        .reduce((total, assessment) => total + assessment.weight, 0);
});

// Virtual for enrolled students count
courseSchema.virtual('enrolledCount').get(function() {
    return this.enrolledStudents.filter(student => student.status === 'enrolled').length;
});

// Index for better query performance
courseSchema.index({ code: 1 });
courseSchema.index({ department: 1 });
courseSchema.index({ instructor: 1 });
courseSchema.index({ semester: 1 });
courseSchema.index({ academicYear: 1, semesterName: 1 });
courseSchema.index({ isActive: 1 });

// Pre-save middleware to calculate total hours and update statistics
courseSchema.pre('save', function(next) {
    this.hours.total = this.hours.theory + this.hours.practical;
    
    if (this.isModified('enrolledStudents')) {
        this.statistics.totalEnrolled = this.enrolledStudents.filter(s => s.status === 'enrolled').length;
        this.statistics.totalCompleted = this.enrolledStudents.filter(s => s.status === 'completed').length;
        
        const completedStudents = this.enrolledStudents.filter(s => s.status === 'completed' && s.percentage > 0);
        if (completedStudents.length > 0) {
            this.statistics.averageGrade = completedStudents.reduce((sum, s) => sum + s.percentage, 0) / completedStudents.length;
            this.statistics.passRate = (completedStudents.filter(s => s.percentage >= 50).length / completedStudents.length) * 100;
        }
    }
    
    next();
});

// Static method to find courses by department
courseSchema.statics.findByDepartment = function(departmentId) {
    return this.find({ department: departmentId, isActive: true });
};

// Static method to find courses by instructor
courseSchema.statics.findByInstructor = function(instructorId) {
    return this.find({ 
        $or: [
            { instructor: instructorId },
            { coInstructors: instructorId }
        ],
        isActive: true 
    });
};

// Static method to find courses by academic year
courseSchema.statics.findByAcademicYear = function(academicYear, semesterName) {
    const query = { academicYear, isActive: true };
    if (semesterName) {
        query.semesterName = semesterName;
    }
    return this.find(query);
};

// Method to enroll student
courseSchema.methods.enrollStudent = function(studentId) {
    const existingEnrollment = this.enrolledStudents.find(es => es.student.toString() === studentId.toString());
    if (existingEnrollment) {
        throw new Error('Student is already enrolled in this course');
    }
    
    this.enrolledStudents.push({
        student: studentId,
        enrollmentDate: new Date(),
        status: 'enrolled'
    });
    
    return this.save();
};

// Method to drop student
courseSchema.methods.dropStudent = function(studentId) {
    const enrollment = this.enrolledStudents.find(es => es.student.toString() === studentId.toString());
    if (enrollment) {
        enrollment.status = 'dropped';
        return this.save();
    }
    throw new Error('Student not found in this course');
};

// Method to update student grade
courseSchema.methods.updateStudentGrade = function(studentId, totalMarks, finalGrade) {
    const enrollment = this.enrolledStudents.find(es => es.student.toString() === studentId.toString());
    if (enrollment) {
        enrollment.totalMarks = totalMarks;
        enrollment.finalGrade = finalGrade;
        enrollment.percentage = (totalMarks / this.assessments.reduce((sum, a) => sum + a.maxMarks, 0)) * 100;
        enrollment.status = enrollment.percentage >= 50 ? 'completed' : 'failed';
        return this.save();
    }
    throw new Error('Student not found in this course');
};

// Export the schema for dynamic database connections
module.exports = courseSchema;


