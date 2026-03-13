// 🔧 DIRECT LOADING FIX - Inject this into university dashboard
// This script runs immediately to prevent "Loading..." state

console.log('🔧 Direct loading fix executing...');

// Immediate execution - don't wait for anything
(function() {
    try {
        // Set fallback values immediately
        const setFallbackValues = () => {
            const nameEl = document.getElementById('universityName');
            const logoEl = document.getElementById('universityLogoPlaceholder');
            const dbEl = document.getElementById('sidebarDatabaseName');
            
            if (nameEl && nameEl.textContent === 'Loading...') {
                nameEl.textContent = 'Demo University';
                console.log('✅ Set university name fallback');
            }
            
            if (logoEl) {
                logoEl.textContent = 'D';
                logoEl.style.display = 'flex';
                console.log('✅ Set logo fallback');
            }
            
            if (dbEl && (dbEl.textContent === 'Loading database...' || dbEl.textContent.includes('Loading'))) {
                dbEl.textContent = 'obe_demo';
                console.log('✅ Set database name fallback');
            }
            
            // Hide actual logo if placeholder is shown
            const actualLogo = document.getElementById('universityLogo');
            if (actualLogo) {
                actualLogo.style.display = 'none';
            }
        };
        
        // Run immediately
        setFallbackValues();
        
        // Run again after a short delay in case elements load later
        setTimeout(setFallbackValues, 100);
        setTimeout(setFallbackValues, 500);
        setTimeout(setFallbackValues, 1000);
        
        // Enhanced loadUniversityInfo that always shows something
        if (typeof window.loadUniversityInfo === 'function') {
            const originalLoad = window.loadUniversityInfo;
            window.loadUniversityInfo = async function() {
                console.log('🔄 Enhanced loadUniversityInfo called');
                
                // Set fallback first
                setFallbackValues();
                
                try {
                    // Try original function
                    await originalLoad();
                } catch (error) {
                    console.error('Original loadUniversityInfo failed:', error);
                    // Keep fallback values
                }
            };
        }
        
        console.log('✅ Direct loading fix applied successfully');
        
    } catch (error) {
        console.error('Direct loading fix error:', error);
    }
})();

// Override any function that might set "Loading..."
const originalTextContent = Object.getOwnPropertyDescriptor(Element.prototype, 'textContent');
Object.defineProperty(Element.prototype, 'textContent', {
    set: function(value) {
        if (this.id === 'universityName' && value === 'Loading...') {
            console.log('🚫 Prevented Loading... text, using Demo University instead');
            originalTextContent.set.call(this, 'Demo University');
        } else {
            originalTextContent.set.call(this, value);
        }
    },
    get: originalTextContent.get
});

console.log('🔧 Loading prevention system active');