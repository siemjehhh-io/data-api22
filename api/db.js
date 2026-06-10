// api/db.js
// Vercel Serverless Function to handle API22 Database sync via Vercel KV (REST API)

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const API_TOKEN = 'api22_sec_e2c8a7b9d4f6c8e3';

export default async function handler(req, res) {
    // Enable CORS for frontend requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API22-Token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Token validation
    const token = req.headers['x-api22-token'];
    if (token !== API_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if KV is connected
    if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
        return res.status(500).json({ 
            error: 'Vercel KV storage is not linked to this project. Please create and link a KV Database in the Vercel Storage dashboard.' 
        });
    }

    try {
        if (req.method === 'GET') {
            // Read from Vercel KV using standard Redis command payload
            const response = await fetch(KV_REST_API_URL, {
                method: 'POST',
                headers: { 
                    Authorization: `Bearer ${KV_REST_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(['GET', 'api22_db'])
            });
            if (!response.ok) throw new Error(`KV GET REST failed: ${response.status}`);
            
                        const result = await response.json();
            
            if (result && result.result) {
                return res.status(200).json(JSON.parse(result.result));
            } else {
                // Fallback: Check if there is data under the legacy key 'pin88_db'
                const legacyResponse = await fetch(KV_REST_API_URL, {
                    method: 'POST',
                    headers: { 
                        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(['GET', 'pin88_db'])
                });
                if (legacyResponse.ok) {
                    const legacyResult = await legacyResponse.json();
                    if (legacyResult && legacyResult.result) {
                        const legacyData = JSON.parse(legacyResult.result);
                        
                        // Auto-migrate: save to the new key 'api22_db'
                        await fetch(KV_REST_API_URL, {
                            method: 'POST',
                            headers: { 
                                Authorization: `Bearer ${KV_REST_API_TOKEN}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(['SET', 'api22_db', legacyResult.result])
                        });
                        
                        return res.status(200).json(legacyData);
                    }
                }
                return res.status(200).json({ empty: true });
            }
        } 
        
        if (req.method === 'POST') {
            // Save to Vercel KV
            const payload = req.body;
            
            // Write to Vercel KV using standard Redis command payload
            const response = await fetch(KV_REST_API_URL, {
                method: 'POST',
                headers: { 
                    Authorization: `Bearer ${KV_REST_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(['SET', 'api22_db', JSON.stringify(payload)])
            });
            if (!response.ok) throw new Error(`KV SET REST failed: ${response.status}`);
            
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error("Vercel KV Serverless Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
