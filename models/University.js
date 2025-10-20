const mongoose = require('mongoose');

const universitySchema = new mongoose.Schema({
    universityName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    universityCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    databaseName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    logo: {
        type: String,
        default: null
    },
    primaryColor: {
        type: String,
        default: '#2563eb'
    },
    secondaryColor: {
        type: String,
        default: '#7c3aed'
    },
    address: {
        type: String,
        default: null
    },
    city: {
        type: String,
        default: null
    },
    country: {
        type: String,
        default: 'Pakistan'
    },
    contactEmail: {
        type: String,
        trim: true,
        lowercase: true
    },
    contactPhone: {
        type: String,
        default: null
    },
    website: {
        type: String,
        default: null
    },
    superAdminEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    subscriptionPlan: {
        type: String,
        enum: ['Basic', 'Standard', 'Premium', 'Enterprise'],
        default: 'Basic'
    },
    subscriptionStatus: {
        type: String,
        enum: ['Active', 'Inactive', 'Suspended', 'Trial'],
        default: 'Active'
    },
    maxUsers: {
        type: Number,
        default: 1000
    },
    maxCourses: {
        type: Number,
        default: 100
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Automatically manages createdAt and updatedAt
});

// Index for faster queries
universitySchema.index({ universityCode: 1 });
universitySchema.index({ superAdminEmail: 1 });
universitySchema.index({ databaseName: 1 });

// Virtual for full name
universitySchema.virtual('displayName').get(function() {
    return `${this.universityName} (${this.universityCode})`;
});

// Method to generate database name
universitySchema.statics.generateDatabaseName = function(universityCode) {
    return `obe_university_${universityCode.toLowerCase()}`;
};

module.exports = universitySchema;

