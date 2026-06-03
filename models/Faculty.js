const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 150
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: 12
    },
    description: {
        type: String,
        maxlength: 500
    },
    dean: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    questFacultyId: {
        type: Number,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

facultySchema.index({ name: 1 });
facultySchema.index({ code: 1 });

module.exports = facultySchema;
