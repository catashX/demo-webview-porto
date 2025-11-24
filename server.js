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

// Login endpoint: Exchange auth code for user info
app.post('/api/login', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Auth code is required' });
        }

        // 1. Get app_access_token (tenant_access_token)
        const appAccessToken = await getAccessToken();

        // 2. Get user_access_token
        const tokenRes = await fetch('https://open.larksuite.com/open-apis/authen/v1/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appAccessToken}`
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code: code
            })
        });

        const tokenData = await tokenRes.json();
        if (tokenData.code !== 0) {
            throw new Error(`Failed to get user_access_token: ${JSON.stringify(tokenData)}`);
        }

        // 3. Get user info
        const userInfoRes = await fetch('https://open.larksuite.com/open-apis/authen/v1/user_info', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenData.data.user_access_token}`
            }
        });

        const userInfoData = await userInfoRes.json();
        if (userInfoData.code !== 0) {
            throw new Error(`Failed to get user info: ${JSON.stringify(userInfoData)}`);
        }

        res.json(userInfoData.data);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send message endpoint
app.post('/api/send-message', async (req, res) => {
    try {
        const { receive_id, content, receive_id_type = 'open_id' } = req.body;
        if (!receive_id || !content) {
            return res.status(400).json({ error: 'receive_id and content are required' });
        }

        const accessToken = await getAccessToken();

        const response = await fetch(`https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=${receive_id_type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                receive_id: receive_id,
                msg_type: 'text',
                content: JSON.stringify({
                    text: content
                })
            })
        });

        const data = await response.json();
        if (data.code !== 0) {
            throw new Error(`Failed to send message: ${JSON.stringify(data)}`);
        }

        res.json(data.data);

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Lark config server running on port ${PORT}`);
    console.log(`Make sure to set LARK_APP_ID and LARK_APP_SECRET environment variables`);
});
