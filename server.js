const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3088;
const DB_FILE = path.join(__dirname, 'db.json');
const API_TOKEN = 'api22_sec_e2c8a7b9d4f6c8e3';

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Token validation middleware
function checkToken(req, res, next) {
    const token = req.headers['x-api22-token'];
    if (token === API_TOKEN) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

// Get database
app.get('/api/db', checkToken, (req, res) => {
    if (fs.existsSync(DB_FILE)) {
        try {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            res.json(JSON.parse(data));
        } catch (e) {
            res.status(500).json({ error: 'Failed to read database file' });
        }
    } else {
        res.json({ empty: true });
    }
});

// Save database
app.post('/api/db', checkToken, (req, res) => {
    try {
        const payload = req.body;
        
        // Check if incoming database payload is empty
        const incomingDb = payload.db;
        const incomingIsEmpty = !incomingDb || (
            (!incomingDb.banks || incomingDb.banks.length === 0) &&
            (!incomingDb.socials || incomingDb.socials.length === 0) &&
            (!incomingDb.qris || incomingDb.qris.length === 0) &&
            (!incomingDb.backupContacts || incomingDb.backupContacts.length === 0)
        );

        if (incomingIsEmpty && fs.existsSync(DB_FILE)) {
            try {
                const fileData = fs.readFileSync(DB_FILE, 'utf8');
                const existing = JSON.parse(fileData);
                const existingDb = existing.db;
                const existingHasData = existingDb && (
                    (existingDb.banks && existingDb.banks.length > 0) ||
                    (existingDb.socials && existingDb.socials.length > 0) ||
                    (existingDb.qris && existingDb.qris.length > 0) ||
                    (existingDb.backupContacts && existingDb.backupContacts.length > 0)
                );
                
                if (existingHasData) {
                    return res.status(400).json({ 
                        error: 'Penulisan ditolak: Data yang dikirim kosong sedangkan server memiliki data aktif. Harap muat ulang halaman dashboard Anda untuk menyinkronkan data.' 
                    });
                }
            } catch (parseErr) {
                console.error("Failed to parse local JSON for protection check:", parseErr);
            }
        }

        fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to write database file' });
    }
});

// Fallback all other routes to index.html (useful for SPA behavior if needed)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`API22 Backend API listening on port ${PORT}`);
});
