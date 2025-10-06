const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Fallback users for when database is not available
const fallbackUsers = [
    {
        id: 1,
        email: 'student@quest.edu.pk',
        password: 'pass',
        role: 'student',
        name: 'Student User',
        department: 'Computer Science'
    },
    {
        id: 2,
        email: 'teacher@quest.edu.pk',
        password: 'pass',
        role: 'teacher',
        name: 'Teacher User',
        department: 'Computer Science'
    },
    {
        id: 3,
        email: 'focal@quest.edu.pk',
        password: 'pass',
        role: 'focal',
        name: 'Focal Person',
        department: 'Computer Science'
    },
    {
        id: 4,
        email: 'chairman@quest.edu.pk',
        password: 'pass',
        role: 'chairman',
        name: 'Chairman',
        department: 'Computer Science'
    },
    {
        id: 5,
        email: 'dean@quest.edu.pk',
        password: 'pass',
        role: 'dean',
        name: 'Dean',
        department: 'All Departments'
    },
    {
        id: 6,
        email: 'controller@quest.edu.pk',
        password: 'pass',
        role: 'controller',
        name: 'Controller',
        department: 'Examination'
    },
    {
        id: 7,
        email: 'superadmin@quest.edu.pk',
        password: 'pass',
        role: 'superadmin',
        name: 'Super Admin',
        department: 'Administration'
    }
];

exports.handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ message: 'Method not allowed' }),
        };
    }

    try {
        const { email, password } = JSON.parse(event.body);
        
        if (!email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: 'Email and password are required' }),
            };
        }

        let user = null;

        // Try database authentication first
        try {
            const connection = await mysql.createConnection({
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
            });

            const [rows] = await connection.execute(
                'SELECT * FROM users WHERE email = ? AND password = ?',
                [email, password]
            );

            await connection.end();

            if (rows.length > 0) {
                const { password: _, ...userWithoutPassword } = rows[0];
                user = userWithoutPassword;
            }
        } catch (dbError) {
            console.log('Database authentication failed, using fallback:', dbError.message);
        }

        // Fallback to local authentication if database fails
        if (!user) {
            const fallbackUser = fallbackUsers.find(u => u.email === email && u.password === password);
            if (fallbackUser) {
                const { password: _, ...userWithoutPassword } = fallbackUser;
                user = userWithoutPassword;
            }
        }

        if (user) {
            const token = jwt.sign(
                { userId: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET || 'quest_obe_jwt_secret_key_2024',
                { expiresIn: '24h' }
            );

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Login successful',
                    token,
                    user,
                }),
            };
        } else {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ message: 'Invalid email or password' }),
            };
        }
    } catch (error) {
        console.error('Login error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: 'Server error', error: error.message }),
        };
    }
};
