import crypto from 'crypto';

// In-memory cache (Vercel serverless has limited state)
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
            app_id: process.env.LARK_APP_ID,
            app_secret: process.env.LARK_APP_SECRET
        })
    });
    const data = await response.json();

    if (data.code !== 0) {
        throw new Error('Failed to get access token: ' + JSON.stringify(data));
    }

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
        ticketCache.expiresAt = now + (data.data.expire_in * 1000) - 60000;
        return ticketCache.ticket;
    }

    throw new Error('Failed to get jsapi_ticket: ' + JSON.stringify(data));
}

// Vercel Serverless Function Handler
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
            return res.status(500).json({
                error: 'LARK_APP_ID and LARK_APP_SECRET must be set in Vercel environment variables'
            });
        }

        const jsapiTicket = await getJsApiTicket();
        const timestamp = Math.floor(Date.now() / 1000);
        const nonceStr = crypto.randomBytes(16).toString('hex');

        // Generate signature
        const string = `jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
        const signature = crypto.createHash('sha1').update(string).digest('hex');

        console.log('--- JSAPI Signature Debug ---');
        console.log('URL:', url);
        console.log('Ticket:', jsapiTicket.substring(0, 10) + '...');
        console.log('String to sign:', string);
        console.log('Signature:', signature);
        console.log('---------------------------');

        res.status(200).json({
            appId: process.env.LARK_APP_ID,
            timestamp,
            nonceStr,
            signature,
            url
        });
    } catch (error) {
        console.error('Error generating config:', error);
        res.status(500).json({ error: error.message });
    }
}
