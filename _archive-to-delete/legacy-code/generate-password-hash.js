// Generate correct bcrypt hash for 'demo123'
const bcrypt = require('bcrypt');

async function generateHash() {
    try {
        const password = 'demo123';
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('Password:', password);
        console.log('Hash:', hash);
        
        // Test the hash
        const isValid = await bcrypt.compare(password, hash);
        console.log('Hash validation:', isValid);
        
        return hash;
    } catch (error) {
        console.error('Error generating hash:', error);
    }
}

generateHash();