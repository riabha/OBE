#!/bin/bash

# 🔧 FIX DATABASE ARCHITECTURE - Core database connection and structure
# This fixes the fundamental database issues you're experiencing

echo "🔧 FIXING DATABASE ARCHITECTURE AND CONNECTION"
echo "=============================================="

echo "1. 🔍 Diagnosing current database connection issues..."

# Check current MongoDB status and connections
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
print('=== MONGODB CONNECTION DIAGNOSTICS ===');

// Check if we can connect
try {
    var result = db.adminCommand('ismaster');
    print('✅ MongoDB connection: SUCCESS');
    print('   Server: ' + result.me);
    print('   Version: ' + db.version());
} catch (e) {
    print('❌ MongoDB connection: FAILED');
    print('   Error: ' + e);
}

// List all databases
print('=== AVAILABLE DATABASES ===');
var databases = db.adminCommand('listDatabases').databases;
databases.forEach(function(database) {
    print('📁 ' + database.name + ' (' + (database.sizeOnDisk / 1024 / 1024).toFixed(2) + ' MB)');
});

// Check platform database structure
print('=== PLATFORM DATABASE STRUCTURE ===');
use obe_platform;
print('Collections in obe_platform:');
db.getCollectionNames().forEach(function(collection) {
    var count = db.getCollection(collection).countDocuments();
    print('   - ' + collection + ': ' + count + ' documents');
});

// Check universities
print('=== UNIVERSITIES IN PLATFORM ===');
var universities = db.universities.find().toArray();
if (universities.length > 0) {
    universities.forEach(function(uni) {
        print('🏛️ ' + uni.universityName + ' (' + uni.universityCode + ')');
        print('   Database: ' + uni.databaseName);
        print('   Active: ' + uni.isActive);
        print('   ID: ' + uni._id);
        print('');
    });
} else {
    print('❌ No universities found in platform database');
}

// Check platform users
print('=== PLATFORM USERS ===');
var platformUsers = db.platformusers.find().toArray();
if (platformUsers.length > 0) {
    platformUsers.forEach(function(user) {
        print('👤 ' + user.email + ' (' + user.role + ')');
        print('   University Code: ' + (user.universityCode || 'NONE'));
        print('   University ID: ' + (user.university || 'NONE'));
        print('');
    });
} else {
    print('❌ No platform users found');
}
"

echo ""
echo "2. 🔧 Fixing database connection configuration..."

# Update the server.js database connection to be more robust
cat > /tmp/fix_db_connection.js << 'EOF'
// Fix database connection in server.js
const fs = require('fs');

// Read current server.js
let serverContent = fs.readFileSync('server.js', 'utf8');

// Enhanced MongoDB connection with better error handling
const newConnectionCode = `
// Enhanced MongoDB Connection with better error handling
const connectDB = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        console.log('Connection string:', process.env.MONGODB_URI || 'mongodb://admin:SecureOBE2025MongoDBQuest@mongodb:27017/obe_platform?authSource=admin');
        
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:SecureOBE2025MongoDBQuest@mongodb:27017/obe_platform?authSource=admin', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // 10 seconds
            socketTimeoutMS: 45000, // 45 seconds
            maxPoolSize: 10,
            retryWrites: true,
            authSource: 'admin'
        });
        
        console.log(\`✅ MongoDB Connected: \${conn.connection.host}:\${conn.connection.port}\`);
        console.log(\`📁 Database: \${conn.connection.name}\`);
        
        // Test the connection
        await mongoose.connection.db.admin().ping();
        console.log('✅ MongoDB ping successful');
        
        return conn;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        console.error('Connection details:');
        console.error('- Host: mongodb (container name)');
        console.error('- Port: 27017');
        console.error('- Database: obe_platform');
        console.error('- Auth Source: admin');
        console.error('- Username: admin');
        
        // Don't exit, let the app try to reconnect
        setTimeout(connectDB, 5000);
    }
};

// Handle connection events
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ Mongoose disconnected from MongoDB');
    setTimeout(connectDB, 5000);
});

// Connect to database
connectDB();
`;

