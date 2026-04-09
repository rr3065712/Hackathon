const fs = require('fs').promises;
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

async function initDb() {
    try {
        await fs.access(DB_FILE);
    } catch {
        await fs.writeFile(DB_FILE, JSON.stringify({ users: [], complaints: [] }));
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
