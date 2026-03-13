// 🔧 DIRECT FIX FOR UNIVERSITY DASHBOARD LOADING ISSUE
// Add this to the university-super-admin-dashboard.html to fix the "Loading..." issue

// Enhanced loadUniversityInfo function that handles all edge cases
async function loadUniversityInfo() {
    console.log('🔍 Starting loadUniversityInfo...');
    
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        console.log('User data:', user);
        
        // Immediate fallback display
        if (user.universityCode) {
            const universityName = user.universityCode === 'DEMO' ? 'Demo University' : 
                                 user.universityCode.replace(/_/g, ' ').toUpperCase();
            const firstLetter = universityName.charAt(0).toUpperCase();
            
            // Update UI immediately
            document.getElementById('universityName').textContent = universityName;
            document.getElementById('universityLogoPlaceholder').textContent = firstLetter;
            
            // Update database name display
            const dbName = user.universityCode === 'DEMO' ? 'obe_demo' : `obe_university_${user.universityCode.toLowerCase()}`;
            const dbElement = document.getElementById('sidebarDatabaseName');
            if (dbElement) {
                dbElement.textContent = dbName;
            }
            
            console.log('✅ Set fallback university info:', universityName);
        }
        
        // Try API call
        try {
            const response = await fetch('/api/my-university', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-User-Email': user.email
                }
            });

            if (response.ok) {
                const myUniversity = await response.json();
                console.log('✅ API Response:', myUniversity);
                
                // Update with API data
                updateUIWithUniversityInfo(myUniversity);
                
                // Cache for next time
                localStorage.setItem('universityInfo', JSON.stringify(myUniversity));
                window.currentUniversity = myUniversity;
                
            } else {
                console.log('⚠️ API call failed with status:', response.status);
                const errorText = await response.text();
                console.log('Error response:', errorText);
                
                // Keep the fallback data we already set
                console.log('Using fallback data from user token');
            }
        } catch (apiError) {
            console.error('API Error:', apiError);
            // Keep the fallback data we already set
        }
        
    } catch (error) {
        console.error('Error in loadUniversityInfo:', error);
        
        // Last resort fallback
        document.getElementById('universityName').textContent = 'Demo University';
        document.getElementById('universityLogoPlaceholder').textContent = 'D';
        const dbElement = document.getElementById('sidebarDatabaseName');
        if (dbElement) {
            dbElement.textContent = 'obe_demo';
        }
    }
}

// Enhanced updateUIWithUniversityInfo function
function updateUIWithUniversityInfo(university) {
    console.log('🎨 Updating UI with:', university);
    
    const universityName = university.universityName || 'Demo University';
    const universityCode = university.universityCode || 'DEMO';
    const databaseName = university.databaseName || 'obe_demo';
    
    // Update all university name elements
    document.querySelectorAll('#universityName, .university-name').forEach(el => {
        if (el) el.textContent = universityName;
    });
    
    // Update logo
    const logoElement = document.getElementById('universityLogo');
    const placeholderElement = document.getElementById('universityLogoPlaceholder');
    
    if (university.logoUrl && logoElement) {
        logoElement.src = university.logoUrl;
        logoElement.style.display = 'block';
        if (placeholderElement) placeholderElement.style.display = 'none';
    } else if (placeholderElement) {
        const firstLetter = universityName.charAt(0).toUpperCase();
        placeholderElement.textContent = firstLetter;
        placeholderElement.style.display = 'flex';
        if (logoElement) logoElement.style.display = 'none';
    }
    
    // Update database name
    const dbElement = document.getElementById('sidebarDatabaseName');
    if (dbElement) {
        dbElement.textContent = databaseName;
    }
    
    // Update settings form if it exists
    const settingsNameElement = document.getElementById('settingsUniversityName');
    if (settingsNameElement) {
        settingsNameElement.value = universityName;
    }
    
    const settingsDbElement = document.getElementById('settingsDatabaseName');
    if (settingsDbElement) {
        settingsDbElement.value = databaseName;
    }
    
    console.log('✅ UI updated successfully');
}

// Force immediate execution when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUniversityInfo);
} else {
    loadUniversityInfo();
}

console.log('🔧 University dashboard loading fix applied');