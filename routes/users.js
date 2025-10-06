const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Database connection
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

// ==================== USER MANAGEMENT ROUTES ====================

// Get all users
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                name,
                email,
                role,
                department,
                employee_id as employeeId,
                student_id as studentId,
                designation,
                semester,
                batch,
                created_at as createdAt,
                updated_at as updatedAt,
                is_active as isActive
            FROM users 
            ORDER BY created_at DESC
        `;
        
        const users = await executeQuery(query);
        
        res.json({
            success: true,
            users: users
        });
        
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch users' 
        });
    }
});

// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                id,
                name,
                email,
                role,
                department,
                employee_id as employeeId,
                student_id as studentId,
                designation,
                semester,
                batch,
                created_at as createdAt,
                updated_at as updatedAt,
                is_active as isActive
            FROM users 
            WHERE id = ?
        `;
        
        const users = await executeQuery(query, [id]);
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user: users[0]
        });
        
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch user' 
        });
    }
});

// Create new user
router.post('/', async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            role,
            department,
            employeeId,
            studentId,
            designation,
            semester,
            batch
        } = req.body;
        
        // Validate required fields
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                error: 'Name, email, password, and role are required'
            });
        }
        
        // Check if user already exists
        const existingUserQuery = 'SELECT id FROM users WHERE email = ?';
        const existingUsers = await executeQuery(existingUserQuery, [email]);
        
        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Insert new user
        const insertQuery = `
            INSERT INTO users (
                name, email, password, role, department, 
                employee_id, student_id, designation, semester, batch,
                created_at, updated_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1)
        `;
        
        const result = await executeQuery(insertQuery, [
            name, email, hashedPassword, role, department,
            employeeId || null, studentId || null, designation || null,
            semester || null, batch || null
        ]);
        
        res.json({
            success: true,
            message: 'User created successfully',
            userId: result.insertId
        });
        
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create user' 
        });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            email,
            password,
            role,
            department,
            employeeId,
            studentId,
            designation,
            semester,
            batch,
            isActive
        } = req.body;
        
        // Check if user exists
        const existingUserQuery = 'SELECT id FROM users WHERE id = ?';
        const existingUsers = await executeQuery(existingUserQuery, [id]);
        
        if (existingUsers.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Check if email is already taken by another user
        if (email) {
            const emailCheckQuery = 'SELECT id FROM users WHERE email = ? AND id != ?';
            const emailUsers = await executeQuery(emailCheckQuery, [email, id]);
            
            if (emailUsers.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Email already taken by another user'
                });
            }
        }
        
        // Build update query dynamically
        let updateQuery = 'UPDATE users SET ';
        const updateParams = [];
        const updateFields = [];
        
        if (name) {
            updateFields.push('name = ?');
            updateParams.push(name);
        }
        
        if (email) {
            updateFields.push('email = ?');
            updateParams.push(email);
        }
        
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 12);
            updateFields.push('password = ?');
            updateParams.push(hashedPassword);
        }
        
        if (role) {
            updateFields.push('role = ?');
            updateParams.push(role);
        }
        
        if (department !== undefined) {
            updateFields.push('department = ?');
            updateParams.push(department);
        }
        
        if (employeeId !== undefined) {
            updateFields.push('employee_id = ?');
            updateParams.push(employeeId);
        }
        
        if (studentId !== undefined) {
            updateFields.push('student_id = ?');
            updateParams.push(studentId);
        }
        
        if (designation !== undefined) {
            updateFields.push('designation = ?');
            updateParams.push(designation);
        }
        
        if (semester !== undefined) {
            updateFields.push('semester = ?');
            updateParams.push(semester);
        }
        
        if (batch !== undefined) {
            updateFields.push('batch = ?');
            updateParams.push(batch);
        }
        
        if (isActive !== undefined) {
            updateFields.push('is_active = ?');
            updateParams.push(isActive ? 1 : 0);
        }
        
        updateFields.push('updated_at = NOW()');
        updateQuery += updateFields.join(', ') + ' WHERE id = ?';
        updateParams.push(id);
        
        await executeQuery(updateQuery, updateParams);
        
        res.json({
            success: true,
            message: 'User updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update user' 
        });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user exists
        const existingUserQuery = 'SELECT id FROM users WHERE id = ?';
        const existingUsers = await executeQuery(existingUserQuery, [id]);
        
        if (existingUsers.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Soft delete (set is_active to 0)
        const deleteQuery = 'UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?';
        await executeQuery(deleteQuery, [id]);
        
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete user' 
        });
    }
});