// Replace the existing connection code
const connectionRegex = /\/\/ MongoDB Connection[\s\S]*?\.catch\([^}]*}\);/;
if (connectionRegex.test(serverContent)) {
    serverContent = serverContent.replace(connectionRegex, newConnectionCode);
    console.log('✅ Updated existing MongoDB connection code');
} else {
    // If no existing connection found, add it after the imports
    const importRegex = /(const.*require.*\n)+/;
    serverContent = serverContent.replace(importRegex, '$&\n' + newConnectionCode + '\n');
    console.log('✅ Added new MongoDB connection code');
}

// Write back to server.js
fs.writeFileSync('server.js', serverContent);
console.log('✅ server.js updated with enhanced database connection');
EOF

# Run the database connection fix
docker exec obe-app node /tmp/fix_db_connection.js

echo ""
echo "3. 🏗️ Setting up proper database architecture..."

# Create the proper database architecture
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
print('=== SETTING UP PROPER DATABASE ARCHITECTURE ===');

// Ensure obe_platform database exists and has proper structure
use obe_platform;

// Create indexes for better performance
print('Creating database indexes...');
db.universities.createIndex({universityCode: 1}, {unique: true});
db.universities.createIndex({databaseName: 1}, {unique: true});
db.platformusers.createIndex({email: 1}, {unique: true});
db.platformusers.createIndex({universityCode: 1});
db.platformusers.createIndex({university: 1});

print('✅ Database indexes created');

// Ensure we have a proper university structure
var demoUniversity = db.universities.findOne({universityCode: 'DEMO'});
if (!demoUniversity) {
    print('Creating DEMO university...');
    var result = db.universities.insertOne({
        universityName: 'Demo University',
        universityCode: 'DEMO',
        databaseName: 'obe_demo',
        description: 'Demo University for OBE Portal Testing',
        address: '123 Demo Street, Demo City, Demo State',
        phone: '+1-555-DEMO-UNI',
        email: 'info@demo.edu',
        website: 'https://demo.edu',
        establishedYear: 2020,
        isActive: true,
        settings: {
            allowSelfRegistration: false,
            requireEmailVerification: true,
            defaultUserRole: 'student'
        },
        createdAt: new Date(),
        updatedAt: new Date()
    });
    demoUniversity = db.universities.findOne({_id: result.insertedId});
    print('✅ Created DEMO university');
} else {
    // Update existing university to ensure all fields are present
    db.universities.updateOne(
        {_id: demoUniversity._id},
        {\$set: {
            universityName: 'Demo University',
            databaseName: 'obe_demo',
            description: 'Demo University for OBE Portal Testing',
            isActive: true,
            updatedAt: new Date()
        }}
    );
    print('✅ Updated DEMO university');
}

// Fix platform user university reference
var platformUser = db.platformusers.findOne({universityCode: 'DEMO'});
if (platformUser) {
    if (!platformUser.university || platformUser.university.toString() !== demoUniversity._id.toString()) {
        db.platformusers.updateOne(
            {_id: platformUser._id},
            {\$set: {
                university: demoUniversity._id,
                universityCode: 'DEMO',
                updatedAt: new Date()
            }}
        );
        print('✅ Fixed platform user university reference');
    } else {
        print('✅ Platform user university reference already correct');
    }
} else {
    print('⚠️ No DEMO platform user found - this should be created when you create a university');
}

print('=== PLATFORM DATABASE SETUP COMPLETE ===');
print('University: ' + demoUniversity.universityName);
print('Database: ' + demoUniversity.databaseName);
print('University ID: ' + demoUniversity._id);

// Now ensure the university database exists
use obe_demo;
print('=== SETTING UP UNIVERSITY DATABASE ===');

// Create a metadata collection to ensure database exists
db.createCollection('_metadata');
db._metadata.insertOne({
    universityName: 'Demo University',
    universityCode: 'DEMO',
    databaseVersion: '1.0',
    createdAt: new Date(),
    lastUpdated: new Date()
});

