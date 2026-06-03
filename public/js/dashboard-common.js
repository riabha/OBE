/**
 * Common Dashboard Utilities
 * Shared functions for all OBE Portal dashboards
 */

// Role → dashboard path (keep in sync with login.html)
const DASHBOARD_BY_ROLE = {
    pro_superadmin: '/pro-super-admin-dashboard.html',
    platform_admin: '/pro-super-admin-dashboard.html',
    university_superadmin: '/university-super-admin-dashboard.html',
    superadmin: '/university-super-admin-dashboard.html',
    controller: '/controller-dashboard-enhanced.html',
    dean: '/dean-dashboard-enhanced.html',
    chairman: '/chairman-dashboard-enhanced.html',
    focal: '/focal-dashboard-enhanced.html',
    teacher: '/teacher-dashboard-enhanced.html',
    student: '/student-dashboard-enhanced.html'
};

function getDashboardForRole(role) {
    return DASHBOARD_BY_ROLE[role] || '/login.html';
}

function getAPIHeaders(includeContentType = false) {
    const headers = APIManager.getHeaders(includeContentType);
    return headers;
}

function authFetch(url, options = {}) {
    const headers = { ...getAPIHeaders(!!options.body), ...(options.headers || {}) };
    return fetch(url, { ...options, headers });
}

/**
 * Safe section switcher for role dashboards. Avoids errors when event is missing
 * (e.g. Quick Action buttons) and still highlights the correct sidebar link.
 */
function showDashboardSection(sectionName, clickEvent) {
    const sectionEl = document.getElementById(sectionName + '-section');
    if (!sectionEl) {
        console.warn('[nav] Section not found:', sectionName + '-section');
        return false;
    }
    document.querySelectorAll('[id$="-section"]').forEach(s => { s.style.display = 'none'; });
    sectionEl.style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const evt = clickEvent || (typeof window.event !== 'undefined' ? window.event : null);
    let link = null;
    if (evt) {
        if (evt.currentTarget?.classList?.contains('nav-link')) {
            link = evt.currentTarget;
        } else {
            link = evt.target?.closest?.('.nav-link');
        }
    }
    if (!link) {
        link = Array.from(document.querySelectorAll('.nav-link')).find(a => {
            const oc = a.getAttribute('onclick') || '';
            return oc.includes(`'${sectionName}'`) || oc.includes(`"${sectionName}"`);
        });
    }
    if (link) link.classList.add('active');
    return true;
}

// API Configuration
const API_BASE = '';
const API_ENDPOINTS = {
    // Authentication
    LOGIN: '/api/auth/login',
    CHECK: '/api/auth/check',
    SELECT_ROLE: '/api/auth/select-role',
    
    // Universities
    UNIVERSITIES: '/api/universities',
    MY_UNIVERSITY: '/api/my-university',
    MY_UNIVERSITY_LOGO: '/api/my-university/logo',
    
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

    static getActiveRole() {
        const user = this.getUser();
        return user?.activeRole || user?.role;
    }

    static getAvailableRoles() {
        const user = this.getUser();
        if (Array.isArray(user?.availableRoles) && user.availableRoles.length) {
            return user.availableRoles;
        }
        if (Array.isArray(user?.roles) && user.roles.length) {
            return user.roles;
        }
        return user?.role ? [user.role] : [];
    }

    static hasRole(role) {
        return this.getAvailableRoles().includes(role);
    }

    static requireDashboardAccess(allowedRoles) {
        if (!this.checkAuth()) return false;
        const active = this.getActiveRole();
        if (!allowedRoles.includes(active)) {
            window.location.href = getDashboardForRole(active);
            return false;
        }
        if (!this.hasRole(active)) {
            this.redirectToLogin();
            return false;
        }
        return true;
    }

    static requireRole(expectedRole) {
        return this.requireDashboardAccess([expectedRole]);
    }
}

