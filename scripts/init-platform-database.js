#!/usr/bin/env node

/**
 * 🏛️ Platform Database Initialization Script
 * 
 * This script creates the main platform database with:
 * - Collections for universities, subscriptions, platform users
 * - Indexes for performance
 * - Default Pro Super Admin account
 * 
 * Databases will be visible in aaPanel MongoDB GUI
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './config.env' });

// Import models
const PlatformUserSchema = require('../models/PlatformUser');
const UniversitySchema = require('../models/University');
const Subscription = require('../models/Subscription');

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  🏛️  Platform Database Initialization                   ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Connect to platform database
async function connectDatabase() {
    try {
        const mongoURI = process.env.MONGODB_URI;
        
        if (!mongoURI) {
            throw new Error('MONGODB_URI not found in config.env');
        }
        
        console.log('📡 Connecting to MongoDB...');
        console.log(`🔗 URI: ${mongoURI.replace(/\/\/.*:.*@/, '//***:***@')}`);
        
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to platform database successfully!\n');
        
        // Get database name
        const dbName = mongoose.connection.db.databaseName;
        console.log(`📊 Database: ${dbName}\n`);
        
        return dbName;
        
    } catch (error) {
        console.error('❌ Connection error:', error.message);
        process.exit(1);
    }
}

// Create Platform User model
const PlatformUser = mongoose.model('PlatformUser', PlatformUserSchema);
const University = mongoose.model('University', UniversitySchema);

// Initialize collections
async function initializeCollections() {
    try {
        console.log('📦 Initializing collections...\n');
        
        // 1. Platform Users Collection
        console.log('1️⃣ Creating platformusers collection...');
        const existingAdmin = await PlatformUser.findOne({ email: 'pro@obe.org.pk' });
        
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('proadmin123', 12);
            
            const proAdmin = new PlatformUser({
                email: 'pro@obe.org.pk',
                password: hashedPassword,
                name: 'OBE Portal Administrator',
                role: 'pro_superadmin',
                permissions: ['all'],
                isActive: true
            });
            
            await proAdmin.save();
            console.log('   ✅ Pro Super Admin created');
            console.log('   📧 Email: pro@obe.org.pk');
            console.log('   🔑 Password: proadmin123');
        } else {
            console.log('   ✅ Pro Super Admin already exists');
        }
        console.log('');
        
        // 2. Universities Collection
        console.log('2️⃣ Creating universities collection...');
        const universitiesCount = await University.countDocuments();
        if (universitiesCount === 0) {
            console.log('   ✅ Universities collection created (empty)');
        } else {
            console.log(`   ✅ Universities collection exists (${universitiesCount} universities)`);
        }
        console.log('');
        
        // 3. Subscriptions Collection
        console.log('3️⃣ Creating subscriptions collection...');
        const subscriptionsCount = await Subscription.countDocuments();
        if (subscriptionsCount === 0) {
            console.log('   ✅ Subscriptions collection created (empty)');
        } else {
            console.log(`   ✅ Subscriptions collection exists (${subscriptionsCount} subscriptions)`);
        }
        console.log('');
        
        // 4. Create indexes
        console.log('4️⃣ Creating database indexes...');
        await PlatformUser.createIndexes();
        await University.createIndexes();
        await Subscription.createIndexes();
        console.log('   ✅ Indexes created successfully');
        console.log('');
        
    } catch (error) {
        console.error('❌ Error initializing collections:', error.message);
        throw error;
    }
}

// Display database statistics
async function displayStatistics() {
    try {
        console.log('📊 Platform Database Statistics:\n');
        
        const stats = {
            platformUsers: await PlatformUser.countDocuments(),
            universities: await University.countDocuments(),
            subscriptions: await Subscription.countDocuments(),
            activeUniversities: await University.countDocuments({ isActive: true }),
            activeSubscriptions: await Subscription.countDocuments({ status: 'Active' })
        };
        
        console.log(`   👥 Platform Users:       ${stats.platformUsers}`);
        console.log(`   🏛️  Universities:         ${stats.universities}`);
        console.log(`   📋 Subscriptions:        ${stats.subscriptions}`);
        console.log(`   ✅ Active Universities:  ${stats.activeUniversities}`);
        console.log(`   ✅ Active Subscriptions: ${stats.activeSubscriptions}`);
        console.log('');
        
        return stats;
        
    } catch (error) {
        console.error('❌ Error getting statistics:', error.message);
    }
}

// List all collections
async function listCollections() {
    try {
        console.log('📂 Collections in database:\n');
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        if (collections.length === 0) {
            console.log('   (No collections yet)');
        } else {
            collections.forEach((col, index) => {
                console.log(`   ${index + 1}. ${col.name}`);
            });
        }
        console.log('');
        
    } catch (error) {
        console.error('❌ Error listing collections:', error.message);
    }
}

// Main initialization function
async function main() {
    try {
        // Connect to database
        const dbName = await connectDatabase();
        
        // Initialize collections
        await initializeCollections();
        
        // Display statistics
        await displayStatistics();
        
        // List collections
        await listCollections();
        
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  ✅ Platform Database Initialized Successfully!         ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        
        console.log('🎯 Next Steps:\n');
        console.log('   1. Open aaPanel → Databases → MongoDB');
        console.log(`   2. You should see database: ${dbName}`);
        console.log('   3. Login with: pro@obe.org.pk / proadmin123');
        console.log('   4. Add universities via Pro Super Admin dashboard\n');
        
        console.log('💡 Useful Commands:\n');
        console.log('   # Connect to MongoDB shell');
        console.log('   mongo mongodb://root:PASSWORD@localhost:27017/admin');
        console.log('');
        console.log('   # List databases');
        console.log('   show dbs');
        console.log('');
        console.log(`   # Use platform database`);
        console.log(`   use ${dbName}`);
        console.log('');
        console.log('   # List collections');
        console.log('   show collections');
        console.log('');
        console.log('   # View platform users');
        console.log('   db.platformusers.find().pretty()');
        console.log('');
        
    } catch (error) {
        console.error('\n❌ Initialization failed:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('👋 Connection closed\n');
        process.exit(0);
    }
}

// Run the script
main();

