const mongoose = require('mongoose');

const platformUserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['pro-superadmin', 'platform-admin', 'support'],
        default: 'platform-admin'
    },
    permissions: {
        type: [String],
        default: ['all']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
platformUserSchema.index({ email: 1 });
platformUserSchema.index({ role: 1 });

module.exports = platformUserSchema;

