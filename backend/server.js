const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const { initDb } = require('./db');

const app = express();

app.use(cors());
app.use(express.json());
// Serve uploaded images statically
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);

// Serve frontend static files (for Render deployment)
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Fallback: serve index.html for any unknown route
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

initDb().then(() => {
    console.log('Local JSON Database initialized successfully!');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}).catch(err => {
    console.error('Failed to initialize Local JSON DB:', err);
});
