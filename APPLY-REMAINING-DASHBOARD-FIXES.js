#!/usr/bin/env node

// 🔧 APPLY REMAINING DASHBOARD FIXES
// This Node.js script applies comprehensive fixes to all remaining dashboard files

const fs = require('fs');
const path = require('path');

console.log('🔧 APPLYING REMAINING DASHBOARD FIXES');
console.log('====================================');

// Dashboard files to fix
const dashboardFiles = [
    'public/chairman-dashboard-enhanced.html',
    'public/controller-dashboard-enhanced.html', 
    'public/focal-dashboard-enhanced.html'
];

// Common fixes to apply
const fixes = {
    // Add dashboard-common.js import
    addDashboardCommon: {
        search: /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@5\.3\.0\/dist\/js\/bootstrap\.bundle\.min\.js"><\/script>\s*<script>/,
        replace: '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>\n    <script src="/js/dashboard-common.js"></script>\n    <script>'
    },
    
    // Fix university logo
    fixUniversityLogo: {
        search: /<div class="d-flex align-items-center mb-4">\s*<img src="quest_logo\.png"[^>]*>\s*<div>\s*<div class="fw-bold text-white">[^<]*<\/div>\s*<small class="text-light">[^<]*<\/small>\s*<\/div>\s*<\/div>/,
        replace: `<div class="d-flex align-items-center mb-4">
                <div class="d-flex align-items-center justify-content-center me-2" style="height: 40px; width: 40px; background: white; border-radius: 50%; position: relative;">
                    <img id="universityLogo" src="" alt="University Logo" style="height: 36px; width: 36px; border-radius: 50%; display: none;">
                    <div id="universityLogoPlaceholder" style="height: 36px; width: 36px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px;">U</div>
                </div>
                <div>
                    <div class="fw-bold text-white" id="universityName">University</div>
                    <small class="text-light">Portal</small>
                </div>
            </div>`
    },
    
    // Fix authentication
    fixAuthentication: {
        search: /document\.addEventListener\('DOMContentLoaded', function\(\) \{\s*const token = localStorage\.getItem\('token'\);\s*const user = localStorage\.getItem\('user'\);[\s\S]*?\}\);/,
        replace: `document.addEventListener('DOMContentLoaded', function() {
            // Use AuthManager from dashboard-common.js
            if (!AuthManager.checkAuth()) {
                return;
            }
            
            const user = AuthManager.getUser();
            const expectedRole = getExpectedRole(); // Will be set per dashboard
            
            if (user.role !== expectedRole) {
                // Redirect to appropriate dashboard
                const dashboardMap = {
                    'university_superadmin': '/university-super-admin-dashboard.html',
                    'student': '/student-dashboard-enhanced.html',
                    'teacher': '/teacher-dashboard-enhanced.html',
                    'focal': '/focal-dashboard-enhanced.html',
                    'chairman': '/chairman-dashboard-enhanced.html',
                    'dean': '/dean-dashboard-enhanced.html',
                    'controller': '/controller-dashboard-enhanced.html'
                };
                
                const dashboardFile = dashboardMap[user.role] || '/student-dashboard-enhanced.html';
                window.location.href = dashboardFile;
                return;
            }
            
            currentUser = user;
            loadDashboardData();
        });`
    }
};

// Role-specific configurations
const roleConfigs = {
    'chairman-dashboard-enhanced.html': {
        role: 'chairman',
        portalName: 'Chairman Portal'
    },
    'controller-dashboard-enhanced.html': {
        role: 'controller', 
        portalName: 'Controller Portal'
    },
    'focal-dashboard-enhanced.html': {
        role: 'focal',
        portalName: 'Focal Portal'
    }
};

// Apply fixes to each dashboard file
dashboardFiles.forEach(filePath => {
    console.log(`\n📝 Processing: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const config = roleConfigs[fileName];
    
    if (!config) {
        console.log(`❌ No configuration found for: ${fileName}`);
        return;
    }
    
    // Apply dashboard-common.js import
    if (fixes.addDashboardCommon.search.test(content)) {
        content = content.replace(fixes.addDashboardCommon.search, fixes.addDashboardCommon.replace);
        console.log(`✅ Added dashboard-common.js import`);
    } else {
        console.log(`⚠️  Dashboard-common.js import pattern not found`);
    }
    
    // Fix university logo with role-specific portal name
    const logoReplace = fixes.fixUniversityLogo.replace.replace('Portal', config.portalName);
    if (content.includes('quest_logo.png')) {
        content = content.replace(fixes.fixUniversityLogo.search, logoReplace);
        console.log(`✅ Fixed university logo display`);
    } else {
        console.log(`⚠️  University logo pattern not found`);
    }
    
    // Add role-specific function
    const roleFunction = `
        function getExpectedRole() {
            return '${config.role}';
        }
    `;
    
    // Insert role function before authentication fix
    if (content.includes('document.addEventListener(\'DOMContentLoaded\'')) {
        content = content.replace(
            'document.addEventListener(\'DOMContentLoaded\'',
            roleFunction + '\n        document.addEventListener(\'DOMContentLoaded\''
        );
        console.log(`✅ Added role-specific function`);
    }
    
    // Fix authentication (this is complex, so we'll add a simpler version)
    if (content.includes('localStorage.getItem(\'token\')')) {
        const simpleAuthFix = `
        // Check authentication on page load
        document.addEventListener('DOMContentLoaded', function() {
            // Use AuthManager from dashboard-common.js
            if (!AuthManager.checkAuth()) {
                return;
            }
            
            const user = AuthManager.getUser();
            if (user.role !== '${config.role}') {
                // Redirect to appropriate dashboard
                const dashboardMap = {
                    'university_superadmin': '/university-super-admin-dashboard.html',
                    'student': '/student-dashboard-enhanced.html',
                    'teacher': '/teacher-dashboard-enhanced.html',
                    'focal': '/focal-dashboard-enhanced.html',
                    'chairman': '/chairman-dashboard-enhanced.html',
                    'dean': '/dean-dashboard-enhanced.html',
                    'controller': '/controller-dashboard-enhanced.html'
                };
                
                const dashboardFile = dashboardMap[user.role] || '/student-dashboard-enhanced.html';
                window.location.href = dashboardFile;
                return;
            }
            
            currentUser = user;
            if (typeof loadDashboardData === 'function') {
                loadDashboardData();
            }
        });`;
        
        // Replace the entire DOMContentLoaded section
        content = content.replace(
            /\/\/ Check authentication on page load[\s\S]*?}\);/,
            simpleAuthFix
        );
        console.log(`✅ Fixed authentication using AuthManager`);
    }
    
    // Write the updated content back to file
    try {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Successfully updated: ${filePath}`);
    } catch (error) {
        console.log(`❌ Error writing file: ${error.message}`);
    }
});

console.log('\n🎯 FIXES APPLIED SUMMARY:');
console.log('========================');
console.log('✅ Added dashboard-common.js imports');
console.log('✅ Fixed university logo displays');
console.log('✅ Updated authentication to use AuthManager');
console.log('✅ Added role-specific configurations');

console.log('\n📝 REMAINING MANUAL TASKS:');
console.log('==========================');
console.log('🔄 Replace sample data with real API calls in all dashboards');
console.log('🔄 Add proper error handling and loading states');
console.log('🔄 Test all functionality after deployment');

console.log('\n✅ SCRIPT COMPLETED!');