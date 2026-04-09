const express = require('express');
const router = express.Router();
const { readDb, writeDb, generateId } = require('../db');

const phoneRegex = /^\d{10}$/;
const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;

// Helper for validations
function validateCreds(phone, password, isLogin = false) {
    if (!phoneRegex.test(phone)) {
        return 'Mobile number must be exactly 10 digits';
    }
    if (!isLogin) {
        if (!passRegex.test(password)) {
            return 'Password must be at least 8 characters long, contain a capital letter, a small letter, and a special character.';
        }
    }
    return null;
}

router.post('/signup', async (req, res) => {
    try {
        const { phone, password, name } = req.body;
        const db = await readDb();

        const valError = validateCreds(phone, password, false);
        if (valError) return res.status(400).json({ error: valError });

        if (!name) return res.status(400).json({ error: 'Name is required' });

        if (db.users.find(u => u.phone === phone)) {
            return res.status(400).json({ error: 'Account already exists for this number' });
        }

        const role = phone === '8861909062' ? 'admin' : 'user';
        const user = { _id: generateId(), phone, password, name, role, isGuest: false };
        db.users.push(user);
        await writeDb(db);
        
        res.status(201).json({ token: user._id, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { phone, password, isGuest } = req.body;
        const db = await readDb();
        
        if (isGuest) {
            const guestPhone = 'guest_' + Date.now();
            const user = { _id: generateId(), phone: guestPhone, name: 'Guest User', role: 'user', isGuest: true };
            db.users.push(user);
            await writeDb(db);
            return res.json({ token: user._id, user });
        }

        if (!phoneRegex.test(phone)) {
             return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' });
        }

        let user = db.users.find(u => u.phone === phone);
        if (!user) {
            return res.status(404).json({ error: 'Account not found. Please create an account first.' });
        }
        
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        res.json({ token: user._id, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Demo Setup
router.post('/setup-admin', async (req, res) => {
    try {
        const db = await readDb();
        let admin = db.users.find(u => u.phone === '8861909062');
        if (!admin) {
            admin = { _id: generateId(), phone: '8861909062', password: 'Raki@2005', name: 'System Admin', role: 'admin' };
            db.users.push(admin);
            await writeDb(db);
            return res.json({ message: 'Admin created', admin });
        } else {
            admin.password = 'Raki@2005';
            admin.role = 'admin';
            await writeDb(db);
        }
        res.json({ message: 'Admin already exists and password updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
