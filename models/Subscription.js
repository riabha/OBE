const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    // University Reference
    university: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'University',
        required: true,
        unique: true
    },
    universityCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    
    // Subscription Plan
    planType: {
        type: String,
        enum: ['Free', 'Basic', 'Standard', 'Premium', 'Enterprise'],
        default: 'Free',
        required: true
    },
    planName: {
        type: String,
        required: true
    },
    
    // Billing Information
    billingCycle: {
        type: String,
        enum: ['Monthly', 'Quarterly', 'Yearly', 'Lifetime'],
        default: 'Monthly'
    },
    amount: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        default: 'PKR',
        enum: ['PKR', 'USD', 'EUR', 'GBP']
    },
    
    // Subscription Status
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Suspended', 'Cancelled', 'Trial', 'Expired'],
        default: 'Trial',
        required: true
    },
    
    // Subscription Dates
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    trialEndDate: {
        type: Date,
        default: null
    },
    lastBillingDate: {
        type: Date,
        default: null
    },
    nextBillingDate: {
        type: Date,
        default: null
    },
    
    // Usage Limits
    limits: {
        maxUsers: {
            type: Number,
            default: 50,
            min: 0
        },
        maxCourses: {
            type: Number,
            default: 20,
            min: 0
        },
        maxDepartments: {
            type: Number,
            default: 10,
            min: 0
        },
        maxStorage: {
            type: Number, // in MB
            default: 1000,
            min: 0
        }
    },
    
    // Current Usage
    usage: {
        totalUsers: {
            type: Number,
            default: 0,
            min: 0
        },
        totalCourses: {
            type: Number,
            default: 0,
            min: 0
        },
        totalDepartments: {
            type: Number,
            default: 0,
            min: 0
        },
        storageUsed: {
            type: Number, // in MB
            default: 0,
            min: 0
        }
    },
    
    // Features Access
    features: {
        cloManagement: {
            type: Boolean,
            default: true
        },
        assessments: {
            type: Boolean,
            default: true
        },
        reports: {
            type: Boolean,
            default: true
        },
        advancedAnalytics: {
            type: Boolean,
            default: false
        },
        apiAccess: {
            type: Boolean,
            default: false
        },
        customBranding: {
            type: Boolean,
            default: false
        },
        prioritySupport: {
            type: Boolean,
            default: false
        }
    },
    
    // Payment History
    payments: [{
        amount: Number,
        currency: String,
        paymentDate: {
            type: Date,
            default: Date.now
        },
        paymentMethod: String,
        transactionId: String,
        status: {
            type: String,
            enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
            default: 'Completed'
        },
        invoice: String
    }],
    
    // Notes and History
    notes: {
        type: String,
        maxlength: 1000
    },
    autoRenew: {
        type: Boolean,
        default: false
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
    timestamps: true
});

// Indexes for faster queries
subscriptionSchema.index({ university: 1 });
subscriptionSchema.index({ universityCode: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 });
subscriptionSchema.index({ planType: 1 });

// Virtual for days remaining
subscriptionSchema.virtual('daysRemaining').get(function() {
    if (!this.endDate) return 0;
    const now = new Date();
    const end = new Date(this.endDate);
    const diff = end - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Method to check if subscription is active
subscriptionSchema.methods.isSubscriptionActive = function() {
    if (this.status !== 'Active') return false;
    if (!this.endDate) return false;
    return new Date() < new Date(this.endDate);
};

// Method to check if feature is available
subscriptionSchema.methods.hasFeature = function(featureName) {
    return this.features[featureName] === true;
};

// Method to check usage limit
subscriptionSchema.methods.canAddUser = function() {
    return this.usage.totalUsers < this.limits.maxUsers;
};

subscriptionSchema.methods.canAddCourse = function() {
    return this.usage.totalCourses < this.limits.maxCourses;
};

subscriptionSchema.methods.canAddDepartment = function() {
    return this.usage.totalDepartments < this.limits.maxDepartments;
};

// Static method to get subscription plans
subscriptionSchema.statics.getPlans = function() {
    return [
        {
            type: 'Free',
            name: 'Free Trial',
            price: 0,
            duration: 30, // days
            limits: {
                maxUsers: 50,
                maxCourses: 10,
                maxDepartments: 3,
                maxStorage: 500
            }
        },
        {
            type: 'Basic',
            name: 'Basic Plan',
            price: 5000, // PKR per month
            limits: {
                maxUsers: 200,
                maxCourses: 50,
                maxDepartments: 10,
                maxStorage: 5000
            }
        },
        {
            type: 'Standard',
            name: 'Standard Plan',
            price: 15000, // PKR per month
            limits: {
                maxUsers: 500,
                maxCourses: 150,
                maxDepartments: 25,
                maxStorage: 20000
            }
        },
        {
            type: 'Premium',
            name: 'Premium Plan',
            price: 35000, // PKR per month
            limits: {
                maxUsers: 1500,
                maxCourses: 500,
                maxDepartments: 50,
                maxStorage: 100000
            }
        },
        {
            type: 'Enterprise',
            name: 'Enterprise Plan',
            price: 75000, // PKR per month
            limits: {
                maxUsers: -1, // Unlimited
                maxCourses: -1,
                maxDepartments: -1,
                maxStorage: -1
            }
        }
    ];
};

module.exports = mongoose.model('Subscription', subscriptionSchema);

