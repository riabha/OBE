#!/usr/bin/env node

/**
 * Check Users in All Databases
 * Quick script to see what users exist in platform and university databases
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './config.env' });

async function checkUsers() {
    try {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║  🔍 Checking Users in All Databases                    ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // 1. Check Platform Users
        console.log('📊 PLATFORM USERS (obe_platform.platformusers):\n');
        const PlatformUserSchema = require('../models/PlatformUser');
        const PlatformUser = mongoose.model('PlatformUser', PlatformUserSchema);
        
        const platformUsers = await PlatformUser.find({}, 'email name role isActive');
        if (platformUsers.length === 0) {
            console.log('   (No platform users found)\n');
        } else {
            platformUsers.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.email}`);
                console.log(`      Name: ${user.name}`);
                console.log(`      Role: ${user.role}`);
                console.log(`      Active: ${user.isActive ? 'Yes' : 'No'}`);
                console.log('');
            });
        }
        
        console.log('─'.repeat(60));
        console.log('');
        
        // 2. Check Universities
        const UniversitySchema = require('../models/University');
        const University = mongoose.model('University', UniversitySchema);
        
        const universities = await University.find({});
        console.log(`🏛️ UNIVERSITIES: ${universities.length}\n`);
        
        if (universities.length === 0) {
            console.log('   (No universities created yet)\n');
        } else {
            for (const uni of universities) {
                console.log(`📚 University: ${uni.universityName} (${uni.universityCode})`);
                console.log(`   Database: ${uni.databaseName}`);
                console.log(`   Super Admin Email: ${uni.superAdminEmail}`);
                
                // Check users in university database
                try {
                    const uniDb = mongoose.connection.useDb(uni.databaseName);
                    const UserSchema = require('../models/User');
                    const UniversityUser = uniDb.model('User', UserSchema);
                    
                    const users = await UniversityUser.find({}, 'firstName lastName email role isActive');
                    console.log(`   👥 Users: ${users.length}`);
                    
                    if (users.length > 0) {
                        users.forEach(user => {
                            console.log(`      - ${user.email}`);
                            console.log(`        Name: ${user.firstName} ${user.lastName}`);
                            console.log(`        Role: ${user.role}`);
                            console.log(`        Active: ${user.isActive ? 'Yes' : 'No'}`);
                        });
                    }
                    
                } catch (dbErr) {
                    console.log(`   ⚠️ Could not access database: ${dbErr.message}`);
                }
                
                console.log('');
            }
        }
        
        console.log('═'.repeat(60));
        console.log('\n✅ Check complete!\n');
        
        await mongoose.connection.close();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

checkUsers();

