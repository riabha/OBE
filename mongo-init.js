// MongoDB Initialization Script for OBE Portal
// This script runs when MongoDB container starts for the first time

print('🚀 Initializing OBE Platform Database...');

// Switch to platform database
db = db.getSiblingDB('obe_platform');

// Create collections with validation
db.createCollection('platformusers', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'name', 'role'],
      properties: {
        email: {
          bsonType: 'string',
          description: 'Email must be a string and is required'
        },
        password: {
          bsonType: 'string',
          description: 'Password must be a string and is required'
        },
        name: {
          bsonType: 'string',
          description: 'Name must be a string and is required'
        },
        role: {
          enum: ['pro_superadmin', 'university_superadmin', 'platform_admin', 'support'],
          description: 'Role must be one of the enum values'
        }
      }
    }
  }
});

db.createCollection('universities');
db.createCollection('subscriptions');

// Create indexes
db.platformusers.createIndex({ email: 1 }, { unique: true });
db.universities.createIndex({ universityCode: 1 }, { unique: true });
db.universities.createIndex({ databaseName: 1 }, { unique: true });
db.subscriptions.createIndex({ university: 1 });

print('✅ Platform database initialized successfully!');
print('📝 Collections created: platformusers, universities, subscriptions');
print('🔐 Note: Default admin will be created by application on first run');