const ROLE_META = {
    pro_superadmin: { label: 'Pro Super Admin', icon: 'fa-crown', color: '#7c3aed', description: 'Manage all universities on the platform' },
    platform_admin: { label: 'Platform Admin', icon: 'fa-shield-halved', color: '#6366f1', description: 'Platform administration and support' },
    university_superadmin: { label: 'University Super Admin', icon: 'fa-university', color: '#2563eb', description: 'Full university administration and OBE setup' },
    superadmin: { label: 'University Super Admin', icon: 'fa-university', color: '#2563eb', description: 'Full university administration and OBE setup' },
    controller: { label: 'Controller of Examinations', icon: 'fa-clipboard-check', color: '#0ea5e9', description: 'Exams, results, and academic records' },
    dean: { label: 'Dean', icon: 'fa-user-tie', color: '#0891b2', description: 'Faculty-level oversight and approvals' },
    chairman: { label: 'Chairman', icon: 'fa-sitemap', color: '#059669', description: 'Department management and OBE coordination' },
    focal: { label: 'Focal Person', icon: 'fa-bullseye', color: '#d97706', description: 'OBE focal duties and department reporting' },
    teacher: { label: 'Teacher', icon: 'fa-chalkboard-teacher', color: '#4f46e5', description: 'Courses, assessments, and student grading' },
    student: { label: 'Student', icon: 'fa-user-graduate', color: '#db2777', description: 'Courses, results, and learning outcomes' },
    support: { label: 'Support', icon: 'fa-life-ring', color: '#64748b', description: 'Platform support access' }
};

class RoleManager {
    static getMeta(role) {
        return ROLE_META[role] || {
            label: (role || 'User').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            icon: 'fa-user',
            color: '#475569',
            description: 'Open this workspace'
        };
    }

    static redirectAfterLogin(data) {
        localStorage.removeItem('universityInfo');
        AuthManager.setAuth(data.token, data.user);
        const roles = AuthManager.getAvailableRoles();
        if (data.needsRoleSelection || roles.length > 1) {
            window.location.href = '/select-role.html';
            return;
        }
        window.location.href = getDashboardForRole(AuthManager.getActiveRole());
    }

