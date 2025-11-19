import express from 'express';
import crypto from 'crypto';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// TODO: Replace with your actual credentials
const LARK_APP_ID = process.env.LARK_APP_ID || 'YOUR_APP_ID_HERE';
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || 'YOUR_APP_SECRET_HERE';

// In-memory cache for jsapi_ticket (should use Redis in production)
let ticketCache = {
    ticket: null,
    expiresAt: 0
};

// Get access token from Lark
async function getAccessToken() {
    const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/app_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            app_id: LARK_APP_ID,
            app_secret: LARK_APP_SECRET
        })
    });
    const data = await response.json();
    return data.app_access_token;
}

// Get jsapi_ticket from Lark
async function getJsApiTicket() {
    const now = Date.now();

    // Return cached ticket if still valid
    if (ticketCache.ticket && ticketCache.expiresAt > now) {
        return ticketCache.ticket;
    }

    const accessToken = await getAccessToken();
    const response = await fetch('https://open.larksuite.com/open-apis/jssdk/ticket/get', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        }
    });

    const data = await response.json();

    if (data.code === 0) {
        ticketCache.ticket = data.data.ticket;
        ticketCache.expiresAt = now + (data.data.expire_in * 1000) - 60000; // Refresh 1 min before expiry
        return ticketCache.ticket;
    }

    throw new Error('Failed to get jsapi_ticket: ' + JSON.stringify(data));
}

// Generate signature for SDK config
app.get('/api/lark-config', async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        const jsapiTicket = await getJsApiTicket();
        const timestamp = Math.floor(Date.now() / 1000);
        const nonceStr = crypto.randomBytes(16).toString('hex');

        // Generate signature according to Lark documentation
        const string = `jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
        const signature = crypto.createHash('sha1').update(string).digest('hex');

        res.json({
            appId: LARK_APP_ID,
            timestamp,
            nonceStr,
            signature,
            url
        });
    } catch (error) {
        console.error('Error generating config:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Lark config server running on port ${PORT}`);
    console.log(`Make sure to set LARK_APP_ID and LARK_APP_SECRET environment variables`);
});
