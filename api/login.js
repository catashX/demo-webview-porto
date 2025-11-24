

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
    return data.app_access_token;
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
        return res.status(500).json({ error: 'Missing LARK_APP_ID or LARK_APP_SECRET environment variables' });
    }

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
        console.log('Token Data Response:', JSON.stringify(tokenData)); // Debug log

        if (tokenData.code !== 0) {
            throw new Error(`Failed to get user_access_token: ${JSON.stringify(tokenData)}`);
        }

        // Check which token field is present
        const userAccessToken = tokenData.data.access_token || tokenData.data.user_access_token;
        if (!userAccessToken) {
            throw new Error(`No access token found in response: ${JSON.stringify(tokenData.data)}`);
        }

        // 3. Get user info
        const userInfoRes = await fetch('https://open.larksuite.com/open-apis/authen/v1/user_info', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${userAccessToken}`
            }
        });

        const userInfoData = await userInfoRes.json();
        if (userInfoData.code !== 0) {
            throw new Error(`Failed to get user info: ${JSON.stringify(userInfoData)}`);
        }

        res.status(200).json(userInfoData.data);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
}