    static async switchRole(role, options = { redirect: true }) {
        const res = await fetch(API_ENDPOINTS.SELECT_ROLE, {
            method: 'POST',
            headers: APIManager.getHeaders(true),
            body: JSON.stringify({ role })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to switch role');
        AuthManager.setAuth(data.token, data.user);
        localStorage.setItem(`lastActiveRole_${data.user.email}`, role);
        if (options.redirect !== false) {
            window.location.href = getDashboardForRole(role);
        }
        return data;
    }

    static mountSwitcher() {
        const roles = AuthManager.getAvailableRoles();
        if (roles.length <= 1 || document.getElementById('obeRoleSwitcher')) return;

        const active = AuthManager.getActiveRole();
        const meta = this.getMeta(active);
        const mount = document.getElementById('roleSwitcherMount') || document.body;

        const wrap = document.createElement('div');
        wrap.id = 'obeRoleSwitcher';
        if (mount === document.body) {
            wrap.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;';
        } else {
            wrap.className = 'ms-auto';
        }

        wrap.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-sm btn-light shadow-sm dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown" aria-expanded="false" id="obeRoleSwitcherBtn">
                    <span class="rounded-circle d-inline-flex align-items-center justify-content-center text-white" style="width:28px;height:28px;background:${meta.color};font-size:11px;">
                        <i class="fas ${meta.icon}"></i>
                    </span>
                    <span class="d-none d-md-inline">${meta.label}</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow" id="obeRoleSwitcherMenu"></ul>
            </div>`;

        mount.appendChild(wrap);

        const menu = wrap.querySelector('#obeRoleSwitcherMenu');
        roles.forEach(role => {
            const m = this.getMeta(role);
            const li = document.createElement('li');
            const isActive = role === active;
            li.innerHTML = `<button class="dropdown-item d-flex align-items-center ${isActive ? 'active' : ''}" type="button">
                <i class="fas ${m.icon} me-2" style="color:${m.color};width:18px;"></i>
                <span>${m.label}${isActive ? ' <small class="text-muted">(current)</small>' : ''}</span>
            </button>`;
            if (!isActive) {
                li.querySelector('button').addEventListener('click', () => {
                    li.querySelector('button').innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Switching...';
                    this.switchRole(role).catch(err => alert(err.message || 'Could not switch role'));
                });
            }
            menu.appendChild(li);
        });
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
    static _logoObjectUrl = null;

    static async loadUniversityInfo() {
        try {
            const user = AuthManager.getUser();
            
            if (user && (user.role === 'university_superadmin' || user.universityCode || user.userType === 'university')) {
                const university = await APIManager.get(API_ENDPOINTS.MY_UNIVERSITY);
                if (university) {
                    await this.updateUniversityUI(university);
                    return university;
                }
            }

            this.showGenericUniversityInfo(user);
            return null;
        } catch (error) {
            console.error('Error loading university info:', error);
            this.showGenericUniversityInfo(AuthManager.getUser());
            return null;
        }
    }

    /** Show real logo image or letter placeholder — never both at once. */
    static syncUniversityLogoDisplay(mode) {
        const logoElement = document.getElementById('universityLogo');
        const placeholderElement = document.getElementById('universityLogoPlaceholder');
        if (!logoElement || !placeholderElement) return;
        const showImage = mode === 'image' && logoElement.dataset.logoLoaded === '1';
        if (showImage) {
            logoElement.style.display = 'block';
            placeholderElement.style.display = 'none';
            placeholderElement.setAttribute('aria-hidden', 'true');
        } else {
            logoElement.style.display = 'none';
            logoElement.removeAttribute('data-logo-loaded');
            placeholderElement.style.display = 'flex';
            placeholderElement.setAttribute('aria-hidden', 'false');
        }
    }

    /** Load logo with Authorization header (img src cannot send JWT). */
    static async applyUniversityLogo(logoUrl) {
        const logoElement = document.getElementById('universityLogo');
        const placeholderElement = document.getElementById('universityLogoPlaceholder');
        if (!logoUrl || !logoElement) {
            this.syncUniversityLogoDisplay('placeholder');
            return false;
        }
        try {
            if (this._logoObjectUrl) {
                URL.revokeObjectURL(this._logoObjectUrl);
                this._logoObjectUrl = null;
            }
            const headers = { Authorization: `Bearer ${AuthManager.getToken()}` };
            const user = AuthManager.getUser();
            if (user?.email) headers['X-User-Email'] = user.email;
            const res = await fetch(logoUrl, { headers });
            if (!res.ok) throw new Error(`Logo HTTP ${res.status}`);
            const blob = await res.blob();
            this._logoObjectUrl = URL.createObjectURL(blob);
            logoElement.src = this._logoObjectUrl;
            logoElement.dataset.logoLoaded = '1';
            this.syncUniversityLogoDisplay('image');
            return true;
        } catch (err) {
            console.warn('University logo failed to load:', err);
            logoElement.removeAttribute('data-logo-loaded');
            const name = document.querySelector('#universityName, .university-name')?.textContent?.trim() || 'U';
            if (placeholderElement) {
                placeholderElement.textContent = name.charAt(0).toUpperCase();
            }
            this.syncUniversityLogoDisplay('placeholder');
            return false;
        }
    }
    
    static async updateUniversityUI(university) {
        // Update university name
        document.querySelectorAll('.university-name, #universityName').forEach(el => {
            if (el) el.textContent = university.universityName;
        });
        
        const logoUrl = university.logoUrl || API_ENDPOINTS.MY_UNIVERSITY_LOGO;
        if (university.logoUrl || (university.logo && university.logo.contentType)) {
            await this.applyUniversityLogo(logoUrl);
        } else {
            const logoElement = document.getElementById('universityLogo');
            const placeholderElement = document.getElementById('universityLogoPlaceholder');
            const firstLetter = (university.universityName || 'U').charAt(0).toUpperCase();
            if (placeholderElement) {
                placeholderElement.textContent = firstLetter;
                placeholderElement.style.display = 'flex';
            }
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
        const universityName = user?.universityCode === 'DEMO'
            ? 'Quest Demo University'
            : (user?.universityCode || user?.university || 'University').replace(/_/g, ' ');
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
    const path = window.location.pathname;
    if (path.includes('login.html') || path.includes('select-role')) return;

    if (!AuthManager.checkAuth()) return;

    RoleManager.mountSwitcher();

    if (path.includes('pro-super-admin-dashboard') || path.includes('university-super-admin-dashboard')) {
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
            if (el) el.textContent = RoleManager.getMeta(AuthManager.getActiveRole()).label;
        });
    }
});

// Global logout function
function logout() {
    AuthManager.logout();
}

// Export for use in other scripts
window.AuthManager = AuthManager;
window.RoleManager = RoleManager;
window.ROLE_META = ROLE_META;
window.APIManager = APIManager;
window.UniversityManager = UniversityManager;
window.applyUniversityLogo = (url) => UniversityManager.applyUniversityLogo(url);
window.LoadingManager = LoadingManager;
window.NotificationManager = NotificationManager;
window.API_ENDPOINTS = API_ENDPOINTS;
window.DASHBOARD_BY_ROLE = DASHBOARD_BY_ROLE;
window.getDashboardForRole = getDashboardForRole;
window.getAPIHeaders = getAPIHeaders;
window.authFetch = authFetch;
window.showDashboardSection = showDashboardSection;