print('✅ University database obe_demo created/verified');
"
echo ""
echo "4. 🔄 Restarting application with fixed database connection..."
docker-compose restart

echo ""
echo "5. ⏳ Waiting for application to start with new connection..."
sleep 20

echo ""
echo "6. 🧪 Testing database connection..."

# Test the database connection
echo "Testing MongoDB connection..."
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
print('=== CONNECTION TEST ===');
try {
    var result = db.adminCommand('ping');
    print('✅ MongoDB ping: SUCCESS');
    
    use obe_platform;
    var count = db.universities.countDocuments();
    print('✅ Platform database access: SUCCESS (' + count + ' universities)');
    
    use obe_demo;
    var metaCount = db._metadata.countDocuments();
    print('✅ University database access: SUCCESS (' + metaCount + ' metadata records)');
    
} catch (e) {
    print('❌ Connection test failed: ' + e);
}
"

# Test application response
echo ""
echo "Testing application response..."
if curl -I http://194.60.87.212:3200 2>/dev/null | head -1 | grep -q "200\|302"; then
    echo "✅ Application is responding"
else
    echo "⚠️ Application may still be starting"
fi

echo ""
echo "7. 📋 Final database architecture verification..."

# Verify the complete setup
docker exec obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin --eval "
print('=== FINAL ARCHITECTURE VERIFICATION ===');

use obe_platform;
print('📁 PLATFORM DATABASE (obe_platform):');
print('   Purpose: Stores university info, platform users, system settings');
print('   Collections:');
db.getCollectionNames().forEach(function(collection) {
    var count = db.getCollection(collection).countDocuments();
    print('   - ' + collection + ': ' + count + ' documents');
});

print('');
print('🏛️ UNIVERSITIES:');
var universities = db.universities.find().toArray();
universities.forEach(function(uni) {
    print('   - ' + uni.universityName + ' (' + uni.universityCode + ')');
    print('     Database: ' + uni.databaseName);
    print('     Status: ' + (uni.isActive ? 'Active' : 'Inactive'));
});

print('');
print('👤 PLATFORM USERS (for login):');
var platformUsers = db.platformusers.find().toArray();
platformUsers.forEach(function(user) {
    print('   - ' + user.email + ' (' + user.role + ')');
    print('     University: ' + (user.universityCode || 'NONE'));
});

use obe_demo;
print('');
print('📁 UNIVERSITY DATABASE (obe_demo):');
print('   Purpose: Stores university-specific data (users, courses, etc.)');
print('   Collections:');
db.getCollectionNames().forEach(function(collection) {
    var count = db.getCollection(collection).countDocuments();
    print('   - ' + collection + ': ' + count + ' documents');
});
"

echo ""
echo "✅ DATABASE ARCHITECTURE FIX COMPLETE!"
echo "======================================"
echo ""
echo "🏗️ PROPER DATABASE ARCHITECTURE:"
echo "================================="
echo ""
echo "📁 obe_platform (Platform Database):"
echo "   - Stores university information"
echo "   - Stores platform users (for login)"
echo "   - Stores system settings"
echo "   - Manages university-to-database assignments"
echo ""
echo "📁 obe_demo (University Database):"
echo "   - Stores university-specific data"
echo "   - Users, courses, departments, assessments"
echo "   - All university operations happen here"
echo ""
echo "🔗 CONNECTION STRUCTURE:"
echo "   Platform User → University → Assigned Database"
echo "   Login happens in platform, operations in university DB"
echo ""
echo "🧪 NOW TEST:"
echo "============"
echo "1. Go to: http://194.60.87.212:3200"
echo "2. Check database connection in settings"
echo "3. Login as university super admin"
echo "4. Should now show proper university info"
echo ""
echo "🔧 IF CONNECTION STILL FAILS:"
echo "   - Check Docker containers: docker-compose ps"
echo "   - Check MongoDB logs: docker logs obe-mongodb"
echo "   - Check app logs: docker logs obe-app"