const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'mysql.gb.stackcp.com',
    port: process.env.DB_PORT || 39558,
    user: process.env.DB_USER || 'questobe',
    password: process.env.DB_PASSWORD || 'Quest123@',
    database: process.env.DB_NAME || 'questobe-35313139c836'
};

// Helper function to get database connection
async function getConnection() {
    try {
        return await mysql.createConnection(dbConfig);
    } catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
}

// Helper function to execute query
async function executeQuery(query, params = []) {
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute(query, params);
        return rows;
    } finally {
        await connection.end();
    }
}

exports.handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    try {
        if (event.httpMethod === 'GET') {
            // Get all users
            const query = `
                SELECT 
                    id,
                    name,
                    email,
                    role,
                    department,
                    employeeId,
                    studentId,
                    designation,
                    semester,
                    batch,
                    createdAt,
                    updatedAt
                FROM users 
                ORDER BY createdAt DESC
            `;
            
            const users = await executeQuery(query);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    users: users
                }),
            };
        }

        if (event.httpMethod === 'POST') {
            // Create new user
            const bcrypt = require('bcryptjs');
            const { name, email, password, role, department, employeeId, studentId, designation, semester, batch } = JSON.parse(event.body);
            
            // Validate required fields
            if (!name || !email || !password || !role) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Name, email, password, and role are required'
                    }),
                };
            }
            
            // Check if user already exists
            const existingUserQuery = 'SELECT id FROM users WHERE email = ?';
            const existingUsers = await executeQuery(existingUserQuery, [email]);
            
            if (existingUsers.length > 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'User with this email already exists'
                    }),
                };
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);
            
            // Insert new user
            const insertQuery = `
                INSERT INTO users (
                    name, email, password, role, department, 
                    employeeId, studentId, designation, semester, batch,
                    createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;
            
            const result = await executeQuery(insertQuery, [
                name, email, hashedPassword, role, department,
                employeeId || null, studentId || null, designation || null,
                semester || null, batch || null
            ]);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'User created successfully',
                    userId: result.insertId
                }),
            };
        }

        if (event.httpMethod === 'DELETE') {
            // Delete user
            const { id } = event.pathParameters || {};
            
            if (!id) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'User ID is required'
                    }),
                };
            }
            
            // Check if user exists
            const existingUserQuery = 'SELECT id FROM users WHERE id = ?';
            const existingUsers = await executeQuery(existingUserQuery, [id]);
            
            if (existingUsers.length === 0) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'User not found'
                    }),
                };
            }
            
            // Delete user
            const deleteQuery = 'DELETE FROM users WHERE id = ?';
            await executeQuery(deleteQuery, [id]);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'User deleted successfully'
                }),
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Method not allowed'
            }),
        };

    } catch (error) {
        console.error('Error in user management:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                details: error.message
            }),
        };
    }
};
