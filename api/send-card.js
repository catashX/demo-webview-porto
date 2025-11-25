
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
        const { receive_id, card_content, receive_id_type = 'open_id' } = req.body;
        if (!receive_id || !card_content) {
            return res.status(400).json({ error: 'receive_id and card_content are required' });
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
                msg_type: 'interactive',
                content: JSON.stringify(card_content)
            })
        });

        const data = await response.json();
        if (data.code !== 0) {
            throw new Error(`Failed to send card: ${JSON.stringify(data)}`);
        }

        res.status(200).json(data.data);

    } catch (error) {
        console.error('Send card error:', error);
        res.status(500).json({ error: error.message });
    }
}
