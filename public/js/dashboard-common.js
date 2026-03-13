/**
 * Common Dashboard Utilities
 * Shared functions for all OBE Portal dashboards
 */

// API Configuration
const API_BASE = '';
const API_ENDPOINTS = {
    // Authentication
    LOGIN: '/api/auth/login',
    CHECK: '/api/auth/check',
    LOGOUT: '/api/auth/logout',
    
    // Universities
    UNIVERSITIES: '/api/universities',
    MY_UNIVERSITY: '/api/my-university',
    
    // Users
    USERS: '/api/users',
    PLATFORM_USERS: '/api/platform-users',
    
    // Courses
    COURSES: '/api/courses',
    
    // Departments
    DEPARTMENTS: '/api/departments',
    
    // Other
    DATABASES: '/api/databases',
    SUBSCRIPTIONS: '/api/subscriptions'
};

// Authentication Helper
class AuthManager {
    static getToken() {
        return localStorage.getItem('token');
    }
    
    static getUser() {
        try {
            const user = localStorage.getItem('user');
            return user ? JSON.parse(user) : null;
        } catch (error) {
            console.error('Error parsing user data:', error);
            return null;
        }
    }
    
    static setAuth(token, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }
    
    static clearAuth() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
    
    static isAuthenticated() {
        return !!this.getToken() && !!this.getUser();
    }
    
    static redirectToLogin() {
        window.location.href = '/login.html';
    }
    
    static logout() {
        this.clearAuth();
        this.redirectToLogin();
    }
    
    static checkAuth() {
        if (!this.isAuthenticated()) {
            this.redirectToLogin();
            return false;
        }
        return true;
    }
}

// API Helper
class APIManager {
    static getHeaders(includeContentType = true) {
        const headers = {
            'Authorization': `Bearer ${AuthManager.getToken()}`
        };
        
        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }
        
        const user = AuthManager.getUser();
        if (user && user.email) {
            headers['X-User-Email'] = user.email;
        }
        
        return headers;
    }
    
    static async request(endpoint, options = {}) {
        try {
            const config = {
                headers: this.getHeaders(!options.body || typeof options.body === 'string'),
                ...options
            };
            
            const response = await fetch(endpoint, config);
            
            // Handle authentication errors
            if (response.status === 401) {
                AuthManager.logout();
                return null;
            }
            
            // Handle other errors
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }
    
    static async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }
    
    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    static async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    static async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
    
    static async upload(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            body: formData
        });
    }
}

// University Info Manager
class UniversityManager {
    static async loadUniversityInfo() {
        try {
            const user = AuthManager.getUser();
            
            // For university super admins, load their university info
            if (user && user.role === 'university_superadmin') {
                const university = await APIManager.get(API_ENDPOINTS.MY_UNIVERSITY);
                if (university) {
                    this.updateUniversityUI(university);
                    return university;
                }
            }
            
            // For other roles, show generic university info
            this.showGenericUniversityInfo(user);
            return null;
        } catch (error) {
            console.error('Error loading university info:', error);
            this.showGenericUniversityInfo(AuthManager.getUser());
            return null;
        }
    }
    
    static updateUniversityUI(university) {
        // Update university name
        document.querySelectorAll('.university-name, #universityName').forEach(el => {
            if (el) el.textContent = university.universityName;
        });
        
        // Update university logo
        const logoElement = document.getElementById('universityLogo');
        const placeholderElement = document.getElementById('universityLogoPlaceholder');
        
        if (university.logoUrl && logoElement) {
            logoElement.src = university.logoUrl;
            logoElement.style.display = 'block';
            if (placeholderElement) placeholderElement.style.display = 'none';
        } else if (placeholderElement) {
            const firstLetter = university.universityName.charAt(0).toUpperCase();
            placeholderElement.textContent = firstLetter;
            placeholderElement.style.display = 'flex';
            if (logoElement) logoElement.style.display = 'none';
        }
        
        // Update colors if provided
        if (university.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', university.primaryColor);
        }
        if (university.secondaryColor) {
            document.documentElement.style.setProperty('--secondary-color', university.secondaryColor);
        }
    }
    
    static showGenericUniversityInfo(user) {
        const universityName = user?.university || 'University';
        const firstLetter = universityName.charAt(0).toUpperCase();
        
        document.querySelectorAll('.university-name, #universityName').forEach(el => {
            if (el) el.textContent = universityName;
        });
        
        const placeholderElement = document.getElementById('universityLogoPlaceholder');
        if (placeholderElement) {
            placeholderElement.textContent = firstLetter;
            placeholderElement.style.display = 'flex';
        }
        
        const logoElement = document.getElementById('universityLogo');
        if (logoElement) {
            logoElement.style.display = 'none';
        }
    }
}

// Loading State Manager
class LoadingManager {
    static show(elementId, message = 'Loading...') {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <div class="mt-2">${message}</div>
                </div>
            `;
        }
    }
    
    static hide(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '';
        }
    }
    
    static showError(elementId, message = 'An error occurred') {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="alert alert-danger text-center">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                </div>
            `;
        }
    }
}

// Notification Manager
class NotificationManager {
    static show(message, type = 'info', duration = 5000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }
    
    static success(message) {
        this.show(message, 'success');
    }
    
    static error(message) {
        this.show(message, 'danger');
    }
    
    static warning(message) {
        this.show(message, 'warning');
    }
    
    static info(message) {
        this.show(message, 'info');
    }
}

// Initialize common functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!AuthManager.checkAuth()) {
        return;
    }
    
    // Load university info
    UniversityManager.loadUniversityInfo();
    
    // Set up user info display
    const user = AuthManager.getUser();
    if (user) {
        document.querySelectorAll('#userName, .user-name').forEach(el => {
            if (el) el.textContent = user.name || user.email;
        });
        
        document.querySelectorAll('#userEmail, .user-email').forEach(el => {
            if (el) el.textContent = user.email;
        });
        
        document.querySelectorAll('#userRole, .user-role').forEach(el => {
            if (el) el.textContent = user.role?.replace('_', ' ').toUpperCase();
        });
    }
});

// Global logout function
function logout() {
    AuthManager.logout();
}

// Export for use in other scripts
window.AuthManager = AuthManager;
window.APIManager = APIManager;
window.UniversityManager = UniversityManager;
window.LoadingManager = LoadingManager;
window.NotificationManager = NotificationManager;
window.API_ENDPOINTS = API_ENDPOINTS;