// Get users by role
router.get('/role/:role', async (req, res) => {
    try {
        const { role } = req.params;
        
        const query = `
            SELECT 
                id,
                name,
                email,
                role,
                department,
                employee_id as employeeId,
                student_id as studentId,
                designation,
                semester,
                batch,
                created_at as createdAt,
                updated_at as updatedAt,
                is_active as isActive
            FROM users 
            WHERE role = ? AND is_active = 1
            ORDER BY name
        `;
        
        const users = await executeQuery(query, [role]);
        
        res.json({
            success: true,
            users: users
        });
        
    } catch (error) {
        console.error('Error fetching users by role:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch users by role' 
        });
    }
});

// Get user statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as totalUsers,
                COUNT(CASE WHEN role = 'student' THEN 1 END) as totalStudents,
                COUNT(CASE WHEN role = 'teacher' THEN 1 END) as totalTeachers,
                COUNT(CASE WHEN role = 'focal' THEN 1 END) as totalFocals,
                COUNT(CASE WHEN role = 'chairman' THEN 1 END) as totalChairmen,
                COUNT(CASE WHEN role = 'dean' THEN 1 END) as totalDeans,
                COUNT(CASE WHEN role = 'controller' THEN 1 END) as totalControllers,
                COUNT(CASE WHEN role = 'superadmin' THEN 1 END) as totalSuperAdmins,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as activeUsers,
                COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactiveUsers
            FROM users
        `;
        
        const stats = await executeQuery(query);
        
        res.json({
            success: true,
            stats: stats[0]
        });
        
    } catch (error) {
        console.error('Error fetching user statistics:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch user statistics' 
        });
    }
});

// Bulk operations
router.post('/bulk', async (req, res) => {
    try {
        const { action, userIds, data } = req.body;
        
        if (!action || !userIds || !Array.isArray(userIds)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bulk operation parameters'
            });
        }
        
        let query;
        let params;
        
        switch (action) {
            case 'activate':
                query = 'UPDATE users SET is_active = 1, updated_at = NOW() WHERE id IN (?)';
                params = [userIds.join(',')];
                break;
                
            case 'deactivate':
                query = 'UPDATE users SET is_active = 0, updated_at = NOW() WHERE id IN (?)';
                params = [userIds.join(',')];
                break;
                
            case 'changeRole':
                if (!data.role) {
                    return res.status(400).json({
                        success: false,
                        error: 'Role is required for bulk role change'
                    });
                }
                query = 'UPDATE users SET role = ?, updated_at = NOW() WHERE id IN (?)';
                params = [data.role, userIds.join(',')];
                break;
                
            case 'changeDepartment':
                if (!data.department) {
                    return res.status(400).json({
                        success: false,
                        error: 'Department is required for bulk department change'
                    });
                }
                query = 'UPDATE users SET department = ?, updated_at = NOW() WHERE id IN (?)';
                params = [data.department, userIds.join(',')];
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid bulk action'
                });
        }
        
        await executeQuery(query, params);
        
        res.json({
            success: true,
            message: `Bulk ${action} operation completed successfully`,
            affectedUsers: userIds.length
        });
        
    } catch (error) {
        console.error('Error in bulk operation:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to perform bulk operation' 
        });
    }
});

module.exports = router;