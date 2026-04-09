const fs = require('fs').promises;
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

async function initDb() {
    try {
        await fs.access(DB_FILE);
    } catch {
        // Create fresh database with admin account pre-seeded
        const initial = {
            users: [
                {
                    _id: 'admin001',
                    phone: '8861909062',
                    password: 'Raki@2005',
                    name: 'System Admin',
                    role: 'admin',
                    isGuest: false
                }
            ],
            complaints: []
        };
        await fs.writeFile(DB_FILE, JSON.stringify(initial, null, 2));
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads');
    try {
        await fs.access(uploadsDir);
    } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
    }
}

async function readDb() {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
}

async function writeDb(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// Generate simple ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

module.exports = { initDb, readDb, writeDb, generateId };
