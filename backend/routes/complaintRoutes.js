const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readDb, writeDb, generateId } = require('../db');
const { analyzeComplaint } = require('../ai');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { title, description, lat, lng, userId } = req.body;
        const imageUrl = req.file ? `/api/uploads/${req.file.filename}` : null;

        const aiAnalysis = await analyzeComplaint(title, description);
        const timestamp = new Date().toISOString();

        const complaint = {
            _id: generateId(),
            userId,
            title,
            description,
            category: aiAnalysis.category,
            priority: aiAnalysis.priority,
            status: 'Pending',
            location: {
                lat: lat ? parseFloat(lat) : null,
                lng: lng ? parseFloat(lng) : null
            },
            imageUrl,
            adminComment: '',
            createdAt: timestamp,
            upvotes: [],
            comments: [],
            statusHistory: [{ status: 'Pending', timestamp }]
        };

        const db = await readDb();
        db.complaints.push(complaint);
        await writeDb(db);

        res.status(201).json(complaint);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    const { userId } = req.query;
    try {
        const db = await readDb();
        let complaints = db.complaints;
        if (userId) {
            complaints = complaints.filter(c => c.userId === userId);
        }
        complaints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json(complaints);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Update Status (with optional proof image)
router.put('/:id', upload.single('proofImage'), async (req, res) => {
    try {
        const { status, adminComment, department } = req.body;
        const proofImageUrl = req.file ? `/api/uploads/${req.file.filename}` : undefined;
        const db = await readDb();
        const complaintIndex = db.complaints.findIndex(c => c._id === req.params.id);
        
        if (complaintIndex !== -1) {
            const comp = db.complaints[complaintIndex];
            
            // Check if status changed
            if (comp.status !== status || comp.department !== department) {
                if (!comp.statusHistory) comp.statusHistory = [{ status: comp.status, timestamp: comp.createdAt }];
                comp.statusHistory.push({ status, department, timestamp: new Date().toISOString() });
            }

            const updated = { ...comp, status, adminComment, department };
            if (proofImageUrl) updated.proofImageUrl = proofImageUrl;

            db.complaints[complaintIndex] = updated;
            await writeDb(db);
            res.json(db.complaints[complaintIndex]);
        } else {
            res.status(404).json({ error: 'Complaint not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upvote tracking
router.put('/:id/upvote', async (req, res) => {
    try {
        const { userId } = req.body;
        const db = await readDb();
        const comp = db.complaints.find(c => c._id === req.params.id);
        if(!comp) return res.status(404).json({error: 'Not found'});
        
        if (!comp.upvotes) comp.upvotes = [];
        
        const i = comp.upvotes.indexOf(userId);
        if (i === -1) comp.upvotes.push(userId);
        else comp.upvotes.splice(i, 1);
        
        await writeDb(db);
        res.json(comp);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Comment submission
router.post('/:id/comment', async (req, res) => {
    try {
        const { text, authorName } = req.body;
        const db = await readDb();
        const comp = db.complaints.find(c => c._id === req.params.id);
        if(!comp) return res.status(404).json({error: 'Not found'});
        
        if (!comp.comments) comp.comments = [];
        comp.comments.push({ text, authorName, timestamp: new Date().toISOString() });
        
        await writeDb(db);
        res.json(comp);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
